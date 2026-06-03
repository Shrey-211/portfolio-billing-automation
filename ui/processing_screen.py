import os
import time
from datetime import datetime
from PySide6.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, QProgressBar, QTextEdit, QFrame
from PySide6.QtCore import Qt, QThread, Signal, Slot
import database
import processing

class ProcessingWorker(QThread):
    # Signals to communicate with the UI
    progress_updated = Signal(int, int)          # Emitted for progress updates: (completed, total)
    current_item_changed = Signal(str, str)     # Emitted when processing a new file: (filename, client_name)
    log_emitted = Signal(str, str)               # Emitted for logs: (message, type)
    item_processed = Signal(int, bool, str)      # Emitted when an item completes: (row_index, success, error_msg)
    batch_finished = Signal(int)                 # Emitted when the entire batch is completed: (batch_id)
    
    def __init__(self, folder_path, file_data_list, db_path=None):
        super().__init__()
        self.folder_path = folder_path
        self.file_data_list = file_data_list
        self.db_path = db_path
        self.is_cancelled = False
        
    def cancel(self):
        self.is_cancelled = True
        
    def run(self):
        total = len(self.file_data_list)
        completed = 0
        failed = 0
        
        self.log_emitted.emit("Starting batch billing automation run...", "info")
        
        # 1. Create Batch Record in DB
        try:
            batch_id = database.create_batch(self.folder_path, total, self.db_path)
            self.log_emitted.emit(f"Created batch record #{batch_id} in database.", "info")
        except Exception as e:
            self.log_emitted.emit(f"Failed to create batch in database: {e}", "error")
            # Create a mock batch_id for safety
            batch_id = 0
            
        # 2. Setup Output Directory
        # The PDF folder should be directly inside the selected folder: e.g., selected_folder/pdf
        pdf_dir = os.path.join(self.folder_path, "pdf")
        os.makedirs(pdf_dir, exist_ok=True)
        
        # Create a temp folder for processed static xlsx files to avoid cluttering PDF folder
        static_xlsx_dir = os.path.join(pdf_dir, "processed_xlsx")
        os.makedirs(static_xlsx_dir, exist_ok=True)
        
        # 3. Load active configs from DB
        settings = database.get_all_settings(self.db_path)
        fee_rules = database.get_fee_rules(self.db_path)
        
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
            
        self.log_emitted.emit(f"Configurations loaded. Fee calculation mode: {fee_type.upper()}.", "info")
        
        # 4. Iterate over files
        for idx, item in enumerate(self.file_data_list):
            if self.is_cancelled:
                self.log_emitted.emit("Batch processing cancelled by user.", "warning")
                if batch_id > 0:
                    database.update_batch(batch_id, completed, failed, "Cancelled", self.db_path)
                return
                
            filename_full = item["filename"]
            client_name = item["client_name"]
            filename_base = os.path.basename(filename_full)
            
            self.current_item_changed.emit(filename_base, client_name)
            self.log_emitted.emit(f"[{idx+1}/{total}] Processing client: {client_name} ({filename_base})", "info")
            
            # Paths
            # PDF names: ClientName_Portfolio.pdf and ClientName_Invoice.pdf
            safe_client_name = "".join([c for c in client_name if c.isalnum() or c in (" ", "_", "-")]).strip()
            safe_client_name = safe_client_name.replace(" ", "_")
            
            flat_excel_path = os.path.join(static_xlsx_dir, f"{safe_client_name}_Processed.xlsx")
            portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Portfolio.pdf")
            invoice_pdf_path = os.path.join(pdf_dir, f"{safe_client_name}_Invoice.pdf")
            
            error_message = ""
            item_success = False
            
            # Values initialized
            valuation = item["valuation"]
            fee_amount = 0.0
            cgst = 0.0
            sgst = 0.0
            igst = 0.0
            total_amount = 0.0
            
            try:
                # A. Formula Cleansing
                self.log_emitted.emit("Removing Excel formulas and saving static workbook copy...", "debug")
                processing.cleanse_formulas(filename_full, flat_excel_path)
                self.log_emitted.emit("Formulas removed. Styles and formatting preserved.", "debug")
                
                # B. Fee Calculation
                self.log_emitted.emit(f"Calculating management fees for valuation INR {valuation:,.2f}...", "debug")
                fee_amount = processing.calculate_fees(valuation, fee_rules, fee_type)
                self.log_emitted.emit(f"Base fee calculated: INR {fee_amount:,.2f}", "debug")
                
                # C. GST Calculation
                state = item["state"]
                self.log_emitted.emit(f"Applying GST for state: {state}...", "debug")
                gst_calc = processing.calculate_gst(fee_amount, state, gst_rates)
                cgst = gst_calc["cgst"]
                sgst = gst_calc["sgst"]
                igst = gst_calc["igst"]
                total_amount = gst_calc["total_amount"]
                
                if gst_calc["is_maharashtra"]:
                    self.log_emitted.emit(f"CGST ({gst_rates['gst_rate_cgst']}%): {cgst:,.2f} | SGST ({gst_rates['gst_rate_sgst']}%): {sgst:,.2f}", "debug")
                else:
                    self.log_emitted.emit(f"IGST ({gst_rates['gst_rate_igst']}%): {igst:,.2f}", "debug")
                self.log_emitted.emit(f"Total Billing Amount (incl. GST): INR {total_amount:,.2f}", "debug")
                
                # D. Portfolio PDF Export
                self.log_emitted.emit("Exporting portfolio sheets to PDF...", "debug")
                if processing.EXCEL_AVAILABLE:
                    # Leverage Excel automation for perfect layout PDF
                    processing.convert_excel_to_pdf(flat_excel_path, portfolio_pdf_path)
                    self.log_emitted.emit(f"Portfolio PDF generated: {os.path.basename(portfolio_pdf_path)}", "debug")
                else:
                    self.log_emitted.emit("Excel unavailable. Copying original Excel to processed dir (reportlab portfolio fallback)...", "warning")
                    # Fallback: copy file or render basic reportlab PDF
                    # Let's save a placeholder message PDF or copy Excel
                    portfolio_pdf_path = "" # Flag as empty/failed if Excel required, or write simple pdf
                    error_message = "Microsoft Excel is required to convert portfolio to PDF."
                    raise RuntimeError(error_message)
                    
                # E. Invoice PDF Generation
                self.log_emitted.emit("Generating GST Tax Invoice PDF...", "debug")
                
                # Setup invoice metadata
                current_inv_code = f"{invoice_prefix}{next_inv_num:04d}"
                today_str = datetime.today().strftime('%d-%b-%Y')
                
                invoice_data = {
                    "invoice_number": current_inv_code,
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
                self.log_emitted.emit(f"Tax Invoice generated: {os.path.basename(invoice_pdf_path)} with No. {current_inv_code}", "debug")
                
                # Increment invoice counter for next file
                next_inv_num += 1
                
                item_success = True
                completed += 1
                self.log_emitted.emit(f"Successfully processed portfolio for {client_name}.", "success")
                
            except Exception as ex:
                failed += 1
                item_success = False
                error_message = str(ex)
                self.log_emitted.emit(f"Failed to process {client_name}: {error_message}", "error")
                
            # Log results in database
            if batch_id > 0:
                try:
                    job_item_data = {
                        "batch_id": batch_id,
                        "filename": filename_base,
                        "client_name": client_name,
                        "valuation": valuation,
                        "fee_amount": fee_amount,
                        "cgst": cgst,
                        "sgst": sgst,
                        "igst": igst,
                        "total_amount": total_amount,
                        "status": "Completed" if item_success else "Failed",
                        "error_msg": error_message if not item_success else "",
                        "portfolio_pdf_path": portfolio_pdf_path if item_success else "",
                        "invoice_pdf_path": invoice_pdf_path if item_success else "",
                        "email_status": "Pending"
                    }
                    database.add_job_item(job_item_data, self.db_path)
                except Exception as db_ex:
                    self.log_emitted.emit(f"Error logging job item in DB: {db_ex}", "error")
                    
            self.item_processed.emit(idx, item_success, error_message)
            self.progress_updated.emit(idx + 1, total)
            
            # Small artificial delay to keep UI feeling smooth and visually readable
            time.sleep(0.1)
            
        # 5. Finalize Batch
        self.log_emitted.emit(f"Batch execution finished. Total: {total} | Completed: {completed} | Failed: {failed}", "info")
        
        if batch_id > 0:
            try:
                # Save the incremented invoice counter
                database.save_setting("next_invoice_number", next_inv_num, self.db_path)
                
                batch_status = "Completed" if failed == 0 else ("Failed" if completed == 0 else "Partially Completed")
                database.update_batch(batch_id, completed, failed, batch_status, self.db_path)
            except Exception as db_ex:
                self.log_emitted.emit(f"Error finalizing batch in DB: {db_ex}", "error")
                
        self.batch_finished.emit(batch_id)

class ProcessingScreen(QWidget):
    # Signals
    processing_completed = Signal(int) # Emitted on completion: (batch_id)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.worker = None
        self.setup_ui()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(30, 30, 30, 30)
        
        # --- HEADER ---
        header_layout = QVBoxLayout()
        title = QLabel("Processing Batch")
        title.setObjectName("ScreenTitle")
        self.lbl_subtitle = QLabel("Evaluating formulas, calculating billing totals, and generating PDFs...")
        self.lbl_subtitle.setObjectName("ScreenSubtitle")
        header_layout.addWidget(title)
        header_layout.addWidget(self.lbl_subtitle)
        main_layout.addLayout(header_layout)
        
        # --- PROGRESS PANEL ---
        prog_card = QFrame()
        prog_card.setObjectName("Card")
        prog_layout = QVBoxLayout(prog_card)
        prog_layout.setSpacing(12)
        
        self.lbl_status = QLabel("Initializing files...")
        self.lbl_status.setStyleSheet("font-weight: bold; font-size: 14px; color: #ffffff;")
        prog_layout.addWidget(self.lbl_status)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        prog_layout.addWidget(self.progress_bar)
        
        main_layout.addWidget(prog_card)
        
        # --- LOG PANEL ---
        log_card = QFrame()
        log_card.setObjectName("Card")
        log_layout = QVBoxLayout(log_card)
        log_layout.setSpacing(8)
        
        log_title = QLabel("Real-Time Execution Logs")
        log_title.setObjectName("SectionHeader")
        log_layout.addWidget(log_title)
        
        self.txt_logs = QTextEdit()
        self.txt_logs.setReadOnly(True)
        self.txt_logs.setStyleSheet("QTextEdit { background-color: #121317; border: 1px solid #2d3139; color: #a0aec0; font-family: 'Consolas', 'Courier New', monospace; font-size: 12px; }")
        log_layout.addWidget(self.txt_logs)
        
        main_layout.addWidget(log_card, 1)
        
        # --- ACTIONS BAR ---
        btn_layout = QHBoxLayout()
        self.btn_cancel = QPushButton("Cancel Execution")
        self.btn_cancel.setObjectName("DangerBtn")
        self.btn_cancel.clicked.connect(self.cancel_processing)
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_cancel)
        main_layout.addLayout(btn_layout)
        
    def start_run(self, folder_path, file_data_list):
        self.txt_logs.clear()
        self.progress_bar.setValue(0)
        self.lbl_status.setText("Preparing files...")
        self.btn_cancel.setEnabled(True)
        
        # Start Worker Thread
        self.worker = ProcessingWorker(folder_path, file_data_list)
        
        # Connect signals
        self.worker.progress_updated.connect(self.on_progress)
        self.worker.current_item_changed.connect(self.on_item_change)
        self.worker.log_emitted.connect(self.on_log_received)
        self.worker.batch_finished.connect(self.on_batch_finished)
        
        self.worker.start()
        
    @Slot(int, int)
    def on_progress(self, completed, total):
        pct = int(completed * 100 / total)
        self.progress_bar.setValue(pct)
        
    @Slot(str, str)
    def on_item_change(self, filename, client_name):
        self.lbl_status.setText(f"Processing: {client_name} ({filename})")
        
    @Slot(str, str)
    def on_log_received(self, msg, log_type):
        timestamp = datetime.now().strftime("%H:%M:%S")
        prefix = f"[{timestamp}] "
        
        # Format HTML log colors based on status level
        if log_type == "success":
            color = "#10b981" # Emerald Green
            formatted = f"{prefix}<font color='{color}'><b>SUCCESS:</b> {msg}</font>"
        elif log_type == "error":
            color = "#ef4444" # Red
            formatted = f"{prefix}<font color='{color}'><b>ERROR:</b> {msg}</font>"
        elif log_type == "warning":
            color = "#f59e0b" # Orange
            formatted = f"{prefix}<font color='{color}'><b>WARNING:</b> {msg}</font>"
        elif log_type == "debug":
            color = "#718096" # Gray
            formatted = f"{prefix}<font color='{color}'>{msg}</font>"
        else:
            color = "#e2e8f0" # Light Slate
            formatted = f"{prefix}<font color='{color}'>{msg}</font>"
            
        self.txt_logs.append(formatted)
        
    @Slot(int)
    def on_batch_finished(self, batch_id):
        self.btn_cancel.setEnabled(False)
        self.lbl_status.setText("Processing Completed!")
        self.lbl_status.setStyleSheet("font-weight: bold; font-size: 14px; color: #10b981;")
        
        # Give a small visual pause before showing the results screen
        QThread.msleep(500)
        self.processing_completed.emit(batch_id)
        
    def cancel_processing(self):
        if self.worker and self.worker.isRunning():
            self.btn_cancel.setEnabled(False)
            self.lbl_status.setText("Cancelling... please wait.")
            self.worker.cancel()
