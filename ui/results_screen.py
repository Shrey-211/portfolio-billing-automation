import os
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QTableWidget, QTableWidgetItem, QFrame, QHeaderView,
    QMessageBox, QDialog, QProgressBar, QTextEdit
)
from PySide6.QtCore import Qt, QThread, Signal, Slot
import database
import email_service
from ui.pdf_viewer import PDFViewerDialog

class EmailWorker(QThread):
    # Signals
    email_progress = Signal(int, int)          # Emitted for progress: (completed, total)
    log_emitted = Signal(str, str)             # Emitted for logs: (msg, log_type)
    item_completed = Signal(int, str, bool)    # Emitted when an email is sent: (job_item_id, email_status, success)
    finished_all = Signal(int, int)            # Emitted when bulk send completes: (success_count, fail_count)
    
    def __init__(self, job_items, db_path=None):
        super().__init__()
        self.job_items = job_items
        self.db_path = db_path
        self.is_cancelled = False
        
    def cancel(self):
        self.is_cancelled = True
        
    def run(self):
        total = len(self.job_items)
        success_count = 0
        fail_count = 0
        
        # Load email configs
        settings = database.get_all_settings(self.db_path)
        subject_template = settings.get("email_subject_template", "Portfolio Report & Invoice")
        body_template = settings.get("email_body_template", "Dear {ClientName},\n...")
        
        self.log_emitted.emit(f"Starting bulk email delivery for {total} client(s)...", "info")
        
        for idx, item in enumerate(self.job_items):
            if self.is_cancelled:
                self.log_emitted.emit("Email sending cancelled by user.", "warning")
                break
                
            client_name = item["client_name"]
            item_id = item["id"]
            
            # Fetch client email details from client registry/cache
            client_info = database.get_client(client_name, self.db_path)
            if not client_info:
                # Fallback to whatever values we have in the job item or template
                client_info = {
                    "client_name": client_name,
                    "email": item.get("email", ""),
                    "cc_email": item.get("cc_email", ""),
                    "state": item.get("state", "Maharashtra"),
                    "address": item.get("address", ""),
                    "gstin": item.get("gstin", "")
                }
            
            if not client_info.get("email"):
                fail_count += 1
                self.log_emitted.emit(f"Skipping {client_name}: Email address is missing.", "error")
                database.update_job_item(item_id, {"email_status": "Failed: No Email"}, self.db_path)
                self.item_completed.emit(item_id, "Failed: No Email", False)
                self.email_progress.emit(idx + 1, total)
                continue
                
            self.log_emitted.emit(f"[{idx+1}/{total}] Preparing email for {client_name} ({client_info['email']})...", "info")
            
            # Prepare attachments
            attachments = []
            if item["portfolio_pdf_path"]:
                attachments.append(item["portfolio_pdf_path"])
            if item["invoice_pdf_path"]:
                attachments.append(item["invoice_pdf_path"])
                
            if not attachments:
                fail_count += 1
                self.log_emitted.emit(f"Skipping {client_name}: No generated documents to attach.", "error")
                database.update_job_item(item_id, {"email_status": "Failed: No Attachments"}, self.db_path)
                self.item_completed.emit(item_id, "Failed: No Attachments", False)
                self.email_progress.emit(idx + 1, total)
                continue
                
            # Compile invoice details for placeholders
            invoice_code = os.path.basename(item["invoice_pdf_path"]).replace("_Invoice.pdf", "") if item["invoice_pdf_path"] else "N/A"
            invoice_details = {
                "invoice_number": invoice_code,
                "valuation": item["valuation"],
                "fee_amount": item["fee_amount"],
                "total_amount": item["total_amount"]
            }
            
            try:
                email_service.send_client_email(
                    settings, 
                    client_info, 
                    subject_template, 
                    body_template, 
                    invoice_details, 
                    attachments,
                    display_outlook=False # Send directly in background
                )
                success_count += 1
                self.log_emitted.emit(f"Successfully sent email to {client_name}.", "success")
                database.update_job_item(item_id, {"email_status": "Sent"}, self.db_path)
                self.item_completed.emit(item_id, "Sent", True)
            except Exception as e:
                fail_count += 1
                self.log_emitted.emit(f"Failed to send email to {client_name}: {str(e)}", "error")
                database.update_job_item(item_id, {"email_status": f"Failed: {str(e)[:40]}"}, self.db_path)
                self.item_completed.emit(item_id, f"Failed: {str(e)[:40]}", False)
                
            self.email_progress.emit(idx + 1, total)
            
            # Brief sleep to avoid rate limits or smtp blocking
            QThread.msleep(100)
            
        self.finished_all.emit(success_count, fail_count)

class BulkEmailDialog(QDialog):
    def __init__(self, job_items, db_path=None, parent=None):
        super().__init__(parent)
        self.job_items = job_items
        self.db_path = db_path
        self.worker = None
        self.setWindowTitle("Sending Bulk Emails")
        self.resize(500, 350)
        self.setModal(True)
        self.setup_ui()
        
    def setup_ui(self):
        layout = QVBoxLayout(self)
        
        self.lbl_status = QLabel("Initializing email delivery...")
        layout.addWidget(self.lbl_status)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)
        
        self.txt_logs = QTextEdit()
        self.txt_logs.setReadOnly(True)
        self.txt_logs.setStyleSheet("QTextEdit { background-color: #121317; border: 1px solid #2d3139; color: #a0aec0; font-family: monospace; font-size: 11px; }")
        layout.addWidget(self.txt_logs)
        
        btn_layout = QHBoxLayout()
        self.btn_cancel = QPushButton("Cancel Delivery")
        self.btn_cancel.setObjectName("DangerBtn")
        self.btn_cancel.clicked.connect(self.cancel_delivery)
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_cancel)
        layout.addLayout(btn_layout)
        
        # Start Worker Thread
        self.worker = EmailWorker(self.job_items, self.db_path)
        self.worker.email_progress.connect(self.on_progress)
        self.worker.log_emitted.connect(self.on_log)
        self.worker.finished_all.connect(self.on_finished)
        self.worker.start()
        
    def on_progress(self, completed, total):
        self.progress_bar.setValue(int(completed * 100 / total))
        self.lbl_status.setText(f"Delivering emails: {completed} / {total} completed")
        
    def on_log(self, msg, log_type):
        if log_type == "success":
            color = "#10b981"
        elif log_type == "error":
            color = "#ef4444"
        else:
            color = "#e2e8f0"
        self.txt_logs.append(f"<font color='{color}'>{msg}</font>")
        
    def on_finished(self, success, fail):
        self.btn_cancel.setText("Close")
        self.btn_cancel.setObjectName("PrimaryBtn")
        # Apply style sheet changes
        self.btn_cancel.setStyleSheet("") 
        self.btn_cancel.clicked.disconnect(self.cancel_delivery)
        self.btn_cancel.clicked.connect(self.accept)
        
        self.lbl_status.setText(f"Finished! Sent: {success} | Failed: {fail}")
        if fail == 0:
            self.lbl_status.setStyleSheet("color: #10b981; font-weight: bold;")
        else:
            self.lbl_status.setStyleSheet("color: #f59e0b; font-weight: bold;")
            
    def cancel_delivery(self):
        if self.worker and self.worker.isRunning():
            self.btn_cancel.setEnabled(False)
            self.worker.cancel()

class ResultsScreen(QWidget):
    # Signals
    back_to_home = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.batch_id = 0
        self.job_items = []
        self.setup_ui()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(30, 30, 30, 30)
        
        # --- HEADER ---
        header_layout = QHBoxLayout()
        title_layout = QVBoxLayout()
        title = QLabel("Processing Results")
        title.setObjectName("ScreenTitle")
        self.lbl_subtitle = QLabel("Details of processed batch files. View documents or distribute via email.")
        self.lbl_subtitle.setObjectName("ScreenSubtitle")
        title_layout.addWidget(title)
        title_layout.addWidget(self.lbl_subtitle)
        header_layout.addLayout(title_layout)
        
        # Header actions
        self.btn_open_dir = QPushButton("Open Output Folder")
        self.btn_open_dir.clicked.connect(self.open_output_dir)
        
        self.btn_email_all = QPushButton("Email All Reports")
        self.btn_email_all.setObjectName("SuccessBtn")
        self.btn_email_all.clicked.connect(self.bulk_email_all)
        
        header_layout.addWidget(self.btn_open_dir)
        header_layout.addWidget(self.btn_email_all)
        main_layout.addLayout(header_layout)
        
        # --- RESULTS CARD ---
        results_card = QFrame()
        results_card.setObjectName("Card")
        grid_layout = QVBoxLayout(results_card)
        grid_layout.setSpacing(12)
        
        # Table of results
        self.table = QTableWidget()
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels([
            "Client Name", "Valuation (INR)", "Fee (INR)", 
            "GST (INR)", "Total (INR)", "Status", "Email Status", "Actions"
        ])
        
        # Style
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.Stretch)
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents) # Name
        header.setSectionResizeMode(7, QHeaderView.ResizeToContents) # Actions
        
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers)
        
        grid_layout.addWidget(self.table)
        main_layout.addWidget(results_card)
        
        # --- BOTTOM ACTIONS ---
        btn_layout = QHBoxLayout()
        self.btn_home = QPushButton("Back to Home Dashboard")
        self.btn_home.clicked.connect(self.go_home)
        btn_layout.addWidget(self.btn_home)
        btn_layout.addStretch()
        main_layout.addLayout(btn_layout)
        
    def load_batch_results(self, batch_id):
        self.batch_id = batch_id
        try:
            self.job_items = database.get_batch_items(batch_id)
            self.lbl_subtitle.setText(f"Details of processed batch #{batch_id}. Output files saved locally.")
            self.refresh_table()
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to load batch results: {e}")
            
    def refresh_table(self):
        self.table.setRowCount(0)
        self.table.setRowCount(len(self.job_items))
        
        for i, item in enumerate(self.job_items):
            # Client Name
            name_item = QTableWidgetItem(item["client_name"])
            self.table.setItem(i, 0, name_item)
            
            # Valuation
            val_item = QTableWidgetItem(f"{item['valuation']:,.2f}")
            val_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(i, 1, val_item)
            
            # Fee
            fee_item = QTableWidgetItem(f"{item['fee_amount']:,.2f}")
            fee_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(i, 2, fee_item)
            
            # GST (CGST + SGST + IGST)
            gst_val = item["cgst"] + item["sgst"] + item["igst"]
            gst_item = QTableWidgetItem(f"{gst_val:,.2f}")
            gst_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(i, 3, gst_item)
            
            # Total
            tot_item = QTableWidgetItem(f"{item['total_amount']:,.2f}")
            tot_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            tot_item.setFont(self.table.font())
            self.table.setItem(i, 4, tot_item)
            
            # Status
            status_item = QTableWidgetItem(item["status"])
            if item["status"] == "Completed":
                status_item.setForeground(Qt.green)
            else:
                status_item.setForeground(Qt.red)
            self.table.setItem(i, 5, status_item)
            
            # Email Status
            email_status_item = QTableWidgetItem(item["email_status"])
            if item["email_status"] == "Sent":
                email_status_item.setForeground(Qt.green)
            elif "Failed" in item["email_status"]:
                email_status_item.setForeground(Qt.red)
            self.table.setItem(i, 6, email_status_item)
            
            # Actions cell containing a horizontal layout of buttons
            actions_widget = QWidget()
            actions_layout = QHBoxLayout(actions_widget)
            actions_layout.setContentsMargins(2, 2, 2, 2)
            actions_layout.setSpacing(4)
            
            if item["status"] == "Completed":
                btn_portfolio = QPushButton("Report")
                btn_portfolio.setStyleSheet("padding: 4px 8px; font-size: 11px;")
                btn_portfolio.clicked.connect(lambda checked=False, path=item["portfolio_pdf_path"]: self.preview_pdf(path))
                actions_layout.addWidget(btn_portfolio)
                
                btn_invoice = QPushButton("Invoice")
                btn_invoice.setStyleSheet("padding: 4px 8px; font-size: 11px;")
                btn_invoice.clicked.connect(lambda checked=False, path=item["invoice_pdf_path"]: self.preview_pdf(path))
                actions_layout.addWidget(btn_invoice)
                
                btn_email = QPushButton("Email")
                btn_email.setStyleSheet("padding: 4px 8px; font-size: 11px; background-color: #3b82f6; border: none; color: white;")
                btn_email.clicked.connect(lambda checked=False, idx=i: self.send_single_email(idx))
                actions_layout.addWidget(btn_email)
            else:
                # If failed, show error message detail button
                btn_error = QPushButton("Show Error")
                btn_error.setStyleSheet("padding: 4px 8px; font-size: 11px; color: #ef4444;")
                btn_error.clicked.connect(lambda checked=False, msg=item["error_msg"]: QMessageBox.warning(self, "Error Details", msg))
                actions_layout.addWidget(btn_error)
                
            self.table.setCellWidget(i, 7, actions_widget)
            
    def preview_pdf(self, path):
        if not path or not os.path.exists(path):
            QMessageBox.critical(self, "File Not Found", "The PDF document could not be located on the local disk.")
            return
            
        dialog = PDFViewerDialog(path, self)
        dialog.exec()
        
    def send_single_email(self, idx):
        if idx < 0 or idx >= len(self.job_items):
            return
            
        item = self.job_items[idx]
        
        # Confirm sending
        reply = QMessageBox.question(
            self, "Send Email", 
            f"Are you sure you want to email the reports to {item['client_name']}?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes
        )
        if reply == QMessageBox.No:
            return
            
        # We can run the single send inside a simple dialog or just block UI for a second since it's just one email.
        # But to be robust, let's trigger BulkEmailDialog passing just a list containing this single item!
        # This keeps the code clean and prevents freezing the main thread.
        dialog = BulkEmailDialog([item], parent=self)
        dialog.exec()
        
        # Refresh batches & list
        self.load_batch_results(self.batch_id)
        
    def bulk_email_all(self):
        # Extract all completed items in this batch
        completed_items = [item for item in self.job_items if item["status"] == "Completed"]
        
        if not completed_items:
            QMessageBox.information(self, "No Files to Email", "There are no successfully processed items in this batch to email.")
            return
            
        reply = QMessageBox.question(
            self, "Bulk Email Deliver",
            f"This will email reports and invoices to {len(completed_items)} client(s) in the background. Proceed?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.Yes
        )
        if reply == QMessageBox.No:
            return
            
        dialog = BulkEmailDialog(completed_items, parent=self)
        dialog.exec()
        
        # Refresh batch items
        self.load_batch_results(self.batch_id)
        
    def open_output_dir(self):
        # Find the first item to get the pdf path folder, or use batch folder + /pdf
        if self.job_items:
            # Get folder containing the PDF files
            first_path = self.job_items[0]["invoice_pdf_path"] or self.job_items[0]["portfolio_pdf_path"]
            if first_path:
                pdf_dir = os.path.dirname(first_path)
                if os.path.exists(pdf_dir):
                    try:
                        os.startfile(pdf_dir)
                        return
                    except:
                        pass
        # Fallback: open parent batch folder pdf subdirectory
        try:
            batch = database.get_recent_batches(10)[0] # Just open the current batch
            pdf_dir = os.path.join(batch["folder_path"], "pdf")
            if os.path.exists(pdf_dir):
                os.startfile(pdf_dir)
            else:
                QMessageBox.warning(self, "Not Found", "PDF folder does not exist yet.")
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to open output directory: {e}")
            
    def go_home(self):
        self.back_to_home.emit()
