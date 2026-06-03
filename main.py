import os
import sys
from PySide6.QtWidgets import QApplication
import database
from ui.main_window import MainWindow

def main():
    # 1. Initialize SQLite Database
    # This creates the tables and sets up defaults if they do not exist
    try:
        database.init_db()
        print("SQLite Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing SQLite Database: {e}")
        sys.exit(1)
        
    # 2. Launch the PySide6 Application
    app = QApplication(sys.argv)
    app.setApplicationName("Portfolio Billing Automation Desktop")
    app.setApplicationDisplayName("Portfolio Invoicing & Reporting")
    
    # 3. Open main window
    window = MainWindow()
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
