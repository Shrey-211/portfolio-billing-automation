from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QPushButton, QLabel, 
    QLineEdit, QComboBox, QDoubleSpinBox, QSpinBox, QTextEdit, 
    QTabWidget, QTableWidget, QTableWidgetItem, QFrame, QHeaderView,
    QFormLayout, QMessageBox, QInputDialog
)
from PySide6.QtCore import Qt, Signal
import database

class SettingsScreen(QWidget):
    # Signals
    settings_saved = Signal()
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_ui()
        self.load_settings()
        
    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(20)
        main_layout.setContentsMargins(30, 30, 30, 30)
        
        # --- HEADER ---
        header_layout = QVBoxLayout()
        title = QLabel("Settings")
        title.setObjectName("ScreenTitle")
        subtitle = QLabel("Configure company details, invoice numbers, tax rates, fee brackets, and email options.")
        subtitle.setObjectName("ScreenSubtitle")
        header_layout.addWidget(title)
        header_layout.addWidget(subtitle)
        main_layout.addLayout(header_layout)
        
        # --- TAB CONTAINER ---
        self.tabs = QTabWidget()
        
        # 1. Tab - Company Profile
        self.tab_company = QWidget()
        self.setup_company_tab()
        self.tabs.addTab(self.tab_company, "Company Profile")
        
        # 2. Tab - Fee Rules
        self.tab_fees = QWidget()
        self.setup_fees_tab()
        self.tabs.addTab(self.tab_fees, "Fee Calculations")
        
        # 3. Tab - GST & Invoices
        self.tab_gst_inv = QWidget()
        self.setup_gst_inv_tab()
        self.tabs.addTab(self.tab_gst_inv, "GST & Invoicing")
        
        # 4. Tab - Email Integration
        self.tab_email = QWidget()
        self.setup_email_tab()
        self.tabs.addTab(self.tab_email, "Email Settings")
        
        main_layout.addWidget(self.tabs, 1)
        
        # --- BOTTOM SAVE BAR ---
        btn_layout = QHBoxLayout()
        self.btn_save = QPushButton("Save Configurations")
        self.btn_save.setObjectName("PrimaryBtn")
        self.btn_save.clicked.connect(self.save_all_settings)
        btn_layout.addStretch()
        btn_layout.addWidget(self.btn_save)
        main_layout.addLayout(btn_layout)
        
    def setup_company_tab(self):
        layout = QVBoxLayout(self.tab_company)
        layout.setContentsMargins(15, 15, 15, 15)
        
        form_frame = QFrame()
        form_frame.setObjectName("Card")
        form = QFormLayout(form_frame)
        form.setSpacing(12)
        
        self.txt_company_name = QLineEdit()
        form.addRow("Company Legal Name:", self.txt_company_name)
        
        self.txt_company_gstin = QLineEdit()
        self.txt_company_gstin.setMaxLength(15)
        form.addRow("Company GSTIN:", self.txt_company_gstin)
        
        self.txt_company_email = QLineEdit()
        form.addRow("Billing Support Email:", self.txt_company_email)
        
        self.txt_company_phone = QLineEdit()
        form.addRow("Billing Support Phone:", self.txt_company_phone)
        
        self.txt_company_address = QLineEdit()
        form.addRow("Registered Office Address:", self.txt_company_address)
        
        # Divider for Bank details
        bank_header = QLabel("Receiving Bank Details")
        bank_header.setObjectName("SectionHeader")
        form.addRow("", bank_header)
        
        self.txt_bank_name = QLineEdit()
        form.addRow("Bank Name:", self.txt_bank_name)
        
        self.txt_bank_acc = QLineEdit()
        form.addRow("Account Number:", self.txt_bank_acc)
        
        self.txt_bank_ifsc = QLineEdit()
        form.addRow("IFSC Code:", self.txt_bank_ifsc)
        
        self.txt_bank_branch = QLineEdit()
        form.addRow("Branch Details:", self.txt_bank_branch)
        
        layout.addWidget(form_frame)
        layout.addStretch()
        
    def setup_fees_tab(self):
        layout = QVBoxLayout(self.tab_fees)
        layout.setContentsMargins(15, 15, 15, 15)
        layout.setSpacing(15)
        
        # Fee Type selection
        type_card = QFrame()
        type_card.setObjectName("Card")
        type_layout = QHBoxLayout(type_card)
        type_layout.addWidget(QLabel("Fee Engine Calculation Method:"))
        
        self.cb_fee_type = QComboBox()
        self.cb_fee_type.addItems([
            "Flat Rate (based on qualifying tier)", 
            "Slab Rate (progressive rate over multiple brackets)"
        ])
        type_layout.addWidget(self.cb_fee_type, 1)
        layout.addWidget(type_card)
        
        # Brackets Table Card
        table_card = QFrame()
        table_card.setObjectName("Card")
        table_layout = QVBoxLayout(table_card)
        
        header_layout = QHBoxLayout()
        header_layout.addWidget(QLabel("Configure Brackets / Tiers"), 1)
        
        btn_add_bracket = QPushButton("+ Add Bracket Tier")
        btn_add_bracket.clicked.connect(self.add_bracket_row)
        header_layout.addWidget(btn_add_bracket)
        table_layout.addLayout(header_layout)
        
        self.rules_table = QTableWidget()
        self.rules_table.setColumnCount(4)
        self.rules_table.setHorizontalHeaderLabels([
            "Min Value (INR)", "Max Value (INR)", "Rate Percentage (%)", "Actions"
        ])
        self.rules_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.rules_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        
        table_layout.addWidget(self.rules_table)
        layout.addWidget(table_card)
        
    def setup_gst_inv_tab(self):
        layout = QVBoxLayout(self.tab_gst_inv)
        layout.setContentsMargins(15, 15, 15, 15)
        
        card = QFrame()
        card.setObjectName("Card")
        form = QFormLayout(card)
        form.setSpacing(12)
        
        header_gst = QLabel("GST Rates Settings")
        header_gst.setObjectName("SectionHeader")
        form.addRow("", header_gst)
        
        self.val_cgst = QDoubleSpinBox()
        self.val_cgst.setRange(0, 100)
        self.val_cgst.setSuffix(" %")
        form.addRow("CGST Rate (Intra-state):", self.val_cgst)
        
        self.val_sgst = QDoubleSpinBox()
        self.val_sgst.setRange(0, 100)
        self.val_sgst.setSuffix(" %")
        form.addRow("SGST Rate (Intra-state):", self.val_sgst)
        
        self.val_igst = QDoubleSpinBox()
        self.val_igst.setRange(0, 100)
        self.val_igst.setSuffix(" %")
        form.addRow("IGST Rate (Inter-state):", self.val_igst)
        
        # Divider for Invoicing
        header_inv = QLabel("Invoice Number Customization")
        header_inv.setObjectName("SectionHeader")
        form.addRow("", header_inv)
        
        self.txt_prefix = QLineEdit()
        self.txt_prefix.setPlaceholderText("e.g. INV-2026-")
        form.addRow("Invoice Prefix Series:", self.txt_prefix)
        
        self.val_next_inv = QSpinBox()
        self.val_next_inv.setRange(1, 9999999)
        form.addRow("Next Invoicing Count Number:", self.val_next_inv)
        
        layout.addWidget(card)
        layout.addStretch()
        
    def setup_email_tab(self):
        layout = QVBoxLayout(self.tab_email)
        layout.setContentsMargins(15, 15, 15, 15)
        layout.setSpacing(15)
        
        # Method Selection Card
        method_card = QFrame()
        method_card.setObjectName("Card")
        method_layout = QHBoxLayout(method_card)
        method_layout.addWidget(QLabel("Email Delivery Method:"))
        
        self.cb_email_mode = QComboBox()
        self.cb_email_mode.addItems(["SMTP Mail Server (Direct)", "Local Microsoft Outlook Application"])
        self.cb_email_mode.currentIndexChanged.connect(self.toggle_email_fields)
        method_layout.addWidget(self.cb_email_mode, 1)
        layout.addWidget(method_card)
        
        # SMTP Credentials Card
        self.smtp_card = QFrame()
        self.smtp_card.setObjectName("Card")
        smtp_form = QFormLayout(self.smtp_card)
        smtp_form.setSpacing(12)
        
        smtp_header = QLabel("SMTP Configuration (Gmail, Outlook 365, etc.)")
        smtp_header.setObjectName("SectionHeader")
        smtp_form.addRow("", smtp_header)
        
        self.txt_smtp_host = QLineEdit()
        self.txt_smtp_host.setPlaceholderText("smtp.gmail.com")
        smtp_form.addRow("SMTP Server Host:", self.txt_smtp_host)
        
        self.txt_smtp_port = QLineEdit()
        self.txt_smtp_port.setPlaceholderText("587")
        smtp_form.addRow("SMTP Port Number:", self.txt_smtp_port)
        
        self.txt_smtp_user = QLineEdit()
        self.txt_smtp_user.setPlaceholderText("billing@yourcompany.com")
        smtp_form.addRow("SMTP Login Username:", self.txt_smtp_user)
        
        self.txt_smtp_pass = QLineEdit()
        self.txt_smtp_pass.setEchoMode(QLineEdit.Password)
        self.txt_smtp_pass.setPlaceholderText("SMTP Account Password / App Password")
        smtp_form.addRow("SMTP Login Password:", self.txt_smtp_pass)
        
        layout.addWidget(self.smtp_card)
        
        # Template Card
        template_card = QFrame()
        template_card.setObjectName("Card")
        template_form = QFormLayout(template_card)
        template_form.setSpacing(12)
        
        template_header = QLabel("Email Template Editor")
        template_header.setObjectName("SectionHeader")
        template_form.addRow("", template_header)
        
        self.txt_subject = QLineEdit()
        template_form.addRow("Email Subject:", self.txt_subject)
        
        self.txt_body = QTextEdit()
        self.txt_body.setPlaceholderText("Variables: {ClientName}, {InvoiceNumber}, {Valuation}, {FeeAmount}, {TotalAmount}")
        template_form.addRow("Email Body:", self.txt_body)
        
        layout.addWidget(template_card)
        
    def toggle_email_fields(self, index):
        # Index 0 is SMTP, Index 1 is Outlook
        self.smtp_card.setVisible(index == 0)
        
    def add_bracket_row(self, min_val=0, max_val=9999999999, pct=0.0):
        row = self.rules_table.rowCount()
        self.rules_table.insertRow(row)
        
        # Min
        item_min = QTableWidgetItem(str(min_val))
        self.rules_table.setItem(row, 0, item_min)
        
        # Max
        item_max = QTableWidgetItem(str(max_val))
        self.rules_table.setItem(row, 1, item_max)
        
        # Pct
        item_pct = QTableWidgetItem(str(pct))
        self.rules_table.setItem(row, 2, item_pct)
        
        # Delete Action
        btn_del = QPushButton("Delete")
        btn_del.clicked.connect(lambda checked=False, r=row: self.delete_bracket_row(r))
        btn_del.setObjectName("DangerBtn")
        self.rules_table.setCellWidget(row, 3, btn_del)
        
    def delete_bracket_row(self, row):
        # We need to find the actual row containing this button
        button = self.sender()
        if button:
            idx = self.rules_table.indexAt(button.pos())
            if idx.isValid():
                self.rules_table.removeRow(idx.row())
                
    def load_settings(self):
        # 1. Company profile
        self.txt_company_name.setText(database.get_setting("company_name", ""))
        self.txt_company_gstin.setText(database.get_setting("company_gstin", ""))
        self.txt_company_email.setText(database.get_setting("company_email", ""))
        self.txt_company_phone.setText(database.get_setting("company_phone", ""))
        self.txt_company_address.setText(database.get_setting("company_address", ""))
        self.txt_bank_name.setText(database.get_setting("company_bank_name", ""))
        self.txt_bank_acc.setText(database.get_setting("company_bank_account", ""))
        self.txt_bank_ifsc.setText(database.get_setting("company_bank_ifsc", ""))
        self.txt_bank_branch.setText(database.get_setting("company_bank_branch", ""))
        
        # 2. Fee Calculation Mode
        fee_type = database.get_setting("fee_calculation_type", "flat")
        if fee_type == "flat":
            self.cb_fee_type.setCurrentIndex(0)
        else:
            self.cb_fee_type.setCurrentIndex(1)
            
        # Fee Rules Brackets
        rules = database.get_fee_rules()
        self.rules_table.setRowCount(0)
        for r in rules:
            self.add_bracket_row(r["min_value"], r["max_value"], r["percentage"])
            
        # 3. GST Rates
        self.val_cgst.setValue(float(database.get_setting("gst_rate_cgst", "9.0")))
        self.val_sgst.setValue(float(database.get_setting("gst_rate_sgst", "9.0")))
        self.val_igst.setValue(float(database.get_setting("gst_rate_igst", "18.0")))
        
        # Invoicing Prefix/Counter
        self.txt_prefix.setText(database.get_setting("invoice_prefix", "INV-2026-"))
        try:
            self.val_next_inv.setValue(int(database.get_setting("next_invoice_number", "1")))
        except:
            self.val_next_inv.setValue(1)
            
        # 4. Email integration settings
        use_outlook = database.get_setting("email_use_outlook", "0") == "1"
        self.cb_email_mode.setCurrentIndex(1 if use_outlook else 0)
        
        self.txt_smtp_host.setText(database.get_setting("email_smtp_server", ""))
        self.txt_smtp_port.setText(database.get_setting("email_smtp_port", "587"))
        self.txt_smtp_user.setText(database.get_setting("email_smtp_user", ""))
        self.txt_smtp_pass.setText(database.get_setting("email_smtp_pass", ""))
        
        self.txt_subject.setText(database.get_setting("email_subject_template", ""))
        self.txt_body.setPlainText(database.get_setting("email_body_template", ""))
        
        # Update fields visibility
        self.smtp_card.setVisible(not use_outlook)
        
    def save_all_settings(self):
        # 1. Read values from inputs
        configs = {
            "company_name": self.txt_company_name.text().strip(),
            "company_gstin": self.txt_company_gstin.text().strip().upper(),
            "company_email": self.txt_company_email.text().strip(),
            "company_phone": self.txt_company_phone.text().strip(),
            "company_address": self.txt_company_address.text().strip(),
            "company_bank_name": self.txt_bank_name.text().strip(),
            "company_bank_account": self.txt_bank_acc.text().strip(),
            "company_bank_ifsc": self.txt_bank_ifsc.text().strip().upper(),
            "company_bank_branch": self.txt_bank_branch.text().strip(),
            
            "fee_calculation_type": "flat" if self.cb_fee_type.currentIndex() == 0 else "slab",
            
            "gst_rate_cgst": str(self.val_cgst.value()),
            "gst_rate_sgst": str(self.val_sgst.value()),
            "gst_rate_igst": str(self.val_igst.value()),
            
            "invoice_prefix": self.txt_prefix.text().strip(),
            "next_invoice_number": str(self.val_next_inv.value()),
            
            "email_use_outlook": "1" if self.cb_email_mode.currentIndex() == 1 else "0",
            "email_smtp_server": self.txt_smtp_host.text().strip(),
            "email_smtp_port": self.txt_smtp_port.text().strip(),
            "email_smtp_user": self.txt_smtp_user.text().strip(),
            "email_smtp_pass": self.txt_smtp_pass.text().strip(),
            
            "email_subject_template": self.txt_subject.text().strip(),
            "email_body_template": self.txt_body.toPlainText()
        }
        
        # Validation checks
        if not configs["company_name"]:
            QMessageBox.warning(self, "Validation Error", "Company name is required.")
            return
            
        # Parse Fee Rules
        rules = []
        try:
            for r in range(self.rules_table.rowCount()):
                min_v = float(self.rules_table.item(r, 0).text())
                max_v = float(self.rules_table.item(r, 1).text())
                pct = float(self.rules_table.item(r, 2).text())
                
                if min_v >= max_v:
                    QMessageBox.warning(self, "Validation Error", f"Bracket row {r+1}: Min Value must be strictly less than Max Value.")
                    return
                rules.append({
                    "min_value": min_v,
                    "max_value": max_v,
                    "percentage": pct,
                    "flat_rate": 0.0
                })
        except ValueError:
            QMessageBox.warning(self, "Validation Error", "Fee brackets contain invalid numbers. Please check your entries.")
            return
            
        # Save configs
        try:
            database.save_all_settings(configs)
            database.save_fee_rules(rules)
            QMessageBox.information(self, "Settings Saved", "All configurations have been successfully saved to the database.")
            self.settings_saved.emit()
        except Exception as e:
            QMessageBox.critical(self, "Database Error", f"Failed to save settings to SQLite: {e}")
