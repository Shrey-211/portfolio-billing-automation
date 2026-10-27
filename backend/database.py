import os
import sqlite3
import shutil
import glob
from datetime import datetime

DEFAULT_DB_PATH = os.path.join(os.path.expanduser("~"), ".portfolio_billing", "app_database.db")

def get_db_connection(db_path=None):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
    
    # Ensure directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrency between reader/writer threads
    conn.execute("PRAGMA journal_mode=WAL;")
    # Set busy timeout to 30 seconds
    conn.execute("PRAGMA busy_timeout=30000;")
    # Enforce foreign key constraints
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def backup_db(db_path=None, max_backups=15):
    """
    Creates an atomic, safe backup of the SQLite database.
    Retains the most recent `max_backups` copies.
    """
    if db_path is None:
        db_path = DEFAULT_DB_PATH
        
    if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
        return None
        
    db_dir = os.path.dirname(db_path)
    backup_dir = os.path.join(db_dir, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"app_database_backup_{timestamp}.db")
    
    try:
        # Use SQLite Online Backup API for safe copy even if actively accessed
        src_conn = sqlite3.connect(db_path, timeout=30.0)
        dst_conn = sqlite3.connect(backup_path)
        with dst_conn:
            src_conn.backup(dst_conn)
        dst_conn.close()
        src_conn.close()
        
        # Cleanup older backups
        existing_backups = sorted(glob.glob(os.path.join(backup_dir, "app_database_backup_*.db")))
        while len(existing_backups) > max_backups:
            oldest = existing_backups.pop(0)
            try:
                os.remove(oldest)
            except Exception:
                pass
                
        return backup_path
    except Exception as e:
        print(f"Database backup warning: {e}")
        return None

def init_db(db_path=None):
    if db_path is None:
        db_path = DEFAULT_DB_PATH
        
    # Automatic safety backup before any schema check or migration
    if os.path.exists(db_path) and os.path.getsize(db_path) > 0:
        backup_db(db_path)

    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        
        # Settings table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """)
        
        # Fee Rules table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS fee_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            min_value REAL,
            max_value REAL,
            percentage REAL,
            flat_rate REAL
        )
        """)
        
        # Clients cache/registry
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT UNIQUE,
            client_type TEXT,
            state TEXT,
            email TEXT,
            cc_email TEXT,
            address TEXT,
            gstin TEXT
        )
        """)
        
        # Batches (for processing history)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_files INTEGER,
            processed_files INTEGER,
            failed_files INTEGER,
            status TEXT
        )
        """)
        
        # Job Items (individual files processed inside a batch)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER,
            filename TEXT,
            client_name TEXT,
            valuation REAL,
            fee_amount REAL,
            cgst REAL,
            sgst REAL,
            igst REAL,
            total_amount REAL,
            status TEXT,
            error_msg TEXT,
            portfolio_pdf_path TEXT,
            invoice_pdf_path TEXT,
            email_status TEXT DEFAULT 'Pending',
            is_paid INTEGER DEFAULT 0,
            payment_date TEXT,
            custom_message TEXT,
            invoice_number TEXT,
            FOREIGN KEY(batch_id) REFERENCES batches(id) ON DELETE CASCADE
        )
        """)

        # Ensure columns exist for older installations
        for col_def in [
            ("is_paid", "INTEGER DEFAULT 0"),
            ("payment_date", "TEXT"),
            ("custom_message", "TEXT"),
            ("invoice_number", "TEXT")
        ]:
            try:
                cursor.execute(f"ALTER TABLE job_items ADD COLUMN {col_def[0]} {col_def[1]}")
            except sqlite3.OperationalError:
                pass
        
        # Populate Default Settings if empty
        cursor.execute("SELECT COUNT(*) FROM settings")
        if cursor.fetchone()[0] == 0:
            default_settings = {
                "company_name": "Antigravity Wealth Management",
                "company_address": "101, FinTech Tower, Bandra Kurla Complex, Mumbai, MH - 400051",
                "company_gstin": "27AAACA1234A1Z0",
                "company_pan": "",
                "company_division": "Investment Advisory Division",
                "company_email": "billing@antigravitywealth.com",
                "company_phone": "+91 22 8888 8888",
                "company_bank_name": "HDFC Bank Ltd",
                "company_bank_account_name": "Antigravity Wealth Management",
                "company_bank_account": "50200012345678",
                "company_bank_ifsc": "HDFC0000123",
                "company_bank_branch": "BKC, Mumbai",
                "company_bank_account_type": "Current Account",
                "authorized_signatory": "Authorized Signatory",
                "authorized_signatory_title": "Authorized Signatory",
                "dispute_jurisdiction": "Mumbai Jurisdiction",
                "gst_rate_cgst": "9.0",
                "gst_rate_sgst": "9.0",
                "gst_rate_igst": "18.0",
                "fee_calculation_type": "flat",  # 'flat' or 'slab'
                "invoice_prefix": "INV-2026-",
                "next_invoice_number": "1",
                "email_use_outlook": "0",  # "1" for Outlook, "0" for SMTP
                "email_smtp_server": "smtp.gmail.com",
                "email_smtp_port": "587",
                "email_smtp_user": "",
                "email_smtp_pass": "",
                "email_subject_template": "Portfolio Performance Report & Invoice - {ClientName}",
                "email_body_template": "Dear {ClientName},\n\nPlease find attached your Portfolio Performance Report and GST Invoice ({InvoiceNumber}) for the period.\n\nPortfolio Valuation: INR {Valuation:,.2f}\nTotal Fees (incl. GST): INR {TotalAmount:,.2f}\n\nBest Regards,\nAntigravity Wealth Management",
                "taxable_amt_formula": "Value * Rate / 4"
            }
            for key, val in default_settings.items():
                cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", (key, val))
                
        # Ensure critical keys are present even if DB is from earlier version
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('taxable_amt_formula', 'Value * Rate / 4')")
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('dispute_jurisdiction', 'Mumbai Jurisdiction')")
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('authorized_signatory', 'Authorized Signatory')")
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('authorized_signatory_title', 'Authorized Signatory')")

        # Populate Default Fee Rules if empty
        cursor.execute("SELECT COUNT(*) FROM fee_rules")
        if cursor.fetchone()[0] == 0:
            default_rules = [
                (0, 10000000, 0.50, 0.0),        # Up to 1 Cr: 0.50%
                (10000000, 50000000, 0.40, 0.0),  # 1 Cr to 5 Cr: 0.40%
                (50000000, 9999999999, 0.30, 0.0) # Above 5 Cr: 0.30%
            ]
            for rule in default_rules:
                cursor.execute(
                    "INSERT INTO fee_rules (min_value, max_value, percentage, flat_rate) VALUES (?, ?, ?, ?)",
                    rule
                )

    conn.close()

def get_setting(key, default="", db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def save_setting(key, value, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.close()

def get_all_settings(db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: row["value"] for row in cursor.fetchall()}
    conn.close()
    return settings

def save_all_settings(settings_dict, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        for key, val in settings_dict.items():
            cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(val)))
    conn.close()

def get_fee_rules(db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, min_value, max_value, percentage, flat_rate FROM fee_rules ORDER BY min_value ASC")
    rules = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rules

def save_fee_rules(rules_list, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM fee_rules")
        for r in rules_list:
            cursor.execute(
                "INSERT INTO fee_rules (min_value, max_value, percentage, flat_rate) VALUES (?, ?, ?, ?)",
                (r["min_value"], r["max_value"], r["percentage"], r["flat_rate"])
            )
    conn.close()

def get_client(client_name, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM clients WHERE client_name = ?", (client_name,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def save_client(client_data, db_path=None):
    """
    Non-destructive client save. Uses ON CONFLICT to update in place
    without changing the record ID or breaking relational integrity.
    """
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO clients (client_name, client_type, state, email, cc_email, address, gstin)
        VALUES (:client_name, :client_type, :state, :email, :cc_email, :address, :gstin)
        ON CONFLICT(client_name) DO UPDATE SET
            client_type = excluded.client_type,
            state = excluded.state,
            email = excluded.email,
            cc_email = excluded.cc_email,
            address = excluded.address,
            gstin = excluded.gstin
        """, client_data)
    conn.close()

def create_batch(folder_path, total_files, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO batches (folder_path, total_files, processed_files, failed_files, status) VALUES (?, ?, 0, 0, 'Running')",
            (folder_path, total_files)
        )
        batch_id = cursor.lastrowid
    conn.close()
    return batch_id

def update_batch(batch_id, processed_files, failed_files, status, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE batches SET processed_files = ?, failed_files = ?, status = ? WHERE id = ?",
            (processed_files, failed_files, status, batch_id)
        )
    conn.close()

def get_batch(batch_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM batches WHERE id = ?", (batch_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def add_job_item(item_data, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        if "custom_message" not in item_data:
            item_data["custom_message"] = ""
        if "is_paid" not in item_data:
            item_data["is_paid"] = 0
        if "payment_date" not in item_data:
            item_data["payment_date"] = None
        if "invoice_number" not in item_data:
            item_data["invoice_number"] = ""
            
        cursor.execute("""
        INSERT INTO job_items (
            batch_id, filename, client_name, valuation, fee_amount, 
            cgst, sgst, igst, total_amount, status, error_msg, 
            portfolio_pdf_path, invoice_pdf_path, email_status, custom_message,
            is_paid, payment_date, invoice_number
        ) VALUES (
            :batch_id, :filename, :client_name, :valuation, :fee_amount, 
            :cgst, :sgst, :igst, :total_amount, :status, :error_msg, 
            :portfolio_pdf_path, :invoice_pdf_path, :email_status, :custom_message,
            :is_paid, :payment_date, :invoice_number
        )
        """, item_data)
        item_id = cursor.lastrowid
    conn.close()
    return item_id

def update_job_item(item_id, updates_dict, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        clean_updates = {k: v for k, v in updates_dict.items() if k != "id"}
        set_clause = ", ".join([f"{k} = :{k}" for k in clean_updates.keys()])
        clean_updates["id"] = item_id
        cursor.execute(f"UPDATE job_items SET {set_clause} WHERE id = :id", clean_updates)
    conn.close()

def get_job_item(item_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_batch_items(batch_id, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_items WHERE batch_id = ?", (batch_id,))
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items

def get_recent_batches(limit=10, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM batches ORDER BY timestamp DESC LIMIT ?", (limit,))
    batches = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return batches

def get_all_job_items(limit=1000, db_path=None):
    conn = get_db_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM job_items ORDER BY id DESC LIMIT ?", (limit,))
    items = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return items

def update_payment_status(item_id, is_paid, payment_date=None, db_path=None):
    conn = get_db_connection(db_path)
    with conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE job_items SET is_paid = ?, payment_date = ? WHERE id = ?",
            (is_paid, payment_date, item_id)
        )
    conn.close()
