import os
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QFileDialog, QListWidget, QListWidgetItem, QFrame, QStyle
)
from PySide6.QtCore import Qt, Signal
import database

class HomeScreen(QWidget):
    # Signals to communicate with the MainWindow controller
    folder_scanned = Signal(str, list) # Emitted when a folder is successfully scanned: (folder_path, file_list)
    view_batch = Signal(int)           # Emitted when the user clicks a recent batch: (batch_id)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.scanned_files = []
        self.selected_folder = ""
        self.setup_ui()
        self.refresh_recent_batches()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(30, 30, 30, 30)
        
        # --- HEADER ---
        header_layout = QVBoxLayout()
        title = QLabel("Home")
        title.setObjectName("ScreenTitle")
        subtitle = QLabel("Select a folder containing client portfolios to begin automated invoicing and reporting.")
        subtitle.setObjectName("ScreenSubtitle")
        header_layout.addWidget(title)
        header_layout.addWidget(subtitle)
        main_layout.addLayout(header_layout)
        
        # --- SELECT FOLDER CARD ---
        folder_card = QFrame()
        folder_card.setObjectName("Card")
        folder_layout = QVBoxLayout(folder_card)
        folder_layout.setSpacing(12)
        
        card_title = QLabel("Import Portfolios")
        card_title.setObjectName("SectionHeader")
        folder_layout.addWidget(card_title)
        
        action_layout = QHBoxLayout()
        self.lbl_folder_path = QLabel("No folder selected.")
        self.lbl_folder_path.setStyleSheet("color: #a0aec0; font-style: italic;")
        self.lbl_folder_path.setWordWrap(True)
        
        self.btn_select_folder = QPushButton("Select Portfolio Folder")
        self.btn_select_folder.setObjectName("PrimaryBtn")
        self.btn_select_folder.clicked.connect(self.select_folder)
        
        action_layout.addWidget(self.lbl_folder_path, 1)
        action_layout.addWidget(self.btn_select_folder)
        folder_layout.addLayout(action_layout)
        
        # Folder scan details
        self.lbl_scan_details = QLabel("")
        self.lbl_scan_details.setObjectName("ScreenSubtitle")
        folder_layout.addWidget(self.lbl_scan_details)
        
        self.btn_import = QPushButton("Import Files to Workbench")
        self.btn_import.setObjectName("SuccessBtn")
        self.btn_import.setEnabled(False)
        self.btn_import.clicked.connect(self.import_to_workbench)
        folder_layout.addWidget(self.btn_import)
        
        main_layout.addWidget(folder_card)
        
        # --- RECENT BATCHES SECTION ---
        recent_card = QFrame()
        recent_card.setObjectName("Card")
        recent_layout = QVBoxLayout(recent_card)
        recent_layout.setSpacing(12)
        
        recent_title = QLabel("Recent Invoicing Batches")
        recent_title.setObjectName("SectionHeader")
        recent_layout.addWidget(recent_title)
        
        self.list_batches = QListWidget()
        self.list_batches.setStyleSheet("QListWidget { background-color: #16171d; border: 1px solid #2d3139; border-radius: 6px; padding: 5px; } QListWidget::item { padding: 10px; border-bottom: 1px solid #2d3139; } QListWidget::item:hover { background-color: #20222a; }")
        self.list_batches.itemDoubleClicked.connect(self.on_batch_double_click)
        recent_layout.addWidget(self.list_batches)
        
        self.lbl_no_batches = QLabel("No recent batches found.")
        self.lbl_no_batches.setAlignment(Qt.AlignCenter)
        self.lbl_no_batches.setStyleSheet("color: #718096; padding: 20px;")
        recent_layout.addWidget(self.lbl_no_batches)
        
        main_layout.addWidget(recent_card, 1)
        
    def select_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Portfolio Folder", "")
        if not folder:
            return
            
        self.selected_folder = folder
        self.lbl_folder_path.setText(os.path.normpath(folder))
        self.lbl_folder_path.setStyleSheet("color: #ffffff; font-weight: bold;")
        
        # Scan for Excel files
        self.scanned_files = []
        try:
            for file in os.listdir(folder):
                # Only xlsx and xlsm files, ignore temporary office locks
                if (file.endswith(".xlsx") or file.endswith(".xlsm")) and not file.startswith("~$"):
                    self.scanned_files.append(os.path.join(folder, file))
        except Exception as e:
            self.lbl_scan_details.setText(f"Error scanning folder: {str(e)}")
            self.btn_import.setEnabled(False)
            return
            
        if self.scanned_files:
            file_names = [os.path.basename(f) for f in self.scanned_files]
            self.lbl_scan_details.setText(f"Found {len(self.scanned_files)} excel portfolio(s) in folder.")
            self.lbl_scan_details.setStyleSheet("color: #10b981; font-weight: bold;")
            self.btn_import.setEnabled(True)
        else:
            self.lbl_scan_details.setText("No excel files (.xlsx, .xlsm) found in selected folder.")
            self.lbl_scan_details.setStyleSheet("color: #ef4444; font-weight: bold;")
            self.btn_import.setEnabled(False)
            
    def import_to_workbench(self):
        if self.selected_folder and self.scanned_files:
            self.folder_scanned.emit(self.selected_folder, self.scanned_files)
            
    def refresh_recent_batches(self):
        self.list_batches.clear()
        try:
            batches = database.get_recent_batches(10)
            if batches:
                self.lbl_no_batches.hide()
                self.list_batches.show()
                for b in batches:
                    time_str = b["timestamp"]
                    status = b["status"]
                    path_base = os.path.basename(b["folder_path"])
                    item_text = f"Batch #{b['id']} - {path_base} | Files: {b['total_files']} | Processed: {b['processed_files']} | Failed: {b['failed_files']} | Status: {status} ({time_str})"
                    
                    item = QListWidgetItem(item_text)
                    item.setData(Qt.UserRole, b["id"])
                    
                    # Small visual indicator of status
                    if status == "Completed":
                        item.setForeground(Qt.green)
                    elif status == "Failed":
                        item.setForeground(Qt.red)
                    else:
                        item.setForeground(Qt.yellow)
                        
                    self.list_batches.addItem(item)
            else:
                self.list_batches.hide()
                self.lbl_no_batches.show()
        except Exception as e:
            print(f"Error fetching recent batches: {e}")
            self.list_batches.hide()
            self.lbl_no_batches.show()
            
    def on_batch_double_click(self, item):
        batch_id = item.data(Qt.UserRole)
        if batch_id:
            self.view_batch.emit(batch_id)
