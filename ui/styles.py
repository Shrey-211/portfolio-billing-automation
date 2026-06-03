# Modern QSS styles for the Portfolio Billing Automation application

DARK_THEME_STYLE = """
/* Global Application Styles */
QWidget {
    background-color: #1a1b20;
    color: #e2e8f0;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 13px;
    selection-background-color: #3b82f6;
    selection-color: #ffffff;
}

/* MainWindow Layout */
QMainWindow {
    background-color: #121317;
}

/* Sidebar Navigation */
QFrame#Sidebar {
    background-color: #121316;
    border-right: 1px solid #2d3139;
    min-width: 220px;
    max-width: 220px;
}

QLabel#SidebarTitle {
    color: #ffffff;
    font-size: 16px;
    font-weight: bold;
    padding: 20px 10px;
    border-bottom: 1px solid #2d3139;
    margin-bottom: 15px;
}

/* Sidebar Navigation Buttons */
QPushButton#SidebarBtn {
    background-color: transparent;
    color: #a0aec0;
    border: none;
    border-radius: 6px;
    padding: 12px 15px;
    text-align: left;
    font-size: 14px;
    font-weight: 500;
    margin: 4px 10px;
}

QPushButton#SidebarBtn:hover {
    background-color: #20222a;
    color: #ffffff;
}

QPushButton#SidebarBtn:checked {
    background-color: #3b82f6;
    color: #ffffff;
    font-weight: bold;
}

/* ScrollAreas and StackedWidget */
QScrollArea {
    border: none;
    background-color: transparent;
}

QStackedWidget {
    background-color: #1a1b20;
}

/* Cards & Containers */
QFrame#Card {
    background-color: #21232c;
    border: 1px solid #2d3139;
    border-radius: 10px;
    padding: 15px;
}

QFrame#HeaderCard {
    background-color: #21232c;
    border-bottom: 1px solid #2d3139;
}

/* Headers */
QLabel#ScreenTitle {
    color: #ffffff;
    font-size: 22px;
    font-weight: bold;
}

QLabel#ScreenSubtitle {
    color: #718096;
    font-size: 13px;
}

QLabel#SectionHeader {
    color: #3b82f6;
    font-size: 15px;
    font-weight: bold;
    margin-top: 10px;
}

/* Inputs & Form Elements */
QLineEdit, QTextEdit, QComboBox, QSpinBox, QDoubleSpinBox {
    background-color: #16171d;
    border: 1px solid #2d3139;
    border-radius: 6px;
    padding: 8px 12px;
    color: #f7fafc;
}

QLineEdit:focus, QTextEdit:focus, QComboBox:focus, QSpinBox:focus {
    border: 1px solid #3b82f6;
}

QComboBox::drop-down {
    subcontrol-origin: padding;
    subcontrol-position: top right;
    width: 25px;
    border-left: none;
}

/* Buttons */
QPushButton {
    background-color: #2d3139;
    color: #e2e8f0;
    border: 1px solid #3e4452;
    border-radius: 6px;
    padding: 8px 16px;
    font-weight: 500;
    min-height: 18px;
}

QPushButton:hover {
    background-color: #3e4452;
}

QPushButton:pressed {
    background-color: #20222a;
}

/* Premium Primary Buttons */
QPushButton#PrimaryBtn {
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #3b82f6, stop:1 #2563eb);
    color: #ffffff;
    border: none;
}

QPushButton#PrimaryBtn:hover {
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #60a5fa, stop:1 #3b82f6);
}

QPushButton#PrimaryBtn:pressed {
    background-color: #1d4ed8;
}

QPushButton#PrimaryBtn:disabled {
    background-color: #2d3748;
    color: #718096;
}

/* Accent Buttons */
QPushButton#SuccessBtn {
    background-color: #10b981;
    color: #ffffff;
    border: none;
}

QPushButton#SuccessBtn:hover {
    background-color: #34d399;
}

QPushButton#DangerBtn {
    background-color: #ef4444;
    color: #ffffff;
    border: none;
}

QPushButton#DangerBtn:hover {
    background-color: #f87171;
}

/* Table View Styling */
QTableWidget {
    background-color: #16171d;
    border: 1px solid #2d3139;
    border-radius: 8px;
    gridline-color: #2d3139;
}

QTableWidget::item {
    padding: 8px;
    border-bottom: 1px solid #2d3139;
}

QTableWidget::item:selected {
    background-color: #2b3a55;
    color: #ffffff;
}

QHeaderView::section {
    background-color: #21232c;
    color: #a0aec0;
    padding: 8px;
    border: none;
    font-weight: bold;
    border-bottom: 2px solid #2d3139;
}

/* ScrollBars */
QScrollBar:vertical {
    border: none;
    background: #16171d;
    width: 10px;
    margin: 0px;
}

QScrollBar::handle:vertical {
    background: #3e4452;
    min-height: 20px;
    border-radius: 5px;
}

QScrollBar::handle:vertical:hover {
    background: #4f5666;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    border: none;
    background: none;
}

QScrollBar:horizontal {
    border: none;
    background: #16171d;
    height: 10px;
    margin: 0px;
}

QScrollBar::handle:horizontal {
    background: #3e4452;
    min-width: 20px;
    border-radius: 5px;
}

QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
    border: none;
    background: none;
}

/* Progress Bar */
QProgressBar {
    border: 1px solid #2d3139;
    border-radius: 6px;
    background-color: #16171d;
    text-align: center;
    color: #ffffff;
    font-weight: bold;
}

QProgressBar::chunk {
    background-color: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #3b82f6, stop:1 #10b981);
    border-radius: 5px;
}

/* Tab Widget */
QTabWidget::pane {
    border: 1px solid #2d3139;
    background-color: #21232c;
    border-radius: 8px;
    top: -1px;
}

QTabBar::tab {
    background-color: #16171d;
    color: #a0aec0;
    border: 1px solid #2d3139;
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    padding: 8px 16px;
    margin-right: 4px;
}

QTabBar::tab:hover {
    background-color: #20222a;
    color: #ffffff;
}

QTabBar::tab:selected {
    background-color: #21232c;
    color: #ffffff;
    border-bottom: 1px solid #21232c;
    font-weight: bold;
}
"""
