from PySide6.QtWidgets import QMainWindow, QWidget, QHBoxLayout, QVBoxLayout, QPushButton, QLabel, QFrame, QStackedWidget, QButtonGroup
from PySide6.QtCore import Qt, Slot
from ui.styles import DARK_THEME_STYLE
from ui.home_screen import HomeScreen
from ui.workbench_screen import WorkbenchScreen
from ui.processing_screen import ProcessingScreen
from ui.results_screen import ResultsScreen
from ui.settings_screen import SettingsScreen

class MainWindow(QMainWindow):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Portfolio Billing Automation Desktop")
        self.resize(1100, 750)
        self.setStyleSheet(DARK_THEME_STYLE)
        self.setup_ui()
        
    def setup_ui(self):
        # Main widget & layout
        self.main_widget = QWidget()
        self.setCentralWidget(self.main_widget)
        
        main_layout = QHBoxLayout(self.main_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # --- SIDEBAR ---
        self.sidebar = QFrame()
        self.sidebar.setObjectName("Sidebar")
        
        sidebar_layout = QVBoxLayout(self.sidebar)
        sidebar_layout.setContentsMargins(0, 0, 0, 0)
        sidebar_layout.setSpacing(5)
        
        # App Title in Sidebar
        title_label = QLabel("Antigravity")
        title_label.setObjectName("SidebarTitle")
        title_label.setAlignment(Qt.AlignCenter)
        sidebar_layout.addWidget(title_label)
        
        # Nav Buttons group
        self.btn_group = QButtonGroup(self)
        self.btn_group.setExclusive(True)
        
        nav_items = [
            ("Home Dashboard", 0),
            ("Workbench Queue", 1),
            ("Active Process", 2),
            ("Batch Results", 3),
            ("System Settings", 4),
        ]
        
        self.nav_buttons = {}
        for name, page_index in nav_items:
            btn = QPushButton(name)
            btn.setObjectName("SidebarBtn")
            btn.setCheckable(True)
            btn.clicked.connect(lambda checked=False, idx=page_index: self.switch_page(idx))
            sidebar_layout.addWidget(btn)
            self.btn_group.addButton(btn, page_index)
            self.nav_buttons[page_index] = btn
            
        # Select Home by default
        self.nav_buttons[0].setChecked(True)
        
        sidebar_layout.addStretch()
        
        # Footer branding in sidebar
        lbl_version = QLabel("v1.0.0 (Local Only)")
        lbl_version.setStyleSheet("color: #718096; font-size: 11px; padding: 15px; font-weight: 500;")
        lbl_version.setAlignment(Qt.AlignCenter)
        sidebar_layout.addWidget(lbl_version)
        
        main_layout.addWidget(self.sidebar)
        
        # --- STACKED WORK CONTAINER ---
        self.stacked_widget = QStackedWidget()
        
        # Initialize Screens
        self.screen_home = HomeScreen()
        self.screen_workbench = WorkbenchScreen()
        self.screen_processing = ProcessingScreen()
        self.screen_results = ResultsScreen()
        self.screen_settings = SettingsScreen()
        
        # Add to stack
        self.stacked_widget.addWidget(self.screen_home)       # Index 0
        self.stacked_widget.addWidget(self.screen_workbench)  # Index 1
        self.stacked_widget.addWidget(self.screen_processing) # Index 2
        self.stacked_widget.addWidget(self.screen_results)    # Index 3
        self.stacked_widget.addWidget(self.screen_settings)   # Index 4
        
        main_layout.addWidget(self.stacked_widget, 1)
        
        # --- SIGNAL CONNECTIONS ---
        # Home -> Workbench
        self.screen_home.folder_scanned.connect(self.on_folder_imported)
        # Home -> Results (double click recent batch)
        self.screen_home.view_batch.connect(self.on_view_batch_results)
        
        # Workbench -> Processing
        self.screen_workbench.start_processing.connect(self.on_start_processing)
        
        # Processing -> Results
        self.screen_processing.processing_completed.connect(self.on_processing_finished)
        
        # Results -> Home
        self.screen_results.back_to_home.connect(self.on_return_home)
        
        # Settings -> refresh Home or others if needed
        self.screen_settings.settings_saved.connect(self.on_settings_updated)
        
    def switch_page(self, index):
        self.stacked_widget.setCurrentIndex(index)
        self.nav_buttons[index].setChecked(True)
        
        # Specific page loading hooks
        if index == 0:
            self.screen_home.refresh_recent_batches()
            
    @Slot(str, list)
    def on_folder_imported(self, folder_path, files):
        self.screen_workbench.load_files(folder_path, files)
        self.switch_page(1) # Go to Workbench
        
    @Slot(str, list)
    def on_start_processing(self, folder_path, file_data_list):
        self.screen_processing.start_run(folder_path, file_data_list)
        self.switch_page(2) # Go to Processing progress bar
        
    @Slot(int)
    def on_processing_finished(self, batch_id):
        self.screen_results.load_batch_results(batch_id)
        self.switch_page(3) # Go to Results list
        self.screen_home.refresh_recent_batches()
        
    @Slot(int)
    def on_view_batch_results(self, batch_id):
        self.screen_results.load_batch_results(batch_id)
        self.switch_page(3) # Go to Results list
        
    @Slot()
    def on_return_home(self):
        self.switch_page(0) # Back to Home Dashboard
        
    @Slot()
    def on_settings_updated(self):
        # Reload any configs in other screens if caching was active
        pass
