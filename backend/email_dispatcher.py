import os
import sys
import time
import json
import threading
from typing import List, Dict, Any, Optional
from datetime import datetime

import backend.database as database
import backend.email_service as email_service

try:
    import pythoncom
    COM_AVAILABLE = True
except ImportError:
    COM_AVAILABLE = False


class EmailDispatchService:
    """
    Background asynchronous queue service that gracefully paces bulk email deliveries.
    Prevents SMTP server connection-rate bans and socket exhaustion by reusing
    active connections and maintaining operator controls (pause, resume, cancel, retry).
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._worker_thread: Optional[threading.Thread] = None
        self._queue: List[Dict[str, Any]] = []
        self._is_running = False
        self._is_paused = False
        self._cancel_requested = False
        self._logs: List[str] = []
        self._current_item: Optional[Dict[str, Any]] = None
        self._stats = {
            "total": 0,
            "completed": 0,
            "failed": 0,
            "remaining": 0,
        }
        self._smtp_conn = None

    def enqueue(self, item_ids: List[int]) -> Dict[str, Any]:
        """Add invoice items to the dispatch queue and start the worker if idle."""
        with self._lock:
            # If not currently running or all prior items are finished, reset queue
            all_done = not any(q["status"] in ("queued", "sending") for q in self._queue)
            if not self._is_running or all_done:
                self._queue = []
                self._logs = []
                self._stats = {"total": 0, "completed": 0, "failed": 0, "remaining": 0}
                self._cancel_requested = False
                self._is_paused = False

            existing_ids = {q["item_id"] for q in self._queue}
            added_count = 0

            for iid in item_ids:
                if iid in existing_ids:
                    continue
                item = database.get_job_item(iid)
                if not item:
                    continue

                client_info = database.get_client(item["client_name"])
                recipient_email = (client_info["email"] if client_info and client_info.get("email") else item.get("email", "")) or ""
                cc_email = (client_info["cc_email"] if client_info and client_info.get("cc_email") else item.get("cc_email", "")) or ""

                self._queue.append({
                    "item_id": iid,
                    "client_name": item["client_name"],
                    "recipient_email": recipient_email,
                    "cc_email": cc_email,
                    "invoice_number": item.get("invoice_number") or f"INV-{iid}",
                    "total_amount": float(item.get("total_amount") or 0.0),
                    "status": "queued",
                    "error_msg": "",
                    "enqueued_at": datetime.now().strftime("%H:%M:%S"),
                    "sent_at": None,
                })
                added_count += 1

            self._recalculate_stats_locked()
            self._log_locked(f"Enqueued {added_count} client invoice emails into graceful dispatch queue.")

            if not self._is_running and self._stats["remaining"] > 0:
                self._is_running = True
                self._cancel_requested = False
                self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
                self._worker_thread.start()

        return self.get_status()

    def pause(self) -> Dict[str, Any]:
        with self._lock:
            if self._is_running:
                self._is_paused = True
                self._log_locked("Dispatch queue paused by operator. Ongoing email will finish.")
        return self.get_status()

    def resume(self) -> Dict[str, Any]:
        with self._lock:
            if self._is_running and self._is_paused:
                self._is_paused = False
                self._log_locked("Dispatch queue resumed.")
        return self.get_status()

    def cancel(self) -> Dict[str, Any]:
        with self._lock:
            if self._is_running:
                self._cancel_requested = True
                self._is_paused = False
                for q in self._queue:
                    if q["status"] == "queued":
                        q["status"] = "cancelled"
                self._recalculate_stats_locked()
                self._log_locked("Dispatch queue cancellation requested. Aborting remaining items.")
        return self.get_status()

    def retry_failed(self) -> Dict[str, Any]:
        """Re-enqueue any items that failed in the current batch."""
        with self._lock:
            retry_count = 0
            for q in self._queue:
                if q["status"] == "failed":
                    q["status"] = "queued"
                    q["error_msg"] = ""
                    retry_count += 1

            if retry_count > 0:
                self._recalculate_stats_locked()
                self._log_locked(f"Re-enqueued {retry_count} failed emails for retry.")
                if not self._is_running:
                    self._is_running = True
                    self._cancel_requested = False
                    self._is_paused = False
                    self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
                    self._worker_thread.start()

        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            settings = database.get_all_settings()
            try:
                throttle = float(settings.get("email_throttle_seconds", 2.0) or 2.0)
            except (ValueError, TypeError):
                throttle = 2.0

            return {
                "running": self._is_running,
                "paused": self._is_paused,
                "cancelled": self._cancel_requested,
                "stats": dict(self._stats),
                "total": self._stats["total"],
                "completed": self._stats["completed"],
                "failed": self._stats["failed"],
                "remaining": self._stats["remaining"],
                "throttle_seconds": throttle,
                "current_item": dict(self._current_item) if self._current_item else None,
                "queue": [dict(q) for q in self._queue],
                "logs": list(self._logs[-100:]),  # Return the last 100 log lines
            }

    # --- INTERNAL WORKER LOGIC ---

    def _log_locked(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S")
        self._logs.append(f"[{ts}] {msg}")

    def _recalculate_stats_locked(self):
        total = len(self._queue)
        completed = sum(1 for q in self._queue if q["status"] == "sent")
        failed = sum(1 for q in self._queue if q["status"] == "failed")
        remaining = sum(1 for q in self._queue if q["status"] == "queued")
        self._stats = {
            "total": total,
            "completed": completed,
            "failed": failed,
            "remaining": remaining,
        }

    def _worker_loop(self):
        co_init = False
        if COM_AVAILABLE:
            try:
                pythoncom.CoInitialize()
                co_init = True
            except Exception:
                pass

        try:
            settings = database.get_all_settings()
            subject_template = settings.get("email_subject_template", "Portfolio Report & Invoice - {ClientName}")
            body_template = settings.get("email_body_template", "Dear {ClientName},\n...")
            use_outlook = settings.get("email_use_outlook", "0") == "1"

            try:
                throttle_sec = float(settings.get("email_throttle_seconds", 2.0) or 2.0)
            except (ValueError, TypeError):
                throttle_sec = 2.0

            with self._lock:
                self._log_locked(
                    f"Dispatcher worker started. Protocol: {'Outlook COM' if use_outlook else 'SMTP'}. "
                    f"Graceful throttle: {throttle_sec:.1f}s between emails."
                )

            while True:
                # 1. Check for cancel
                with self._lock:
                    if self._cancel_requested:
                        self._log_locked("Worker stopping due to cancel request.")
                        break

                # 2. Check for pause
                while True:
                    with self._lock:
                        if not self._is_paused or self._cancel_requested:
                            break
                    time.sleep(0.5)

                # 3. Find next queued item
                item_to_process = None
                with self._lock:
                    if self._cancel_requested:
                        break
                    for q in self._queue:
                        if q["status"] == "queued":
                            q["status"] = "sending"
                            item_to_process = q
                            self._current_item = q
                            self._recalculate_stats_locked()
                            break

                if not item_to_process:
                    # Queue is empty
                    break

                # 4. Dispatch the item
                item_id = item_to_process["item_id"]
                client_name = item_to_process["client_name"]

                with self._lock:
                    self._log_locked(f"Preparing dispatch for {client_name} (Invoice #{item_to_process['invoice_number']})...")

                try:
                    success = self._send_single_item(item_id, item_to_process, settings, subject_template, body_template, use_outlook)
                    with self._lock:
                        if success:
                            item_to_process["status"] = "sent"
                            item_to_process["sent_at"] = datetime.now().strftime("%H:%M:%S")
                            self._log_locked(f"Successfully delivered email to {client_name} ({item_to_process['recipient_email']}).")
                            database.update_job_item(item_id, {"email_status": "Sent"})
                        else:
                            item_to_process["status"] = "failed"
                            database.update_job_item(item_id, {"email_status": f"Failed: {item_to_process.get('error_msg', '')[:35]}"})
                        self._recalculate_stats_locked()
                except Exception as ex:
                    with self._lock:
                        item_to_process["status"] = "failed"
                        item_to_process["error_msg"] = str(ex)
                        self._log_locked(f"Failed dispatch to {client_name}: {ex}")
                        database.update_job_item(item_id, {"email_status": f"Failed: {str(ex)[:35]}"})
                        self._recalculate_stats_locked()

                # 5. Pacing delay if more items remain in queue
                has_more = False
                with self._lock:
                    self._current_item = None
                    has_more = any(q["status"] == "queued" for q in self._queue)
                    if self._cancel_requested:
                        has_more = False

                if has_more and throttle_sec > 0:
                    with self._lock:
                        self._log_locked(f"Pacing delay ({throttle_sec:.1f}s) to preserve sender reputation...")
                    # Sleep in small slices so cancel/pause responds quickly
                    elapsed = 0.0
                    while elapsed < throttle_sec:
                        time.sleep(0.1)
                        elapsed += 0.1
                        with self._lock:
                            if self._cancel_requested or self._is_paused:
                                break

        finally:
            self._close_active_smtp()
            if co_init:
                try:
                    pythoncom.CoUninitialize()
                except Exception:
                    pass

            with self._lock:
                self._is_running = False
                self._current_item = None
                self._recalculate_stats_locked()
                self._log_locked(
                    f"Dispatcher finished. Total: {self._stats['total']} | "
                    f"Delivered: {self._stats['completed']} | Failed: {self._stats['failed']}"
                )

    def _send_single_item(self, item_id: int, queue_item: Dict[str, Any], settings: Dict[str, str],
                          subject_tmpl: str, body_tmpl: str, use_outlook: bool) -> bool:
        item = database.get_job_item(item_id)
        if not item:
            queue_item["error_msg"] = "Item record not found in database"
            return False

        client_name = item["client_name"]
        client_info = database.get_client(client_name)
        if not client_info:
            client_info = {
                "client_name": client_name,
                "email": item.get("email", ""),
                "cc_email": item.get("cc_email", ""),
            }
        else:
            client_info = dict(client_info)
            if item.get("cc_email"):
                client_info["cc_email"] = item["cc_email"]

        to_email = client_info.get("email", "").strip()
        if not to_email:
            queue_item["error_msg"] = "Recipient email address is missing"
            return False

        attachments = []
        if item.get("portfolio_pdf_path") and os.path.exists(item["portfolio_pdf_path"]):
            attachments.append(item["portfolio_pdf_path"])
        if item.get("invoice_pdf_path") and os.path.exists(item["invoice_pdf_path"]):
            attachments.append(item["invoice_pdf_path"])

        qr_path = settings.get("email_qr_path", "").strip()
        if qr_path and os.path.exists(qr_path):
            attachments.append(qr_path)

        if not attachments:
            queue_item["error_msg"] = "Generated invoice and portfolio PDFs not found on disk"
            return False

        invoice_code = (item.get("invoice_number") or "").strip()
        if not invoice_code and item.get("invoice_pdf_path"):
            invoice_code = os.path.basename(item["invoice_pdf_path"]).replace("_Invoice.pdf", "")
        if not invoice_code:
            invoice_code = f"{settings.get('invoice_prefix', 'INV-')}{item_id:04d}"

        credit_applied_val = float(item.get("credit_applied", 0.0) or 0.0)
        custom_msg = item.get("custom_message", "") or ""
        if credit_applied_val > 0:
            credit_note = f"Note: A prior credit of INR {credit_applied_val:,.2f} has been applied to this invoice. The net amount payable is INR {max(0.0, float(item['total_amount'] or 0.0) - credit_applied_val):,.2f}."
            custom_msg = f"{credit_note}\n\n{custom_msg}" if custom_msg else credit_note

        invoice_details = {
            "invoice_number": invoice_code,
            "valuation": float(item.get("valuation") or 0.0),
            "fee_amount": float(item.get("fee_amount") or 0.0),
            "total_amount": float(item.get("total_amount") or 0.0),
            "custom_message": custom_msg,
        }

        context = {
            "ClientName": client_name,
            "InvoiceNumber": invoice_details["invoice_number"],
            "Valuation": f"INR {invoice_details['valuation']:,.2f}",
            "FeeAmount": f"INR {invoice_details['fee_amount']:,.2f}",
            "TotalAmount": f"INR {invoice_details['total_amount']:,.2f}",
            "CustomMessage": invoice_details["custom_message"],
        }

        subject = email_service.render_template(subject_tmpl, context)
        body = email_service.render_template(body_tmpl, context)

        # Dispatch via service
        email_service.send_client_email(
            settings=settings,
            client_info=client_info,
            subject_template=subject_tmpl,
            body_template=body_tmpl,
            invoice_details=invoice_details,
            attachments=attachments,
            display_outlook=False,
        )

        database.add_email_log({
            "client_name": client_name,
            "recipient_email": to_email,
            "cc_email": client_info.get("cc_email", ""),
            "subject": subject,
            "body": body,
            "status": "Sent",
            "error_msg": "",
            "attachments": json.dumps(attachments),
            "email_type": "invoice",
        })
        return True

    def _close_active_smtp(self):
        if self._smtp_conn:
            try:
                self._smtp_conn.quit()
            except Exception:
                pass
            self._smtp_conn = None


# Global singleton instance for application lifetime
DISPATCHER = EmailDispatchService()
