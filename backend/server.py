import os
import sys
import threading
import time
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import tkinter as tk
from tkinter import filedialog

import backend.database as database
import backend.processing as processing
import backend.email_service as email_service

UPLOAD_DIR = os.path.join(os.path.expanduser("~"), ".portfolio_billing", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Portfolio Billing API")

# Enable CORS for React development (port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread locks for safe progress updates
PROGRESS_LOCK = threading.Lock()
EMAIL_LOCK = threading.Lock()

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
    is_regular: bool = True
    custom_message: str = ""
    matched_sheet: Optional[str] = None
    fee_amount: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0
    invoice_number: Optional[str] = ""
    rate: Optional[float] = 0.0
    particulars: Optional[str] = ""
    period_start: Optional[str] = ""
    period_end: Optional[str] = ""

class BatchProcessRequest(BaseModel):
    folder_path: str
    items: List[FileItemToProcess]
    import_mode: str = "folder"
    quarter: Optional[str] = None
    sheet_type: Optional[str] = "example_1"

class EmailSendRequest(BaseModel):
    item_ids: List[int]

class CustomEmailRequest(BaseModel):
    client_name: str
    recipient: str
    cc: Optional[str] = ""
    subject: str
    body: str
    attachments: List[str]
    email_type: str = "custom"
    item_id: Optional[int] = None


def log_progress(msg: str, log_type: str = "info"):
    timestamp = datetime.now().strftime("%H:%M:%S")
    with PROGRESS_LOCK:
        PROGRESS_STATE["logs"].append({
            "timestamp": timestamp,
            "message": msg,
            "type": log_type
        })

def open_system_path(path: str):
    """Cross-platform launcher for files and folders."""
    if not path or not os.path.exists(path):
        raise FileNotFoundError(f"Path not found: {path}")
    if sys.platform == 'win32':
        os.startfile(path)
    elif sys.platform == 'darwin':
        subprocess.run(['open', path], check=False)
    else:
        subprocess.run(['xdg-open', path], check=False)

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
        data = payload.model_dump()
        data["cc_email"] = ""
        database.save_client(data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/all")
def get_all_clients_with_stats():
    try:
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT 
            COALESCE(c.id, -1) as id,
            COALESCE(c.client_name, j.client_name) as client_name,
            COALESCE(c.client_type, 'Type 1') as client_type,
            COALESCE(c.state, 'Maharashtra') as state,
            COALESCE(c.email, '') as email,
            COALESCE(c.cc_email, '') as cc_email,
            COALESCE(c.address, '') as address,
            COALESCE(c.gstin, '') as gstin,
            COUNT(j.id) as invoice_count,
            MAX(b.timestamp) as latest_activity
        FROM job_items j
        LEFT JOIN clients c ON j.client_name = c.client_name
        LEFT JOIN batches b ON j.batch_id = b.id
        GROUP BY j.client_name

        UNION

        SELECT 
            c.id,
            c.client_name,
            c.client_type,
            c.state,
            c.email,
            c.cc_email,
            c.address,
            c.gstin,
            0 as invoice_count,
            NULL as latest_activity
        FROM clients c
        WHERE c.client_name NOT IN (SELECT DISTINCT client_name FROM job_items)
        ORDER BY client_name ASC
        """)
        clients_list = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return clients_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_name}")
def get_client_by_name(client_name: str):
    try:
        client = database.get_client(client_name)
        if not client:
            return {
                "client_name": client_name,
                "client_type": "Type 1",
                "state": "Maharashtra",
                "email": "",
                "cc_email": "",
                "address": "",
                "gstin": ""
            }
        return client
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- NATIVE SUBPROCESS DIALOG HELPERS ---
def pick_folder_native(title="Select Portfolio Folder") -> str:
    """Opens a native folder dialog in an isolated process to prevent AnyIO/asyncio thread deadlocks."""
    if not getattr(sys, 'frozen', False):
        script = (
            "import sys, os, tkinter as tk\n"
            "from tkinter import filedialog\n"
            "try:\n"
            "    root = tk.Tk()\n"
            "    root.withdraw()\n"
            "    root.attributes('-topmost', True)\n"
            "    root.lift()\n"
            "    root.focus_force()\n"
            f"    p = filedialog.askdirectory(title='{title}')\n"
            "    root.destroy()\n"
            "    if p: print(p.strip())\n"
            "except Exception:\n"
            "    pass\n"
        )
        try:
            res = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=60)
            val = res.stdout.strip()
            if val and os.path.isdir(val):
                return val
        except Exception as e:
            print(f"Subprocess folder picker error: {e}")

    # PowerShell Shell.Application fallback (always available on Windows)
    ps_cmd = (
        "$app = New-Object -ComObject Shell.Application; "
        f"$folder = $app.BrowseForFolder(0, '{title}', 0, 0); "
        "if ($folder) { $folder.Self.Path }"
    )
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=60)
        val = res.stdout.strip()
        if val and os.path.isdir(val):
            return val
    except Exception as e:
        print(f"PowerShell folder picker error: {e}")

    return ""

def pick_file_native(title="Select Billing Excel Sheet") -> str:
    """Opens a native file dialog in an isolated process to prevent AnyIO/asyncio thread deadlocks."""
    if not getattr(sys, 'frozen', False):
        script = (
            "import sys, os, tkinter as tk\n"
            "from tkinter import filedialog\n"
            "try:\n"
            "    root = tk.Tk()\n"
            "    root.withdraw()\n"
            "    root.attributes('-topmost', True)\n"
            "    root.lift()\n"
            "    root.focus_force()\n"
            f"    p = filedialog.askopenfilename(title='{title}', filetypes=[('Excel Files', '*.xlsx *.xlsm')])\n"
            "    root.destroy()\n"
            "    if p: print(p.strip())\n"
            "except Exception:\n"
            "    pass\n"
        )
        try:
            res = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=60)
            val = res.stdout.strip()
            if val and os.path.isfile(val):
                return val
        except Exception as e:
            print(f"Subprocess file picker error: {e}")

    # PowerShell OpenFileDialog fallback
    ps_cmd = (
        "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; "
        "$f = New-Object System.Windows.Forms.OpenFileDialog; "
        f"$f.Title = '{title}'; "
        "$f.Filter = 'Excel Files (*.xlsx;*.xlsm)|*.xlsx;*.xlsm|All Files (*.*)|*.*'; "
        "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }"
    )
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=60)
        val = res.stdout.strip()
        if val and os.path.isfile(val):
            return val
    except Exception as e:
        print(f"PowerShell file picker error: {e}")

    return ""

def scan_folder_files(folder_path: str):
    if not folder_path or not os.path.exists(folder_path):
        return {"folder_path": "", "files": []}

    files = []
    try:
        for file in os.listdir(folder_path):
            if (file.endswith(".xlsx") or file.endswith(".xlsm")) and not file.startswith("~$"):
                fp = os.path.join(folder_path, file)
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

class FolderScanRequest(BaseModel):
    folder_path: str

@app.post("/api/folders/scan")
def api_scan_folder(req: FolderScanRequest):
    if not req.folder_path or not os.path.exists(req.folder_path):
        raise HTTPException(status_code=400, detail=f"Folder not found: {req.folder_path}")
    return scan_folder_files(req.folder_path)

@app.post("/api/folders/select")
def select_folder():
    folder_path = pick_folder_native("Select Portfolio Folder")
    if not folder_path:
        return {"folder_path": "", "files": []}
    return scan_folder_files(folder_path)

@app.post("/api/folders/upload")
async def upload_folder_files(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_dir = os.path.join(UPLOAD_DIR, f"folder_{timestamp}")
    os.makedirs(batch_dir, exist_ok=True)
    
    saved_count = 0
    for f in files:
        fname = os.path.basename(f.filename or "")
        if (fname.lower().endswith(".xlsx") or fname.lower().endswith(".xlsm")) and not fname.startswith("~$"):
            dest = os.path.join(batch_dir, fname)
            contents = await f.read()
            with open(dest, "wb") as out_f:
                out_f.write(contents)
            saved_count += 1
            
    if saved_count == 0:
        raise HTTPException(status_code=400, detail="No valid .xlsx or .xlsm portfolio files found in selection.")
        
    return scan_folder_files(batch_dir)

def apply_ui_overrides_to_excel(excel_path, item):
    import openpyxl
    try:
        wb = openpyxl.load_workbook(excel_path, data_only=False)
        master_sheet = processing.find_master_sheet_name(wb.sheetnames)
        if master_sheet:
            ws = wb[master_sheet]
            header_row, cols = processing.get_master_sheet_mapping(ws)
            if header_row is None:
                wb.close()
                return False
            
            target_row = None
            client_name_key = str(item["client_name"]).strip()
            col_name_idx = processing.get_mapped_col(cols, ["client_name", "name_of_client"], 3)
            
            for r in range(header_row + 1, ws.max_row + 1):
                cell_val = ws.cell(row=r, column=col_name_idx).value
                if cell_val and str(cell_val).strip().lower() == client_name_key.lower():
                    target_row = r
                    break
            
            if target_row:
                col_val_idx = processing.get_mapped_col(cols, ["value", "valuation", "value_of_shares", "aum"])
                if col_val_idx:
                    ws.cell(row=target_row, column=col_val_idx).value = float(item["valuation"])
                
                col_addr_idx = processing.get_mapped_col(cols, ["address_1", "address"])
                if col_addr_idx:
                    ws.cell(row=target_row, column=col_addr_idx).value = item["address"]
                
                state_val = item["state"]
                col_state_idx = processing.get_mapped_col(cols, ["state"])
                if col_state_idx:
                    ws.cell(row=target_row, column=col_state_idx).value = state_val
                
                col_email_idx = processing.get_mapped_col(cols, ["client_email_id", "email"])
                if col_email_idx:
                    ws.cell(row=target_row, column=col_email_idx).value = item["email"]
                
                col_inv_idx = processing.get_mapped_col(cols, ["invoice_no", "invoice_number"])
                if col_inv_idx:
                    ws.cell(row=target_row, column=col_inv_idx).value = item["invoice_number"]
                
                from openpyxl.utils import get_column_letter
                is_maharashtra = str(state_val).strip().lower() == "maharashtra"
                
                settings_db = database.get_all_settings()
                formula_template = settings_db.get("taxable_amt_formula", "Value * Rate / 4")
                cgst_pct = float(settings_db.get("gst_rate_cgst", "9.0"))
                sgst_pct = float(settings_db.get("gst_rate_sgst", "9.0"))
                igst_pct = float(settings_db.get("gst_rate_igst", "18.0"))
                
                col_rate_idx = processing.get_mapped_col(cols, ["fee_@", "rate"])
                col_taxable_idx = processing.get_mapped_col(cols, ["taxable_amt", "taxable_amount"])
                
                if col_taxable_idx and col_val_idx and col_rate_idx:
                    val_let = get_column_letter(col_val_idx)
                    rate_let = get_column_letter(col_rate_idx)
                    excel_formula = formula_template.replace("Value", f"{val_let}{target_row}").replace("Rate", f"{rate_let}{target_row}")
                    if not excel_formula.startswith("="):
                        excel_formula = "=" + excel_formula
                    ws.cell(row=target_row, column=col_taxable_idx).value = excel_formula
                
                if col_taxable_idx:
                    tax_let = get_column_letter(col_taxable_idx)
                    col_cgst_idx = processing.get_mapped_col(cols, ["cgst"])
                    col_sgst_idx = processing.get_mapped_col(cols, ["sgst"])
                    col_igst_idx = processing.get_mapped_col(cols, ["igst", "isgt"])
                    
                    if col_cgst_idx:
                        ws.cell(row=target_row, column=col_cgst_idx).value = f"={tax_let}{target_row}*{cgst_pct}%" if is_maharashtra else 0
                    if col_sgst_idx:
                        ws.cell(row=target_row, column=col_sgst_idx).value = f"={tax_let}{target_row}*{sgst_pct}%" if is_maharashtra else 0
                    if col_igst_idx:
                        ws.cell(row=target_row, column=col_igst_idx).value = 0 if is_maharashtra else f"={tax_let}{target_row}*{igst_pct}%"
                    
                    col_total_idx = processing.get_mapped_col(cols, ["total", "total_inv_amt", "total_amount"])
                    if col_total_idx:
                        cgst_let = get_column_letter(col_cgst_idx) if col_cgst_idx else ""
                        sgst_let = get_column_letter(col_sgst_idx) if col_sgst_idx else ""
                        igst_let = get_column_letter(col_igst_idx) if col_igst_idx else ""
                        formula_parts = [f"{tax_let}{target_row}"]
                        if cgst_let: formula_parts.append(f"{cgst_let}{target_row}")
                        if sgst_let: formula_parts.append(f"{sgst_let}{target_row}")
                        if igst_let: formula_parts.append(f"{igst_let}{target_row}")
                        ws.cell(row=target_row, column=col_total_idx).value = "=" + "+".join(formula_parts)
                
                matched_sheet = item.get("matched_sheet")
                if matched_sheet and matched_sheet in wb.sheetnames:
                    ws_match = wb[matched_sheet]
                    if ws_match.max_column > 20:
                        ws_match.delete_cols(21, ws_match.max_column - 20)
                        
                    exit_row = None
                    for r in range(1, ws_match.max_row + 1):
                        cell_val = ws_match.cell(row=r, column=1).value
                        if cell_val is not None and str(cell_val).strip().upper() == "EXIT":
                            exit_row = r
                            break
                            
                    if exit_row is not None:
                        ws_match.delete_rows(exit_row, ws_match.max_row - exit_row + 1)
                            
                wb.save(excel_path)
                wb.close()
                return True
        wb.close()
    except Exception as e:
        print(f"Error applying overrides to Excel: {e}")
    return False

def read_calculated_values_from_excel(excel_path, client_name):
    import openpyxl
    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        master_sheet = processing.find_master_sheet_name(wb.sheetnames)
        if master_sheet:
            ws = wb[master_sheet]
            header_row, cols = processing.get_master_sheet_mapping(ws)
            if header_row is None:
                wb.close()
                return None
            
            col_name_idx = processing.get_mapped_col(cols, ["client_name", "name_of_client"], 3)
            for r in range(header_row + 1, ws.max_row + 1):
                cell_val = ws.cell(row=r, column=col_name_idx).value
                if cell_val and str(cell_val).strip().lower() == str(client_name).strip().lower():
                    col_taxable_idx = processing.get_mapped_col(cols, ["taxable_amt", "taxable_amount"], 17)
                    col_cgst_idx = processing.get_mapped_col(cols, ["cgst"], 18)
                    col_sgst_idx = processing.get_mapped_col(cols, ["sgst"], 19)
                    col_igst_idx = processing.get_mapped_col(cols, ["igst", "isgt"], 20)
                    col_total_idx = processing.get_mapped_col(cols, ["total", "total_inv_amt", "total_amount"], 21)
                    col_inv_idx = processing.get_mapped_col(cols, ["invoice_no", "invoice_number"], 5)
                    try:
                        fee_amount = round(float(ws.cell(row=r, column=col_taxable_idx).value or 0.0), 2)
                    except:
                        fee_amount = 0.0
                    try:
                        cgst = round(float(ws.cell(row=r, column=col_cgst_idx).value or 0.0), 2)
                    except:
                        cgst = 0.0
                    try:
                        sgst = round(float(ws.cell(row=r, column=col_sgst_idx).value or 0.0), 2)
                    except:
                        sgst = 0.0
                    try:
                        igst = round(float(ws.cell(row=r, column=col_igst_idx).value or 0.0), 2)
                    except:
                        igst = 0.0
                    try:
                        total_amount = round(float(ws.cell(row=r, column=col_total_idx).value or 0.0), 2)
                    except:
                        total_amount = 0.0
                        
                    res = {
                        "fee_amount": fee_amount,
                        "cgst": cgst,
                        "sgst": sgst,
                        "igst": igst,
                        "total_amount": total_amount,
                        "invoice_number": str(ws.cell(row=r, column=col_inv_idx).value or "").strip()
                    }
                    wb.close()
                    return res
        wb.close()
    except Exception as e:
        print(f"Error reading calculated values: {e}")
    return None

# --- BATCH RUN PROCESSOR ---
def run_batch_thread(folder_path: str, items: List[Dict[str, Any]], import_mode: str = "folder", quarter: Optional[str] = None, sheet_type: str = "example_1"):
    global PROGRESS_STATE
    total = len(items)
    completed = 0
    failed = 0
    
    with PROGRESS_LOCK:
        PROGRESS_STATE["running"] = True
        PROGRESS_STATE["total"] = total
        PROGRESS_STATE["completed"] = 0
        PROGRESS_STATE["failed"] = 0
        PROGRESS_STATE["status"] = "Running"
        PROGRESS_STATE["logs"] = []
    
    log_progress("Starting batch billing automation run...", "info")
    
    try:
        batch_id = database.create_batch(folder_path, total, quarter=quarter)
        with PROGRESS_LOCK:
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
    except Exception:
        next_inv_num = 1
        
    log_progress(f"Configurations loaded. Fee engine mode: {fee_type.upper()}.", "info")

    # Persistent Excel COM session for batch performance
    excel_app = None
    if processing.EXCEL_AVAILABLE:
        try:
            import win32com.client
            import pythoncom
            pythoncom.CoInitialize()
            excel_app = win32com.client.DispatchEx("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            log_progress("Connected to Microsoft Excel COM automation engine.", "debug")
        except Exception as com_err:
            log_progress(f"Notice: Excel COM session init: {com_err}. Running in ReportLab mode.", "warning")
            excel_app = None

    master_xlsx_copy = ""
    if import_mode == "sheet" and items:
        import shutil
        first_item_filename = items[0]["filename"]
        master_xlsx_copy = os.path.join(static_xlsx_dir, "Master_Processed.xlsx")
        try:
            shutil.copy2(first_item_filename, master_xlsx_copy)
            log_progress(f"Created working copy of master billing sheet: {os.path.basename(master_xlsx_copy)}", "info")
        except Exception as copy_err:
            log_progress(f"Failed to copy master sheet: {copy_err}", "error")
            master_xlsx_copy = first_item_filename
    
    # Spawn a single reusable Excel COM instance for Option A
    excel_app = None
    if processing.EXCEL_AVAILABLE:
        try:
            import pythoncom
            import win32com.client
            pythoncom.CoInitialize()
            excel_app = win32com.client.DispatchEx("Excel.Application")
            excel_app.Visible = False
            excel_app.DisplayAlerts = False
            excel_app.AskToUpdateLinks = False
            log_progress("Spawned reusable background Microsoft Excel instance for batch processing.", "info")
        except Exception as spawn_err:
            log_progress(f"Failed to spawn reusable Excel COM instance: {spawn_err}. Will fallback to spawning per-file.", "warning")
            excel_app = None

    try:
        for idx, item in enumerate(items):
            if not PROGRESS_STATE["running"]:
                log_progress("Batch run cancelled by user.", "warning")
                if batch_id > 0:
                    database.update_batch(batch_id, completed, failed, "Cancelled")
                return
                
            filename_full = item["filename"]
            client_name = item["client_name"]
            filename_base = os.path.basename(filename_full)
            is_regular = item.get("is_regular", True)
            custom_message = item.get("custom_message", "")
            
            with PROGRESS_LOCK:
                PROGRESS_STATE["active_file"] = f"{client_name} ({filename_base})"
            
            if import_mode == "sheet" and not is_regular:
                log_progress(f"[{idx+1}/{total}] Skipping non-billable client: {client_name}", "info")
                if batch_id > 0:
                    try:
                        db_item = {
                            "batch_id": batch_id,
                            "filename": filename_base,
                            "client_name": client_name,
                            "valuation": item["valuation"],
                            "fee_amount": 0.0,
                            "cgst": 0.0,
                            "sgst": 0.0,
                            "igst": 0.0,
                            "total_amount": 0.0,
                            "status": "Skipped (Not Billable)",
                            "error_msg": "",
                            "portfolio_pdf_path": "",
                            "invoice_pdf_path": "",
                            "email_status": "Skipped",
                            "custom_message": custom_message,
                            "invoice_number": ""
                        }
                        database.add_job_item(db_item)
                        try:
                            database.save_client({
                                "client_name": client_name,
                                "client_type": item.get("client_type", "Type 1"),
                                "state": item.get("state", "Maharashtra"),
                                "email": item.get("email", ""),
                                "cc_email": item.get("cc_email", ""),
                                "address": item.get("address", ""),
                                "gstin": item.get("gstin", "")
                            })
                        except Exception as db_cl_ex:
                            log_progress(f"Database client registry logging error: {db_cl_ex}", "error")
                    except Exception as db_ex:
                        log_progress(f"Database logging error: {db_ex}", "error")
                completed += 1
                with PROGRESS_LOCK:
                    PROGRESS_STATE["completed"] = completed
                continue
                
            log_progress(f"[{idx+1}/{total}] Processing client: {client_name}", "info")
            
            safe_client_name = "".join([c for c in client_name if c.isalnum() or c in (" ", "_", "-")]).strip().replace(" ", "_")
            flat_excel_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Processed.xlsx")
            
            matched_sheet = item.get("matched_sheet")
            individual_portfolio = processing.find_individual_portfolio_file(folder_path, client_name)
            portfolio_excel_source = individual_portfolio or processing.find_portfolio_file_in_folder(folder_path, client_name)
            portfolio_pdf_path = ""
            if portfolio_excel_source:
                portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Portfolio.pdf")
            elif import_mode == "sheet":
                if matched_sheet:
                    portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Portfolio.pdf")
            else:
                portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Portfolio.pdf")

            invoice_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Invoice.pdf")
            
            error_msg = ""
            success = False
            
            valuation = float(item.get("valuation") or 0.0)
            fee_amount = 0.0
            cgst, sgst, igst, total_amount = 0.0, 0.0, 0.0, 0.0
            invoice_code = ""
            
            try:
                if import_mode == "sheet":
                    log_progress(" Applying UI overrides to master sheet...", "debug")
                    apply_ui_overrides_to_excel(master_xlsx_copy, item)
                    
                    if individual_portfolio:
                        log_progress(f" Found individual portfolio document: {os.path.basename(individual_portfolio)}", "debug")
                        if individual_portfolio.lower().endswith(".pdf"):
                            import shutil
                            shutil.copy2(individual_portfolio, portfolio_pdf_path)
                        else:
                            cleansed_pf_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Portfolio_Clean.xlsx")
                            processing.cleanse_formulas(individual_portfolio, cleansed_pf_path)
                            processing.convert_excel_to_pdf(cleansed_pf_path, portfolio_pdf_path, excel_app=excel_app)
                    elif matched_sheet:
                        log_progress(f" Generating portfolio report from sheet: {matched_sheet}...", "debug")
                        processing.convert_excel_to_pdf(master_xlsx_copy, portfolio_pdf_path, matched_sheet, excel_app=excel_app)
                    elif portfolio_excel_source:
                        log_progress(f" Generating portfolio report from individual workbook: {os.path.basename(portfolio_excel_source)}...", "debug")
                        cleansed_pf_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Portfolio_Clean.xlsx")
                        processing.cleanse_formulas(portfolio_excel_source, cleansed_pf_path)
                        processing.convert_excel_to_pdf(cleansed_pf_path, portfolio_pdf_path, excel_app=excel_app)

                    # Check Excel availability
                    if processing.EXCEL_AVAILABLE:
                        log_progress(" Generating tax invoice from Excel template...", "debug")
                        settings_db = database.get_all_settings()
                        inv_qr = settings_db.get("invoice_qr_path", "").strip()
                        inv_cell = settings_db.get("invoice_qr_excel_cell", "G30").strip()
                        try:
                            processing.generate_invoice_pdf_via_excel(
                                master_xlsx_copy, client_name, invoice_pdf_path,
                                excel_app=excel_app, sheet_type=sheet_type,
                                invoice_qr_path=inv_qr, invoice_qr_excel_cell=inv_cell
                            )
                            calc_vals = read_calculated_values_from_excel(master_xlsx_copy, client_name)
                            if calc_vals and calc_vals["fee_amount"] > 0:
                                fee_amount = calc_vals["fee_amount"]
                                cgst = calc_vals["cgst"]
                                sgst = calc_vals["sgst"]
                                igst = calc_vals["igst"]
                                total_amount = calc_vals["total_amount"]
                                invoice_code = calc_vals["invoice_number"] or item.get("invoice_number")
                        except Exception as excel_inv_err:
                            log_progress(f" Excel COM invoice export note: {excel_inv_err}. Using ReportLab generator.", "warning")

                    # If fee was not obtained from Excel calculation, compute dynamically via formula
                    if fee_amount <= 0.0 or total_amount <= 0.0:
                        formula_tmpl = settings.get("taxable_amt_formula", "Value * Rate / 4")
                        if formula_tmpl and "Rate" in formula_tmpl and item.get("rate") is not None:
                            fee_amount = processing.calculate_formula_fee(formula_tmpl, valuation, item.get("rate", 0.0))
                        else:
                            fee_amount = item.get("fee_amount", 0.0) or processing.calculate_fees(valuation, fee_rules, fee_type)
                        gst_calc = processing.calculate_gst(fee_amount, item["state"], gst_rates)
                        cgst = gst_calc["cgst"]
                        sgst = gst_calc["sgst"]
                        igst = gst_calc["igst"]
                        total_amount = gst_calc["total_amount"]
                        
                    if not invoice_code:
                        invoice_code = item.get("invoice_number") or f"{invoice_prefix}{next_inv_num:04d}"
                        next_inv_num += 1

                    # Render ReportLab invoice if not generated via Excel COM
                    if not os.path.exists(invoice_pdf_path) or os.path.getsize(invoice_pdf_path) == 0:
                        prior_credit = database.get_client_available_credit(client_name)
                        credit_applied = min(total_amount, prior_credit)
                        invoice_data = {
                            "invoice_number": invoice_code,
                            "date": datetime.today().strftime('%d-%b-%Y'),
                            "client_name": client_name,
                            "client_address": item["address"],
                            "client_state": item["state"],
                            "client_gstin": item.get("gstin", ""),
                            "valuation": valuation,
                            "fee_amount": fee_amount,
                            "cgst": cgst,
                            "sgst": sgst,
                            "igst": igst,
                            "total_amount": total_amount,
                            "particulars": item.get("particulars", ""),
                            "rate": item.get("rate", 0.0),
                            "period_start": item.get("period_start", ""),
                            "period_end": item.get("period_end", ""),
                            "credit_applied": credit_applied,
                            "sheet_type": sheet_type
                        }
                        processing.generate_invoice_pdf(invoice_pdf_path, invoice_data, settings)
                        
                        if portfolio_excel_source and (not os.path.exists(portfolio_pdf_path) or os.path.getsize(portfolio_pdf_path) == 0):
                            cleansed_pf_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Portfolio_Clean.xlsx")
                            processing.cleanse_formulas(portfolio_excel_source, cleansed_pf_path)
                            processing.convert_excel_to_pdf_fallback(cleansed_pf_path, portfolio_pdf_path)
                        elif matched_sheet and (not os.path.exists(portfolio_pdf_path) or os.path.getsize(portfolio_pdf_path) == 0):
                            processing.convert_excel_to_pdf_fallback(master_xlsx_copy, portfolio_pdf_path, matched_sheet)

                else:
                    # Folder mode logic
                    pf_source = portfolio_excel_source or filename_full
                    log_progress(f" Cleansing portfolio excel formulas from {os.path.basename(pf_source)}...", "debug")
                    processing.cleanse_formulas(pf_source, flat_excel_path)
                    
                    log_progress(" Converting portfolio worksheets to PDF...", "debug")
                    processing.convert_excel_to_pdf(flat_excel_path, portfolio_pdf_path, excel_app=excel_app)
                    
                    fee_amount = processing.calculate_fees(valuation, fee_rules, fee_type)
                    log_progress(f" Fee amount calculated: INR {fee_amount:,.2f}", "debug")
                    
                    state = item["state"]
                    gst_calc = processing.calculate_gst(fee_amount, state, gst_rates)
                    cgst = gst_calc["cgst"]
                    sgst = gst_calc["sgst"]
                    igst = gst_calc["igst"]
                    total_amount = gst_calc["total_amount"]
                    
                    # Calculate credit applied
                    prior_credit = database.get_client_available_credit(client_name)
                    credit_applied = min(total_amount, prior_credit)
                    
                    # PDF Invoice
                    log_progress(" Rendering tax invoice document...", "debug")
                    invoice_code = f"{invoice_prefix}{next_inv_num:04d}"
                    next_inv_num += 1
                    today_str = datetime.today().strftime('%d-%b-%Y')
                    invoice_data = {
                        "invoice_number": invoice_code,
                        "date": today_str,
                        "client_name": client_name,
                        "client_address": item["address"],
                        "client_state": state,
                        "client_gstin": item.get("gstin", ""),
                        "valuation": valuation,
                        "fee_amount": fee_amount,
                        "cgst": cgst,
                        "sgst": sgst,
                        "igst": igst,
                        "total_amount": total_amount,
                        "credit_applied": credit_applied
                    }
                    processing.generate_invoice_pdf(invoice_pdf_path, invoice_data, settings)

                success = True
                completed += 1
                log_progress(f"Successfully generated billing package for {client_name}.", "success")
            except Exception as ex:
                failed += 1
                success = False
                error_msg = str(ex)
                log_progress(f"Failed processing {client_name}: {error_msg}", "error")
                
            if batch_id > 0:
                try:
                    prior_credit = database.get_client_available_credit(client_name)
                    credit_applied = min(total_amount, prior_credit)
                    is_paid_status = 1 if credit_applied >= total_amount else 0
                    payment_date_val = datetime.today().strftime('%Y-%m-%d') if credit_applied >= total_amount else None
                    
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
                        "portfolio_pdf_path": portfolio_pdf_path if success and os.path.exists(portfolio_pdf_path) else "",
                        "invoice_pdf_path": invoice_pdf_path if success and os.path.exists(invoice_pdf_path) else "",
                        "email_status": "Pending",
                        "custom_message": custom_message,
                        "invoice_number": invoice_code if success else "",
                        "credit_applied": credit_applied if success else 0.0,
                        "is_paid": is_paid_status if success else 0,
                        "payment_date": payment_date_val if success else None,
                        "cc_email": item.get("cc_email", "")
                    }
                    database.add_job_item(db_item)
                    try:
                        database.save_client({
                            "client_name": client_name,
                            "client_type": item.get("client_type", "Type 1"),
                            "state": item.get("state", "Maharashtra"),
                            "email": item.get("email", ""),
                            "cc_email": item.get("cc_email", ""),
                            "address": item.get("address", ""),
                            "gstin": item.get("gstin", "")
                        })
                    except Exception as db_cl_ex:
                        log_progress(f"Database client registry logging error: {db_cl_ex}", "error")
                except Exception as db_ex:
                    log_progress(f"Database logging error: {db_ex}", "error")
                    
            with PROGRESS_LOCK:
                PROGRESS_STATE["completed"] = completed
                PROGRESS_STATE["failed"] = failed

    finally:
        if excel_app is not None:
            try:
                excel_app.Workbooks.Close()
            except Exception:
                pass
            try:
                excel_app.Quit()
                log_progress("Closed reusable background Microsoft Excel instance.", "info")
            except Exception:
                pass
            try:
                import pythoncom
                pythoncom.CoUninitialize()
            except Exception:
                pass

    log_progress(f"Batch completed! Successful: {completed} | Failed: {failed}", "info")
    
    if batch_id > 0:
        try:
            database.save_setting("next_invoice_number", next_inv_num)
            batch_status = "Completed" if failed == 0 else ("Failed" if completed == 0 else "Partially Completed")
            database.update_batch(batch_id, completed, failed, batch_status)
        except Exception as db_ex:
            log_progress(f"DB finalize error: {db_ex}", "error")
            
    with PROGRESS_LOCK:
        PROGRESS_STATE["running"] = False
        PROGRESS_STATE["status"] = "Completed"

@app.post("/api/batch/process")
def start_batch_processing(payload: BatchProcessRequest, background_tasks: BackgroundTasks):
    global PROGRESS_STATE
    if PROGRESS_STATE["running"]:
        raise HTTPException(status_code=400, detail="A batch job is already running.")
        
    items_dict = [item.model_dump() for item in payload.items]
    with PROGRESS_LOCK:
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
    background_tasks.add_task(run_batch_thread, payload.folder_path, items_dict, payload.import_mode, payload.quarter, payload.sheet_type)
    return {"status": "started"}

@app.get("/api/batch/progress")
def get_batch_progress():
    with PROGRESS_LOCK:
        return dict(PROGRESS_STATE)

@app.post("/api/batch/cancel")
def cancel_batch_processing():
    global PROGRESS_STATE
    with PROGRESS_LOCK:
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
        open_system_path(path)
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/folders/open")
def open_folder_directory(payload: Dict[str, str]):
    path = payload.get("path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Directory not found")
    try:
        open_system_path(path)
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BULK EMAIL DISPATCH ---
def run_email_thread(item_ids: List[int]):
    global EMAIL_STATE
    with EMAIL_LOCK:
        EMAIL_STATE["running"] = True
        EMAIL_STATE["logs"] = []
        EMAIL_STATE["total"] = len(item_ids)
        EMAIL_STATE["completed"] = 0
        EMAIL_STATE["failed"] = 0
    
    settings = database.get_all_settings()
    subject_template = settings.get("email_subject_template", "Portfolio Report & Invoice - {ClientName}")
    body_template = settings.get("email_body_template", "Dear {ClientName},\n...")
    
    for idx, item_id in enumerate(item_ids):
        if not EMAIL_STATE["running"]:
            with EMAIL_LOCK:
                EMAIL_STATE["logs"].append("Delivery cancelled by user.")
            break
            
        item = database.get_job_item(item_id)
        if not item:
            with EMAIL_LOCK:
                EMAIL_STATE["failed"] += 1
                EMAIL_STATE["logs"].append(f"Item #{item_id} not found in database.")
            continue
            
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
            client_info["cc_email"] = item.get("cc_email", "")
            
        to_email = client_info.get("email")
        if not to_email:
            with EMAIL_LOCK:
                EMAIL_STATE["failed"] += 1
                EMAIL_STATE["logs"].append(f"Failed {client_name}: Recipient email is missing.")
            database.update_job_item(item_id, {"email_status": "Failed: No Email"})
            with EMAIL_LOCK:
                EMAIL_STATE["completed"] += 1
            continue
            
        with EMAIL_LOCK:
            EMAIL_STATE["logs"].append(f"Delivering email to {client_name} ({to_email})...")
        
        attachments = []
        if item["portfolio_pdf_path"] and os.path.exists(item["portfolio_pdf_path"]):
            attachments.append(item["portfolio_pdf_path"])
        if item["invoice_pdf_path"] and os.path.exists(item["invoice_pdf_path"]):
            attachments.append(item["invoice_pdf_path"])
        # Append global QR code if configured
        qr_path = settings.get("email_qr_path", "").strip()
        if qr_path and os.path.exists(qr_path):
            attachments.append(qr_path)
            
        if not attachments:
            with EMAIL_LOCK:
                EMAIL_STATE["failed"] += 1
                EMAIL_STATE["logs"].append(f"Failed {client_name}: Generated PDF documents not found on disk.")
            database.update_job_item(item_id, {"email_status": "Failed: Missing Docs"})
            with EMAIL_LOCK:
                EMAIL_STATE["completed"] += 1
            continue
            
        # Use stored invoice_number field; fall back to filename or prefix+id only if missing
        invoice_code = (item.get("invoice_number") or "").strip()
        if not invoice_code and item.get("invoice_pdf_path"):
            invoice_code = os.path.basename(item["invoice_pdf_path"]).replace("_Invoice.pdf", "")
        if not invoice_code:
            invoice_code = f"{settings.get('invoice_prefix', 'INV-')}{item_id:04d}"
            
        credit_applied_val = float(item.get("credit_applied", 0.0) or 0.0)
        custom_msg = item.get("custom_message", "") or ""
        if credit_applied_val > 0:
            credit_note = f"Note: A prior credit of INR {credit_applied_val:,.2f} has been applied to this invoice. The net amount payable is INR {max(0.0, float(item['total_amount'] or 0.0) - credit_applied_val):,.2f}."
            if custom_msg:
                custom_msg = f"{credit_note}\n\n{custom_msg}"
            else:
                custom_msg = credit_note

        invoice_details = {
            "invoice_number": invoice_code,
            "valuation": float(item["valuation"] or 0.0),
            "fee_amount": float(item["fee_amount"] or 0.0),
            "total_amount": float(item["total_amount"] or 0.0),
            "custom_message": custom_msg
        }
        
        try:
            context = {
                "ClientName": client_name,
                "InvoiceNumber": invoice_code,
                "Valuation": item["valuation"],
                "FeeAmount": item["fee_amount"],
                "TotalAmount": item["total_amount"],
                "CustomMessage": custom_msg
            }
            try:
                subject = subject_template.format(**context)
                body = body_template.format(**context)
                custom_msg = item.get("custom_message", "")
                if custom_msg and "{CustomMessage}" not in body_template:
                    if "Best Regards" in body:
                        body = body.replace("Best Regards", f"{custom_msg}\n\nBest Regards")
                    else:
                        body = f"{body}\n\n{custom_msg}"
            except:
                subject = subject_template
                body = body_template

            email_service.send_client_email(
                settings,
                client_info,
                subject_template,
                body_template,
                invoice_details,
                attachments,
                display_outlook=False
            )
            with EMAIL_LOCK:
                EMAIL_STATE["completed"] += 1
                EMAIL_STATE["logs"].append(f"Success: Dispatched documents to {client_name}.")
            database.update_job_item(item_id, {"email_status": "Sent"})
            
            import json
            database.add_email_log({
                "client_name": client_name,
                "recipient_email": to_email,
                "cc_email": client_info.get("cc_email", ""),
                "subject": subject,
                "body": body,
                "status": "Sent",
                "error_msg": "",
                "attachments": json.dumps(attachments),
                "email_type": "invoice"
            })
        except Exception as e:
            with EMAIL_LOCK:
                EMAIL_STATE["failed"] += 1
                EMAIL_STATE["logs"].append(f"Failed {client_name}: {e}")
            database.update_job_item(item_id, {"email_status": f"Failed: {str(e)[:40]}"})
            
            import json
            try:
                subj = subject
                bdy = body
            except:
                subj = subject_template
                bdy = body_template
            database.add_email_log({
                "client_name": client_name,
                "recipient_email": to_email,
                "cc_email": client_info.get("cc_email", ""),
                "subject": subj,
                "body": bdy,
                "status": "Failed",
                "error_msg": str(e),
                "attachments": json.dumps(attachments),
                "email_type": "invoice"
            })

    conn.close()
    with EMAIL_LOCK:
        EMAIL_STATE["running"] = False

@app.post("/api/email/send")
def send_bulk_emails(payload: EmailSendRequest, background_tasks: BackgroundTasks):
    global EMAIL_STATE
    if EMAIL_STATE["running"]:
        raise HTTPException(status_code=400, detail="Email sender is currently active.")
    background_tasks.add_task(run_email_thread, payload.item_ids)
    return {"status": "started"}

@app.get("/api/email/progress")
def get_email_progress():
    with EMAIL_LOCK:
        return dict(EMAIL_STATE)

@app.post("/api/email/test")
def test_email_connection(payload: Dict[str, str]):
    """
    Quick SMTP connectivity test. POST { "to_email": "..." } to send a test message
    using the currently-saved SMTP settings.
    """
    to_email = payload.get("to_email", "").strip()
    if not to_email:
        raise HTTPException(status_code=400, detail="to_email is required")
    settings = database.get_all_settings()
    try:
        email_service.send_smtp_email(
            smtp_config=settings,
            to_email=to_email,
            cc_email="",
            subject="Portfolio Billing — SMTP Test",
            body=(
                "Hello,\n\n"
                "This is a test email from the Portfolio Billing Automation system.\n"
                "If you received this, your SMTP settings are correctly configured.\n\n"
                f"Server : {settings.get('email_smtp_server', '')}:{settings.get('email_smtp_port', '')}\n"
                f"TLS    : {settings.get('email_smtp_tls', 'starttls')}\n"
            ),
            attachments=[]
        )
        return {"status": "success", "message": f"Test email sent to {to_email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- EXCEL SINGLE SHEET PARSE & LEDGER ENDPOINTS ---
def scan_excel_file_path(excel_path: str):
    if not excel_path or not os.path.exists(excel_path):
        return {"folder_path": "", "excel_path": "", "files": []}

    try:
        company_details, clients = processing.parse_single_excel_sheet(excel_path)
        if company_details:
            clean_comp = {k: v for k, v in company_details.items() if v}
            if clean_comp:
                database.save_all_settings(clean_comp)
        for client in clients:
            cached = database.get_client(client["client_name"])
            if cached:
                for k in ["client_type", "state", "email", "cc_email", "address", "gstin"]:
                    if not client.get(k) and cached.get(k):
                        client[k] = cached[k]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Excel file: {e}")

    folder_path = os.path.dirname(excel_path)
    return {"folder_path": os.path.normpath(folder_path), "excel_path": excel_path, "files": clients}

class ExcelScanRequest(BaseModel):
    excel_path: str

@app.post("/api/excel/scan")
def api_scan_excel(req: ExcelScanRequest):
    if not req.excel_path or not os.path.exists(req.excel_path):
        raise HTTPException(status_code=400, detail=f"Excel file not found: {req.excel_path}")
    return scan_excel_file_path(req.excel_path)

@app.post("/api/excel/select")
def select_excel_file():
    excel_path = pick_file_native("Select Billing Excel Sheet")
    if not excel_path:
        return {"folder_path": "", "excel_path": "", "files": []}
    return scan_excel_file_path(excel_path)

@app.post("/api/excel/upload")
async def upload_excel_file(file: UploadFile = File(...)):
    fname = os.path.basename(file.filename or "")
    if not fname.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xlsm Excel files are supported.")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_dir = os.path.join(UPLOAD_DIR, f"excel_{timestamp}")
    os.makedirs(batch_dir, exist_ok=True)
    
    file_path = os.path.join(batch_dir, fname)
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
        
    return scan_excel_file_path(file_path)

@app.get("/api/invoices/all")
def get_all_invoices():
    try:
        return database.get_all_job_items(1000)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PaymentUpdatePayload(BaseModel):
    is_paid: int
    payment_date: Optional[str] = None
    amount_paid: Optional[float] = 0.0
    credit_applied: Optional[float] = 0.0

@app.post("/api/invoices/{item_id}/payment")
def update_payment(item_id: int, payload: PaymentUpdatePayload):
    try:
        # Determine is_paid status dynamically based on amount_paid vs total_amount
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT total_amount FROM job_items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Invoice record not found")
            
        total_amount = round(row["total_amount"], 2)
        amount_paid = round(payload.amount_paid if payload.amount_paid is not None else 0.0, 2)
        credit_applied = round(payload.credit_applied if payload.credit_applied is not None else 0.0, 2)
        
        effective_payment = amount_paid + credit_applied
        
        if effective_payment == 0.0:
            is_paid_status = 0
        elif effective_payment >= total_amount:
            is_paid_status = 1
        else:
            is_paid_status = 2  # Partially paid
            
        database.update_payment_status(item_id, is_paid_status, payload.payment_date, amount_paid, credit_applied)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class JobItemEditPayload(BaseModel):
    client_name: str
    client_type: str
    state: str
    email: str
    cc_email: str = ""
    address: str = ""
    gstin: str = ""
    valuation: float
    is_regular: bool = True
    custom_message: str = ""
    invoice_number: Optional[str] = ""
    portfolio_pdf_path: Optional[str] = ""
    invoice_pdf_path: Optional[str] = ""
    override_calculations: Optional[bool] = False
    fee_amount: Optional[float] = 0.0
    cgst: Optional[float] = 0.0
    sgst: Optional[float] = 0.0
    igst: Optional[float] = 0.0
    total_amount: Optional[float] = 0.0

@app.post("/api/invoices/{item_id}/edit")
def edit_job_item(item_id: int, payload: JobItemEditPayload):
    try:
        item = database.get_job_item(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Invoice record not found")
            
        batch_id = item["batch_id"]
        batch_row = database.get_batch(batch_id) if batch_id else None
        folder_path = batch_row["folder_path"] if batch_row else os.path.expanduser("~")
        
        valuation = float(payload.valuation or 0.0)
        settings = database.get_all_settings()
        fee_rules = database.get_fee_rules()
        fee_type = settings.get("fee_calculation_type", "flat")
        gst_rates = {
            "gst_rate_cgst": settings.get("gst_rate_cgst", "9.0"),
            "gst_rate_sgst": settings.get("gst_rate_sgst", "9.0"),
            "gst_rate_igst": settings.get("gst_rate_igst", "18.0"),
        }
        
        is_regular = payload.is_regular
        if not is_regular:
            fee_amount, cgst, sgst, igst, total_amount = 0.0, 0.0, 0.0, 0.0, 0.0
            status = "Skipped (Not Billable)"
            invoice_pdf_path = ""
            invoice_code = ""
            credit_applied = 0.0
            is_paid_status = 0
            payment_date_val = None
        else:
            if payload.override_calculations:
                fee_amount = payload.fee_amount if payload.fee_amount is not None else 0.0
                cgst = payload.cgst if payload.cgst is not None else 0.0
                sgst = payload.sgst if payload.sgst is not None else 0.0
                igst = payload.igst if payload.igst is not None else 0.0
                total_amount = payload.total_amount if payload.total_amount is not None else 0.0
            else:
                formula_tmpl = settings.get("taxable_amt_formula")
                if formula_tmpl and "Rate" in formula_tmpl and getattr(payload, "rate", None) is not None:
                    fee_amount = processing.calculate_formula_fee(formula_tmpl, valuation, payload.rate or 0.0025)
                else:
                    fee_amount = processing.calculate_fees(valuation, fee_rules, fee_type)
                    
                gst_calc = processing.calculate_gst(fee_amount, payload.state, gst_rates)
                cgst = gst_calc["cgst"]
                sgst = gst_calc["sgst"]
                igst = gst_calc["igst"]
                total_amount = gst_calc["total_amount"]
                
            status = "Completed"
            
            pdf_dir = os.path.join(folder_path, "pdf")
            os.makedirs(pdf_dir, exist_ok=True)
            safe_client_name = "".join([c for c in payload.client_name if c.isalnum() or c in (" ", "_", "-")]).strip().replace(" ", "_")
            default_invoice_pdf_path = os.path.normpath(os.path.join(pdf_dir, f"{safe_client_name}_Invoice.pdf"))
            
            invoice_code = payload.invoice_number if payload.invoice_number else item.get("invoice_number", "")
            if not invoice_code:
                invoice_prefix = settings.get("invoice_prefix", "INV-2026-")
                invoice_code = f"{invoice_prefix}{item_id:04d}"
                
            # Recalculate credit applied
            prior_credit = round(database.get_client_available_credit(payload.client_name, exclude_item_id=item_id), 2)
            old_amount_paid = round(item.get("amount_paid") or 0.0, 2)
            remaining_to_cover = round(max(0.0, total_amount - old_amount_paid), 2)
            credit_applied = round(min(remaining_to_cover, prior_credit), 2)
            
            effective_payment = old_amount_paid + credit_applied
            if effective_payment == 0.0:
                is_paid_status = 0
                payment_date_val = None
            elif effective_payment >= total_amount:
                is_paid_status = 1
                payment_date_val = item.get("payment_date") or datetime.today().strftime('%Y-%m-%d')
            else:
                is_paid_status = 2
                payment_date_val = item.get("payment_date") or datetime.today().strftime('%Y-%m-%d')

            # If payload.invoice_pdf_path is provided, not default, and exists on disk, use it and do NOT regenerate
            if payload.invoice_pdf_path and os.path.normpath(payload.invoice_pdf_path) != default_invoice_pdf_path and os.path.exists(payload.invoice_pdf_path):
                invoice_pdf_path = payload.invoice_pdf_path
            else:
                invoice_pdf_path = default_invoice_pdf_path
                # Render PDF Invoice
                invoice_data = {
                    "invoice_number": invoice_code,
                    "date": datetime.today().strftime('%d-%b-%Y'),
                    "client_name": payload.client_name,
                    "client_address": payload.address,
                    "client_state": payload.state,
                    "client_gstin": payload.gstin,
                    "valuation": valuation,
                    "fee_amount": fee_amount,
                    "cgst": cgst,
                    "sgst": sgst,
                    "igst": igst,
                    "total_amount": total_amount,
                    "credit_applied": credit_applied
                }
                processing.generate_invoice_pdf(invoice_pdf_path, invoice_data, settings)
            
        database.save_client({
            "client_name": payload.client_name,
            "client_type": payload.client_type,
            "state": payload.state,
            "email": payload.email,
            "cc_email": "",
            "address": payload.address,
            "gstin": payload.gstin
        })
        
        updates = {
            "client_name": payload.client_name,
            "valuation": valuation,
            "fee_amount": fee_amount,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_amount": total_amount,
            "status": status,
            "invoice_pdf_path": invoice_pdf_path,
            "portfolio_pdf_path": payload.portfolio_pdf_path if payload.portfolio_pdf_path is not None else "",
            "custom_message": payload.custom_message,
            "email_status": "Pending" if is_regular else "Skipped",
            "invoice_number": invoice_code,
            "credit_applied": credit_applied,
            "is_paid": is_paid_status,
            "payment_date": payment_date_val
        }
        database.update_job_item(item_id, updates)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/invoices/export")
def export_billing_ledger(payload: Dict[str, str]):
    folder_path = payload.get("folder_path")
    if not folder_path or not os.path.exists(folder_path):
        # Auto-fallback to Downloads or Documents
        downloads = os.path.join(os.path.expanduser("~"), "Downloads")
        if os.path.exists(downloads):
            folder_path = downloads
        else:
            folder_path = os.path.expanduser("~")
        
    try:
        rows = database.get_all_job_items(1000)
        if not rows:
            raise HTTPException(status_code=400, detail="No billing data found to export.")
            
        import pandas as pd
        data = []
        for r in rows:
            is_paid_val = r["is_paid"]
            pay_status = "Paid (Full)" if is_paid_val == 1 else ("Paid (Partial)" if is_paid_val == 2 else "Unpaid")
            
            data.append({
                "Invoice ID": r["id"],
                "Invoice No": r.get("invoice_number", ""),
                "Client Name": r["client_name"],
                "Valuation (INR)": r["valuation"] or 0.0,
                "Fee Amount (INR)": r["fee_amount"] or 0.0,
                "CGST (INR)": r["cgst"] or 0.0,
                "SGST (INR)": r["sgst"] or 0.0,
                "IGST (INR)": r["igst"] or 0.0,
                "Total Invoice Value (INR)": r["total_amount"] or 0.0,
                "Generation Status": r["status"],
                "Email Status": r["email_status"],
                "Payment Status": pay_status,
                "Amount Paid (INR)": r.get("amount_paid", 0.0),
                "Payment Received Date": r["payment_date"] or ""
            })
            
        df = pd.DataFrame(data)
        pdf_dir = os.path.join(folder_path, "pdf")
        os.makedirs(pdf_dir, exist_ok=True)
        export_path = os.path.join(pdf_dir, "Master_Billing_Ledger.xlsx")
        
        with pd.ExcelWriter(export_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Billing Ledger', index=False)
            worksheet = writer.sheets['Billing Ledger']
            
            from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
            header_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
            header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
            align_center = Alignment(horizontal="center", vertical="center")
            align_left = Alignment(horizontal="left", vertical="center")
            align_right = Alignment(horizontal="right", vertical="center")
            
            thin_border = Border(
                left=Side(style='thin', color='CBD5E0'),
                right=Side(style='thin', color='CBD5E0'),
                top=Side(style='thin', color='CBD5E0'),
                bottom=Side(style='thin', color='CBD5E0')
            )
            
            for col in worksheet.columns:
                max_len = 0
                col_letter = col[0].column_letter
                for cell in col:
                    cell.border = thin_border
                    val_str = str(cell.value or '')
                    max_len = max(max_len, len(val_str))
                    
                    if cell.row == 1:
                        cell.fill = header_fill
                        cell.font = header_font
                        cell.alignment = align_center
                    else:
                        if cell.column in [4, 5, 6, 7, 8, 9, 13]:
                            cell.alignment = align_right
                            if cell.value is not None:
                                cell.number_format = '₹#,##0.00'
                        elif cell.column in [1, 2, 10, 11, 12, 14]:
                            cell.alignment = align_center
                        else:
                            cell.alignment = align_left
                            
                worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)
                
        return {"status": "success", "file_path": os.path.normpath(export_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

# --- EMAIL TEMPLATES & CUSTOM DISPATCH ---
@app.get("/api/email/invoice-template/{item_id}")
def get_invoice_template(item_id: int):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice item not found")
        
    item = dict(row)
    client_name = item["client_name"]
    client_info = database.get_client(client_name)
    if not client_info:
        client_info = {
            "client_name": client_name,
            "email": "",
            "cc_email": ""
        }
        
    settings = database.get_all_settings()
    subject_template = settings.get("email_subject_template", "Portfolio Performance Report & Invoice - {ClientName}")
    body_template = settings.get("email_body_template", "Dear {ClientName},\n...")
    
    invoice_code = item["invoice_number"] or f"{settings.get('invoice_prefix', 'INV-2026-')}{item_id:04d}"
    
    credit_applied_val = float(item.get("credit_applied", 0.0) or 0.0)
    custom_msg = item.get("custom_message", "") or ""
    if credit_applied_val > 0:
        credit_note = f"Note: A prior credit of INR {credit_applied_val:,.2f} has been applied to this invoice. The net amount payable is INR {max(0.0, float(item['total_amount'] or 0.0) - credit_applied_val):,.2f}."
        if custom_msg:
            custom_msg = f"{credit_note}\n\n{custom_msg}"
        else:
            custom_msg = credit_note

    context = {
        "ClientName": client_name,
        "InvoiceNumber": invoice_code,
        "Valuation": float(item["valuation"]) if item["valuation"] is not None else 0.0,
        "FeeAmount": float(item["fee_amount"]) if item["fee_amount"] is not None else 0.0,
        "TotalAmount": float(item["total_amount"]) if item["total_amount"] is not None else 0.0,
        "CustomMessage": custom_msg
    }

    
    try:
        subject = subject_template.format(**context)
        body = body_template.format(**context)
        if custom_msg and "{CustomMessage}" not in body_template:
            if "Best Regards" in body:
                body = body.replace("Best Regards", f"{custom_msg}\n\nBest Regards")
            else:
                body = f"{body}\n\n{custom_msg}"
    except Exception as e:
        subject = subject_template
        body = body_template
        
    attachments = []
    if item["portfolio_pdf_path"] and os.path.exists(item["portfolio_pdf_path"]):
        attachments.append(item["portfolio_pdf_path"])
    if item["invoice_pdf_path"] and os.path.exists(item["invoice_pdf_path"]):
        attachments.append(item["invoice_pdf_path"])
        
    return {
        "client_name": client_name,
        "recipient": client_info.get("email", ""),
        "cc": item.get("cc_email", "") or client_info.get("cc_email", ""),
        "subject": subject,
        "body": body,
        "attachments": attachments
    }

@app.get("/api/email/payment-template/{item_id}")
def get_payment_template(item_id: int):
    conn = database.get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice item not found")
        
    item = dict(row)
    client_name = item["client_name"]
    client_info = database.get_client(client_name)
    if not client_info:
        client_info = {
            "client_name": client_name,
            "email": "",
            "cc_email": ""
        }
        
    settings = database.get_all_settings()
    
    invoice_code = item["invoice_number"] or f"{settings.get('invoice_prefix', 'INV-2026-')}{item_id:04d}"
    total_amt_val = float(item["total_amount"]) if item["total_amount"] is not None else 0.0
    payment_date_val = item.get("payment_date") or datetime.today().strftime('%Y-%m-%d')
    
    subject_template = settings.get("payment_subject_template", "Payment Confirmation - {ClientName} ({InvoiceNumber})")
    body_template = settings.get("payment_body_template", (
        "Dear {ClientName},\n\n"
        "Thank you for your payment of INR {TotalAmount:,.2f} against Invoice {InvoiceNumber}.\n\n"
        "Your payment has been received and recorded. {PaymentStatusDetails}\n\n"
        "Please find the attached confirmation for your records.\n\n"
        "Best Regards,\n"
        "Antigravity Wealth Management"
    ))
    
    amount_paid_val = float(item.get("amount_paid", 0.0) or 0.0)
    credit_applied_val = float(item.get("credit_applied", 0.0) or 0.0)
    effective_payment = amount_paid_val + credit_applied_val
    credit_created_val = max(0.0, effective_payment - total_amt_val)
    balance_due_val = max(0.0, total_amt_val - effective_payment)
    
    payment_status_details = ""
    if credit_created_val > 0:
        payment_status_details = f"An amount of INR {credit_created_val:,.2f} is in credit for future invoices."
    elif balance_due_val > 0:
        payment_status_details = f"An amount of INR {balance_due_val:,.2f} is remaining outstanding."
    else:
        payment_status_details = "This invoice is now paid in full."
    
    context = {
        "ClientName": client_name,
        "InvoiceNumber": invoice_code,
        "TotalAmount": amount_paid_val,
        "InvoiceTotal": total_amt_val,
        "PaymentDate": payment_date_val,
        "CustomMessage": item.get("custom_message", "") or "",
        "AmountPaid": amount_paid_val,
        "CreditApplied": credit_applied_val,
        "CreditCreated": credit_created_val,
        "BalanceDue": balance_due_val,
        "PaymentStatusDetails": payment_status_details
    }
    
    try:
        subject = subject_template.format(**context)
        body = body_template.format(**context)
        
        # If the template from settings does not contain the placeholder, inject it dynamically
        if "{PaymentStatusDetails}" not in settings.get("payment_body_template", ""):
            if "Best Regards" in body:
                body = body.replace("Best Regards", f"{payment_status_details}\n\nBest Regards")
            else:
                body = f"{body}\n\n{payment_status_details}"
                
        custom_msg = item.get("custom_message", "")
        if custom_msg and "{CustomMessage}" not in body_template:
            if "Best Regards" in body:
                body = body.replace("Best Regards", f"{custom_msg}\n\nBest Regards")
            else:
                body = f"{body}\n\n{custom_msg}"
    except Exception as e:
        subject = subject_template
        body = body_template
        
    attachments = []
    if item["invoice_pdf_path"] and os.path.exists(item["invoice_pdf_path"]):
        attachments.append(item["invoice_pdf_path"])
        
    return {
        "client_name": client_name,
        "recipient": client_info.get("email", ""),
        "cc": client_info.get("cc_email", ""),
        "subject": subject,
        "body": body,
        "attachments": attachments
    }

@app.post("/api/email/send-custom")
def send_custom_email(payload: CustomEmailRequest):
    settings = database.get_all_settings()
    attachments = []
    for path in payload.attachments:
        if path and os.path.exists(path):
            attachments.append(path)
            
    try:
        use_outlook = settings.get("email_use_outlook", "0") == "1"
        if use_outlook:
            email_service.send_outlook_email(
                payload.recipient,
                payload.cc,
                payload.subject,
                payload.body,
                attachments,
                display=False
            )
        else:
            email_service.send_smtp_email(
                settings,
                payload.recipient,
                payload.cc,
                payload.subject,
                payload.body,
                attachments
            )
            
        import json
        log_id = database.add_email_log({
            "client_name": payload.client_name,
            "recipient_email": payload.recipient,
            "cc_email": payload.cc,
            "subject": payload.subject,
            "body": payload.body,
            "status": "Sent",
            "error_msg": "",
            "attachments": json.dumps(attachments),
            "email_type": payload.email_type
        })
        
        if payload.item_id:
            database.update_job_item(payload.item_id, {"email_status": "Sent"})
            
        return {"status": "success", "log_id": log_id}
    except Exception as e:
        import json
        database.add_email_log({
            "client_name": payload.client_name,
            "recipient_email": payload.recipient,
            "cc_email": payload.cc,
            "subject": payload.subject,
            "body": payload.body,
            "status": "Failed",
            "error_msg": str(e),
            "attachments": json.dumps(payload.attachments),
            "email_type": payload.email_type
        })
        
        if payload.item_id:
            database.update_job_item(payload.item_id, {"email_status": f"Failed: {str(e)[:40]}"})
            
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/email/select-attachments")
def select_attachments():
    files = []
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        selected_files = filedialog.askopenfilenames(
            title="Select Email Attachments"
        )
        root.destroy()
        if selected_files:
            files = [os.path.normpath(f) for f in selected_files]
    except Exception as e:
        print(f"Error selecting attachments: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"attachments": files}

@app.post("/api/files/select-pdf")
def select_pdf_file():
    file_path = ""
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        selected_file = filedialog.askopenfilename(
            title="Select PDF Document",
            filetypes=[("PDF Files", "*.pdf"), ("All Files", "*.*")]
        )
        root.destroy()
        if selected_file:
            file_path = os.path.normpath(selected_file)
    except Exception as e:
        print(f"Error selecting PDF file: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    return {"file_path": file_path}

@app.post("/api/settings/select-qr")
def select_qr_image():
    """Open a native file picker for an image, save path to email_qr_path setting."""
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        selected = filedialog.askopenfilename(
            title="Select QR Code Image",
            filetypes=[
                ("Image Files", "*.png *.jpg *.jpeg *.gif *.bmp *.webp"),
                ("All Files", "*.*")
            ]
        )
        root.destroy()
        if not selected:
            return {"qr_path": ""}
        qr_path = os.path.normpath(selected)
        database.save_setting("email_qr_path", qr_path)
        return {"qr_path": qr_path}
    except Exception as e:
        print(f"Error selecting QR image: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/settings/clear-qr")
def clear_qr_image():
    """Remove the configured QR code image."""
    database.save_setting("email_qr_path", "")
    return {"status": "cleared"}

@app.get("/api/settings/qr-preview")
def get_qr_preview():
    """Return the QR code image as a base64 data URI for preview."""
    import base64
    qr_path = database.get_setting("email_qr_path") or ""
    if not qr_path or not os.path.exists(qr_path):
        return {"data_uri": "", "filename": ""}
    ext = os.path.splitext(qr_path)[1].lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "bmp": "image/bmp", "webp": "image/webp"}.get(ext, "image/png")
    with open(qr_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return {"data_uri": f"data:{mime};base64,{data}", "filename": os.path.basename(qr_path)}

@app.post("/api/settings/select-invoice-qr")
def select_invoice_qr_image():
    """Open a native file picker for an image, save path to invoice_qr_path setting."""
    import tkinter as tk
    from tkinter import filedialog
    try:
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        selected = filedialog.askopenfilename(
            title="Select Invoice QR Code Image",
            filetypes=[("Image Files", "*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif")]
        )
        root.destroy()
        if not selected:
            return {"qr_path": ""}
        qr_path = os.path.normpath(selected)
        database.save_setting("invoice_qr_path", qr_path)
        return {"qr_path": qr_path}
    except Exception as e:
        print(f"Error selecting Invoice QR image: {e}")
        return {"error": str(e)}

@app.post("/api/settings/clear-invoice-qr")
def clear_invoice_qr_image():
    """Remove the configured Invoice QR code image."""
    database.save_setting("invoice_qr_path", "")
    return {"status": "cleared"}

@app.get("/api/settings/invoice-qr-preview")
def get_invoice_qr_preview():
    """Return the Invoice QR code image as a base64 data URI for preview."""
    import base64
    qr_path = database.get_setting("invoice_qr_path") or ""
    if not qr_path or not os.path.exists(qr_path):
        return {"data_uri": "", "filename": ""}
    ext = os.path.splitext(qr_path)[1].lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "bmp": "image/bmp", "webp": "image/webp"}.get(ext, "image/png")
    with open(qr_path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    return {"data_uri": f"data:{mime};base64,{data}", "filename": os.path.basename(qr_path)}


@app.get("/api/email/history")
def get_email_history():
    try:
        return database.get_all_email_history(500)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- CLIENT REGISTRY & HISTORY ---

@app.get("/api/clients/{client_name}/credit")
def get_client_credit(client_name: str, exclude_item_id: Optional[int] = None):
    try:
        credit = database.get_client_available_credit(client_name, exclude_item_id)
        return {"available_credit": credit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_name}/history")
def get_client_history(client_name: str):
    try:
        client_info = database.get_client(client_name)
        if not client_info:
            conn = database.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT client_name FROM job_items WHERE client_name = ?", (client_name,))
            row = cursor.fetchone()
            conn.close()
            if not row:
                raise HTTPException(status_code=404, detail="Client not found")
            client_info = {
                "client_name": client_name,
                "client_type": "Type 1",
                "state": "Maharashtra",
                "email": "",
                "cc_email": "",
                "address": "",
                "gstin": ""
            }
            
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT j.*, b.timestamp as batch_date
        FROM job_items j
        LEFT JOIN batches b ON j.batch_id = b.id
        WHERE j.client_name = ?
        ORDER BY j.id DESC
        """, (client_name,))
        billing_history = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        email_history = database.get_client_email_history(client_name)
        available_credit = database.get_client_available_credit(client_name)
        
        return {
            "profile": client_info,
            "billing": billing_history,
            "emails": email_history,
            "available_credit": available_credit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# --- DEBUG ENDPOINT ---
@app.post("/api/debug/sheet-columns")
def debug_sheet_columns(payload: Dict[str, str]):
    """Diagnostic endpoint: POST { excel_path } to see what columns are detected in the master sheet."""
    import openpyxl
    excel_path = payload.get("excel_path", "")
    if not excel_path or not os.path.exists(excel_path):
        raise HTTPException(status_code=400, detail="Invalid or missing excel_path")
    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        master_sheet = processing.find_master_sheet_name(wb.sheetnames)
        if not master_sheet:
            return {"error": "No master sheet found", "sheet_names": wb.sheetnames}
        ws = wb[master_sheet]
        header_row, cols = processing.get_master_sheet_mapping(ws)
        wb.close()
        return {
            "master_sheet": master_sheet,
            "all_sheets": wb.sheetnames,
            "header_row": header_row,
            "columns_detected": cols,
            "email_col_index": processing.get_mapped_col(cols, [
                "client_email_id", "email_id", "email", "e_mail", "e-mail",
                "client_email", "emailid", "email_address", "mail"
            ])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- STATIC FILES MOUNT ---
base_dir = getattr(sys, '_MEIPASS', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
dist_dir = os.path.normpath(os.path.join(base_dir, "frontend", "dist"))

if os.path.exists(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
else:
    print(f"Warning: React static distribution folder not found at {dist_dir}. Serving API only.")
