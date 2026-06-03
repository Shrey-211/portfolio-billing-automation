import os
import sys
import threading
import time
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tkinter as tk
from tkinter import filedialog

import backend.database as database
import backend.processing as processing
import backend.email_service as email_service

app = FastAPI(title="Portfolio Billing API")

# Enable CORS for React development (port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global processing states
PROGRESS_STATE = {
    "running": False,
    "total": 0,
    "completed": 0,
    "failed": 0,
    "status": "Idle",
    "active_file": "",
    "logs": [],
    "batch_id": None
}

EMAIL_STATE = {
    "running": False,
    "total": 0,
    "completed": 0,
    "failed": 0,
    "logs": []
}

class SettingsUpdate(BaseModel):
    settings: Dict[str, str]

class FeeRule(BaseModel):
    min_value: float
    max_value: float
    percentage: float
    flat_rate: float = 0.0

class FeeRulesUpdate(BaseModel):
    rules: List[FeeRule]

class ClientUpdate(BaseModel):
    client_name: str
    client_type: str
    state: str
    email: str
    cc_email: str = ""
    address: str = ""
    gstin: str = ""

class FileItemToProcess(BaseModel):
    filename: str
    client_name: str
    client_type: str
    state: str
    email: str
    cc_email: str = ""
    address: str = ""
    gstin: str = ""
    valuation: float

class BatchProcessRequest(BaseModel):
    folder_path: str
    items: List[FileItemToProcess]

class EmailSendRequest(BaseModel):
    item_ids: List[int]

def log_progress(msg: str, log_type: str = "info"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    PROGRESS_STATE["logs"].append({
        "timestamp": timestamp,
        "message": msg,
        "type": log_type
    })

# --- SETTINGS ENDPOINTS ---
@app.get("/api/settings")
def get_settings():
    return database.get_all_settings()

@app.post("/api/settings")
def update_settings(payload: SettingsUpdate):
    try:
        database.save_all_settings(payload.settings)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/settings/fee-rules")
def get_fee_rules():
    return database.get_fee_rules()

@app.post("/api/settings/fee-rules")
def update_fee_rules(payload: FeeRulesUpdate):
    try:
        rules_dict = [r.model_dump() for r in payload.rules]
        database.save_fee_rules(rules_dict)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients")
def update_client_profile(payload: ClientUpdate):
    try:
        database.save_client(payload.model_dump())
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- FOLDER DIALOG SELECT ---
@app.post("/api/folders/select")
def select_folder():
    # Native dialog runs in main thread context or separate process
    # Tkinter requires thread safety: run withdraw in a safe loop
    folder_path = ""
    try:
        # Run tkinter in a daemon-safe way
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        folder_path = filedialog.askdirectory(title="Select Portfolio Folder")
        root.destroy()
    except Exception as e:
        print(f"Error opening folder picker: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to open native picker: {e}")

    if not folder_path:
        return {"folder_path": "", "files": []}

    # Scan folder for excel files
    files = []
    try:
        for file in os.listdir(folder_path):
            if (file.endswith(".xlsx") or file.endswith(".xlsm")) and not file.startswith("~$"):
                fp = os.path.join(folder_path, file)
                
                # Fetch metadata
                meta = processing.get_client_metadata(fp)
                if not meta:
                    base = os.path.splitext(file)[0]
                    meta = {
                        "client_name": base.replace("_", " ").replace("-", " "),
                        "client_type": "Type 1",
                        "state": "Maharashtra",
                        "email": "",
                        "cc_email": "",
                        "address": "",
                        "gstin": "",
                        "valuation": 0.0
                    }
                
                # Cached DB check
                cached = database.get_client(meta["client_name"])
                if cached:
                    for k in ["client_type", "state", "email", "cc_email", "address", "gstin"]:
                        if not meta.get(k) and cached.get(k):
                            meta[k] = cached[k]
                            
                meta["filename"] = fp
                meta["status"] = "Pending"
                files.append(meta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scanning folder: {e}")

    return {"folder_path": os.path.normpath(folder_path), "files": files}

# --- BATCH RUN PROCESSOR ---
def run_batch_thread(folder_path: str, items: List[Dict[str, Any]]):
    global PROGRESS_STATE
    total = len(items)
    completed = 0
    failed = 0
    
    PROGRESS_STATE["running"] = True
    PROGRESS_STATE["total"] = total
    PROGRESS_STATE["completed"] = 0
    PROGRESS_STATE["failed"] = 0
    PROGRESS_STATE["status"] = "Running"
    PROGRESS_STATE["logs"] = []
    
    log_progress("Starting batch billing automation run...", "info")
    
    # 1. Create Batch
    try:
        batch_id = database.create_batch(folder_path, total)
        PROGRESS_STATE["batch_id"] = batch_id
        log_progress(f"Created batch record #{batch_id} in SQLite database.", "info")
    except Exception as e:
        log_progress(f"DB Batch logging failed: {e}", "error")
        batch_id = 0
        
    pdf_dir = os.path.join(folder_path, "pdf")
    os.makedirs(pdf_dir, exist_ok=True)
    static_xlsx_dir = os.path.join(pdf_dir, "processed_xlsx")
    os.makedirs(static_xlsx_dir, exist_ok=True)
    
    settings = database.get_all_settings()
    fee_rules = database.get_fee_rules()
    
    fee_type = settings.get("fee_calculation_type", "flat")
    gst_rates = {
        "gst_rate_cgst": settings.get("gst_rate_cgst", "9.0"),
        "gst_rate_sgst": settings.get("gst_rate_sgst", "9.0"),
        "gst_rate_igst": settings.get("gst_rate_igst", "18.0"),
    }
    invoice_prefix = settings.get("invoice_prefix", "INV-2026-")
    try:
        next_inv_num = int(settings.get("next_invoice_number", "1"))
    except:
        next_inv_num = 1
        
    log_progress(f"Configurations loaded. Fee engine mode: {fee_type.upper()}.", "info")
    
    for idx, item in enumerate(items):
        if not PROGRESS_STATE["running"]:
            log_progress("Batch run cancelled by user.", "warning")
            if batch_id > 0:
                database.update_batch(batch_id, completed, failed, "Cancelled")
            return
            
        filename_full = item["filename"]
        client_name = item["client_name"]
        filename_base = os.path.basename(filename_full)
        
        PROGRESS_STATE["active_file"] = f"{client_name} ({filename_base})"
        log_progress(f"[{idx+1}/{total}] Processing client: {client_name}", "info")
        
        safe_client_name = "".join([c for c in client_name if c.isalnum() or c in (" ", "_", "-")]).strip().replace(" ", "_")
        flat_excel_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Processed.xlsx")
        portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Portfolio.pdf")
        invoice_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Invoice.pdf")
        
        error_msg = ""
        success = False
        
        valuation = item["valuation"]
        fee_amount = 0.0
        cgst, sgst, igst, total_amount = 0.0, 0.0, 0.0, 0.0
        
        try:
            # Cleansing
            log_progress(" Cleansing excel formulas...", "debug")
            processing.cleanse_formulas(filename_full, flat_excel_path)
            
            # Fee
            fee_amount = processing.calculate_fees(valuation, fee_rules, fee_type)
            log_progress(f" Fee amount calculated: INR {fee_amount:,.2f}", "debug")
            
            # GST
            state = item["state"]
            gst_calc = processing.calculate_gst(fee_amount, state, gst_rates)
            cgst = gst_calc["cgst"]
            sgst = gst_calc["sgst"]
            igst = gst_calc["igst"]
            total_amount = gst_calc["total_amount"]
            
            # PDF Portfolio
            log_progress(" Converting portfolio worksheets to PDF...", "debug")
            processing.convert_excel_to_pdf(flat_excel_path, portfolio_pdf_path)
            
            # PDF Invoice
            log_progress(" Rendering tax invoice document...", "debug")
            invoice_code = f"{invoice_prefix}{next_inv_num:04d}"
            today_str = datetime.today().strftime('%d-%b-%Y')
            invoice_data = {
                "invoice_number": invoice_code,
                "date": today_str,
                "client_name": client_name,
                "client_address": item["address"],
                "client_state": state,
                "client_gstin": item["gstin"],
                "valuation": valuation,
                "fee_amount": fee_amount,
                "cgst": cgst,
                "sgst": sgst,
                "igst": igst,
                "total_amount": total_amount
            }
            processing.generate_invoice_pdf(invoice_pdf_path, invoice_data, settings)
            
            next_inv_num += 1
            success = True
            completed += 1
            log_progress(f"Successfully generated files for {client_name}.", "success")
        except Exception as ex:
            failed += 1
            success = False
            error_msg = str(ex)
            log_progress(f"Failed processing {client_name}: {error_msg}", "error")
            
        # Write job item
        if batch_id > 0:
            try:
                db_item = {
                    "batch_id": batch_id,
                    "filename": filename_base,
                    "client_name": client_name,
                    "valuation": valuation,
                    "fee_amount": fee_amount,
                    "cgst": cgst,
                    "sgst": sgst,
                    "igst": igst,
                    "total_amount": total_amount,
                    "status": "Completed" if success else "Failed",
                    "error_msg": error_msg if not success else "",
                    "portfolio_pdf_path": portfolio_pdf_path if success else "",
                    "invoice_pdf_path": invoice_pdf_path if success else "",
                    "email_status": "Pending"
                }
                database.add_job_item(db_item)
            except Exception as db_ex:
                log_progress(f"Database logging error: {db_ex}", "error")
                
        PROGRESS_STATE["completed"] = completed
        PROGRESS_STATE["failed"] = failed
        
    log_progress(f"Batch completed! Successful: {completed} | Failed: {failed}", "info")
    
    if batch_id > 0:
        try:
            database.save_setting("next_invoice_number", next_inv_num)
            batch_status = "Completed" if failed == 0 else ("Failed" if completed == 0 else "Partially Completed")
            database.update_batch(batch_id, completed, failed, batch_status)
        except Exception as db_ex:
            log_progress(f"DB finalize error: {db_ex}", "error")
            
    PROGRESS_STATE["running"] = False
    PROGRESS_STATE["status"] = "Completed"

@app.post("/api/batch/process")
def start_batch_processing(payload: BatchProcessRequest, background_tasks: BackgroundTasks):
    global PROGRESS_STATE
    if PROGRESS_STATE["running"]:
        raise HTTPException(status_code=400, detail="A batch job is already running.")
        
    items_dict = [item.model_dump() for item in payload.items]
    PROGRESS_STATE = {
        "running": True,
        "total": len(items_dict),
        "completed": 0,
        "failed": 0,
        "status": "Starting",
        "active_file": "",
        "logs": [],
        "batch_id": None
    }
    background_tasks.add_task(run_batch_thread, payload.folder_path, items_dict)
    return {"status": "started"}

@app.get("/api/batch/progress")
def get_batch_progress():
    return PROGRESS_STATE

@app.post("/api/batch/cancel")
def cancel_batch_processing():
    global PROGRESS_STATE
    if PROGRESS_STATE["running"]:
        PROGRESS_STATE["running"] = False
        return {"status": "cancelling"}
    return {"status": "not running"}

# --- RESULTS HISTORY ---
@app.get("/api/batch/recent")
def get_recent_batches():
    return database.get_recent_batches(10)

@app.get("/api/batch/{batch_id}/results")
def get_batch_results(batch_id: int):
    return database.get_batch_items(batch_id)

@app.post("/api/pdf/open")
def open_pdf_document(payload: Dict[str, str]):
    path = payload.get("path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        os.startfile(path)
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/folders/open")
def open_folder_directory(payload: Dict[str, str]):
    path = payload.get("path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Directory not found")
    try:
        os.startfile(path)
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BULK EMAIL DELIVER ---
def run_email_thread(item_ids: List[int]):
    global EMAIL_STATE
    EMAIL_STATE["running"] = True
    EMAIL_STATE["logs"] = []
    EMAIL_STATE["total"] = len(item_ids)
    EMAIL_STATE["completed"] = 0
    EMAIL_STATE["failed"] = 0
    
    settings = database.get_all_settings()
    subject_template = settings.get("email_subject_template", "Portfolio Report & Invoice")
    body_template = settings.get("email_body_template", "Dear {ClientName},\n...")
    
    # Retrieve job items
    # For simplicity, we can fetch items from DB using SQL queries
    conn = database.get_db_connection()
    cursor = conn.cursor()
    
    for idx, item_id in enumerate(item_ids):
        if not EMAIL_STATE["running"]:
            EMAIL_STATE["logs"].append("Delivery cancelled by user.")
            break
            
        cursor.execute("SELECT * FROM job_items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            EMAIL_STATE["failed"] += 1
            EMAIL_STATE["logs"].append(f"Item #{item_id} not found in DB.")
            continue
            
        item = dict(row)
        client_name = item["client_name"]
        
        # Load registry detail
        client_info = database.get_client(client_name)
        if not client_info:
            client_info = {
                "client_name": client_name,
                "email": item.get("email", ""),
                "cc_email": item.get("cc_email", ""),
            }
            
        to_email = client_info.get("email")
        if not to_email:
            EMAIL_STATE["failed"] += 1
            EMAIL_STATE["logs"].append(f"Failed {client_name}: Email missing.")
            database.update_job_item(item_id, {"email_status": "Failed: No Email"})
            EMAIL_STATE["completed"] += 1
            continue
            
        EMAIL_STATE["logs"].append(f"Delivering email to {client_name} ({to_email})...")
        
        attachments = []
        if item["portfolio_pdf_path"] and os.path.exists(item["portfolio_pdf_path"]):
            attachments.append(item["portfolio_pdf_path"])
        if item["invoice_pdf_path"] and os.path.exists(item["invoice_pdf_path"]):
            attachments.append(item["invoice_pdf_path"])
            
        if not attachments:
            EMAIL_STATE["failed"] += 1
            EMAIL_STATE["logs"].append(f"Failed {client_name}: Documents missing.")
            database.update_job_item(item_id, {"email_status": "Failed: Missing Docs"})
            EMAIL_STATE["completed"] += 1
            continue
            
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
                display_outlook=False
            )
            EMAIL_STATE["completed"] += 1
            EMAIL_STATE["logs"].append(f"Success: Sent reports to {client_name}.")
            database.update_job_item(item_id, {"email_status": "Sent"})
        except Exception as e:
            EMAIL_STATE["failed"] += 1
            EMAIL_STATE["logs"].append(f"Failed {client_name}: {e}")
            database.update_job_item(item_id, {"email_status": f"Failed: {str(e)[:40]}"})
            
    conn.close()
    EMAIL_STATE["running"] = False

@app.post("/api/email/send")
def send_bulk_emails(payload: EmailSendRequest, background_tasks: BackgroundTasks):
    global EMAIL_STATE
    if EMAIL_STATE["running"]:
        raise HTTPException(status_code=400, detail="Email sender is busy.")
    background_tasks.add_task(run_email_thread, payload.item_ids)
    return {"status": "started"}

@app.get("/api/email/progress")
def get_email_progress():
    return EMAIL_STATE

# --- STATIC FILES MOUNT ---
# In production, we mount the frontend/dist directory to serve React SPA assets.
base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
dist_dir = os.path.normpath(os.path.join(base_dir, "frontend", "dist"))

# Mount if the directory exists (it will exist after npm run build)
if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
else:
    print(f"Warning: React static distribution folder not found at {dist_dir}. Serving API only.")

