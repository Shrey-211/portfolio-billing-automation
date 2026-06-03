import os
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QTableWidget, QTableWidgetItem, QFrame, QHeaderView,
    QDialog, QFormLayout, QLineEdit, QComboBox, QDoubleSpinBox,
    QMessageBox
)
from PySide6.QtCore import Qt, Signal
import processing
import database

class MetadataEditorDialog(QDialog):
    def __init__(self, data, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Edit Client Metadata - {os.path.basename(data['filename'])}")
        self.resize(450, 450)
        self.setModal(True)
        self.data = data
        self.setup_ui()
        
    def setup_ui(self):
        layout = QVBoxLayout(self)
        
        header = QLabel("Client Invoice Details")
        header.setObjectName("SectionHeader")
        layout.addWidget(header)
        
        form = QFormLayout()
        
        self.txt_client_name = QLineEdit(self.data.get("client_name", ""))
        self.txt_client_name.setPlaceholderText("e.g. John Doe & Co.")
        form.addRow("Client Name:", self.txt_client_name)
        
        self.cb_type = QComboBox()
        self.cb_type.addItems(["Type 1", "Type 2", "Type 3"])
        self.cb_type.setCurrentText(self.data.get("client_type", "Type 1"))
        form.addRow("Client Type:", self.cb_type)
        
        self.txt_state = QLineEdit(self.data.get("state", "Maharashtra"))
        self.txt_state.setPlaceholderText("e.g. Maharashtra, Karnataka")
        form.addRow("State:", self.txt_state)
        
        self.txt_gstin = QLineEdit(self.data.get("gstin", ""))
        self.txt_gstin.setPlaceholderText("15-digit GSTIN (optional)")
        form.addRow("GSTIN:", self.txt_gstin)
        
        self.txt_email = QLineEdit(self.data.get("email", ""))
        self.txt_email.setPlaceholderText("client@example.com")
        form.addRow("Client Email:", self.txt_email)
        
        self.txt_cc_email = QLineEdit(self.data.get("cc_email", ""))
        self.txt_cc_email.setPlaceholderText("advisor@example.com")
        form.addRow("CC Email:", self.txt_cc_email)
        
        self.txt_address = QLineEdit(self.data.get("address", ""))
        self.txt_address.setPlaceholderText("Full billing address")
        form.addRow("Billing Address:", self.txt_address)
        
        self.val_spin = QDoubleSpinBox()
        self.val_spin.setRange(0, 99999999999.0)
        self.val_spin.setDecimals(2)
        self.val_spin.setValue(self.data.get("valuation", 0.0))
        self.val_spin.setSingleStep(100000.0)
        self.val_spin.setGroupSeparatorShown(True)
        form.addRow("Portfolio Value (INR):", self.val_spin)
        
        layout.addLayout(form)
        layout.addSpacer(20)
        
        btn_layout = QHBoxLayout()
        btn_save = QPushButton("Save Details")
        btn_save.setObjectName("PrimaryBtn")
        btn_save.clicked.connect(self.save_details)
        
        btn_cancel = QPushButton("Cancel")
        btn_cancel.clicked.connect(self.reject)
        
        btn_layout.addStretch()
        btn_layout.addWidget(btn_cancel)
        btn_layout.addWidget(btn_save)
        layout.addLayout(btn_layout)
        
    def save_details(self):
        # Update our data dictionary
        self.data["client_name"] = self.txt_client_name.text().strip()
        self.data["client_type"] = self.cb_type.currentText()
        self.data["state"] = self.txt_state.text().strip()
        self.data["gstin"] = self.txt_gstin.text().strip().upper()
        self.data["email"] = self.txt_email.text().strip()
        self.data["cc_email"] = self.txt_cc_email.text().strip()
        self.data["address"] = self.txt_address.text().strip()
        self.data["valuation"] = self.val_spin.value()
        
        if not self.data["client_name"]:
            QMessageBox.warning(self, "Validation Error", "Client Name cannot be empty.")
            return
            
        self.accept()

class WorkbenchScreen(QWidget):
    # Signals
    start_processing = Signal(str, list) # Emitted when proceeding to process: (folder_path, list_of_file_datas)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.folder_path = ""
        self.queue_data = [] # List of dicts containing metadata for each file
        self.setup_ui()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(30, 30, 30, 30)
        
        # --- HEADER ---
        header_layout = QVBoxLayout()
        title = QLabel("Workbench")
        title.setObjectName("ScreenTitle")
        subtitle = QLabel("Review and edit scanned portfolio information. Double-click a row to edit invoice details.")
        subtitle.setObjectName("ScreenSubtitle")
        header_layout.addWidget(title)
        header_layout.addWidget(subtitle)
        main_layout.addLayout(header_layout)
        
        # --- QUEUE GRID CARD ---
        grid_card = QFrame()
        grid_card.setObjectName("Card")
        grid_layout = QVBoxLayout(grid_card)
        grid_layout.setSpacing(12)
        
        # Table of files
        self.table = QTableWidget()
        self.table.setColumnCount(8)
        self.table.setHorizontalHeaderLabels([
            "Filename", "Client Name", "State", "Valuation (INR)", 
            "Client Email", "GSTIN", "Status", "Actions"
        ])
        
        # Table Header Styling
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.Stretch)
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents) # Filename
        header.setSectionResizeMode(7, QHeaderView.ResizeToContents) # Action button
        
        self.table.setSelectionBehavior(QTableWidget.SelectRows)
        self.table.setEditTriggers(QTableWidget.NoEditTriggers) # Edit via double-click dialog
        self.table.doubleClicked.connect(self.on_row_double_clicked)
        
        grid_layout.addWidget(self.table)
        
        # Actions bar
        actions_layout = QHBoxLayout()
        
        self.btn_remove = QPushButton("Remove Selected")
        self.btn_remove.setObjectName("DangerBtn")
        self.btn_remove.clicked.connect(self.remove_selected)
        
        self.btn_clear = QPushButton("Clear Workbench")
        self.btn_clear.clicked.connect(self.clear_workbench)
        
        self.btn_proceed = QPushButton("Proceed to Generate Reports & Invoices")
        self.btn_proceed.setObjectName("PrimaryBtn")
        self.btn_proceed.clicked.connect(self.proceed_to_processing)
        self.btn_proceed.setEnabled(False)
        
        actions_layout.addWidget(self.btn_remove)
        actions_layout.addWidget(self.btn_clear)
        actions_layout.addStretch()
        actions_layout.addWidget(self.btn_proceed)
        
        grid_layout.addLayout(actions_layout)
        main_layout.addWidget(grid_card)
        
    def load_files(self, folder_path, file_paths):
        self.folder_path = folder_path
        self.queue_data = []
        
        for fp in file_paths:
            # Attempt to extract metadata from the sheet first
            meta = processing.get_client_metadata(fp)
            if not meta:
                # Fallback: parse client name from filename or prompt user
                base = os.path.splitext(os.path.basename(fp))[0]
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
            # Cache lookup
            cached = database.get_client(meta["client_name"])
            if cached:
                # Override empty values with cached database profile
                for key in ["client_type", "state", "email", "cc_email", "address", "gstin"]:
                    if not meta.get(key) and cached.get(key):
                        meta[key] = cached[key]
                        
            meta["filename"] = fp
            meta["status"] = "Pending"
            self.queue_data.append(meta)
            
        self.refresh_table()
        self.btn_proceed.setEnabled(len(self.queue_data) > 0)
        
    def refresh_table(self):
        self.table.setRowCount(0)
        self.table.setRowCount(len(self.queue_data))
        
        for i, item in enumerate(self.queue_data):
            # Filename
            file_item = QTableWidgetItem(os.path.basename(item["filename"]))
            self.table.setItem(i, 0, file_item)
            
            # Client Name
            name_item = QTableWidgetItem(item["client_name"])
            self.table.setItem(i, 1, name_item)
            
            # State
            state_item = QTableWidgetItem(item["state"])
            self.table.setItem(i, 2, state_item)
            
            # Valuation
            val_text = f"{item['valuation']:,.2f}" if item['valuation'] > 0 else "0.00"
            val_item = QTableWidgetItem(val_text)
            val_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(i, 3, val_item)
            
            # Email
            email_item = QTableWidgetItem(item["email"])
            self.table.setItem(i, 4, email_item)
            
            # GSTIN
            gst_item = QTableWidgetItem(item["gstin"])
            self.table.setItem(i, 5, gst_item)
            
            # Status
            status_item = QTableWidgetItem(item["status"])
            self.table.setItem(i, 6, status_item)
            
            # Actions: simple Edit button inside table cell
            btn_edit = QPushButton("Edit")
            btn_edit.clicked.connect(lambda checked=False, idx=i: self.edit_row(idx))
            self.table.setCellWidget(i, 7, btn_edit)
            
    def on_row_double_clicked(self, index):
        self.edit_row(index.row())
        
    def edit_row(self, row_idx):
        if row_idx < 0 or row_idx >= len(self.queue_data):
            return
            
        dialog = MetadataEditorDialog(self.queue_data[row_idx], self)
        if dialog.exec() == QDialog.Accepted:
            # Save client profile to DB cache for future auto-completion
            try:
                database.save_client({
                    "client_name": dialog.data["client_name"],
                    "client_type": dialog.data["client_type"],
                    "state": dialog.data["state"],
                    "email": dialog.data["email"],
                    "cc_email": dialog.data["cc_email"],
                    "address": dialog.data["address"],
                    "gstin": dialog.data["gstin"]
                })
            except Exception as e:
                print(f"Error caching client in DB: {e}")
                
            self.refresh_table()
            
    def remove_selected(self):
        selected_ranges = self.table.selectedRanges()
        if not selected_ranges:
            QMessageBox.information(self, "No Selection", "Please click on a row to select it for removal.")
            return
            
        # Get unique rows to remove
        rows_to_remove = set()
        for r in selected_ranges:
            for row in range(r.topRow(), r.bottomRow() + 1):
                rows_to_remove.add(row)
                
        # Remove from data in reverse order
        for row in sorted(list(rows_to_remove), reverse=True):
            self.queue_data.pop(row)
            
        self.refresh_table()
        self.btn_proceed.setEnabled(len(self.queue_data) > 0)
        
    def clear_workbench(self):
        self.queue_data = []
        self.refresh_table()
        self.btn_proceed.setEnabled(False)
        
    def proceed_to_processing(self):
        # Validate that all rows have client name and email (if email is needed)
        missing_data = []
        for i, item in enumerate(self.queue_data):
            if not item["client_name"]:
                missing_data.append(f"Row {i+1}: Missing Client Name")
            if item["valuation"] <= 0:
                missing_data.append(f"Row {i+1}: Valuation is 0 or negative")
                
        if missing_data:
            msg = "Please fix the following issues before processing:\n\n" + "\n".join(missing_data[:10])
            if len(missing_data) > 10:
                msg += f"\n...and {len(missing_data) - 10} more."
            QMessageBox.warning(self, "Incomplete Data", msg)
            return
            
        self.start_processing.emit(self.folder_path, self.queue_data)
