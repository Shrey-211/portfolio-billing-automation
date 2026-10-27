import os
import sys
import openpyxl
import sqlite3
import backend.database as database
import backend.processing as processing
import backend.email_service as email_service

def create_sample_portfolios(test_dir):
    """Generates synthetic portfolio excel files for repeatable integration testing."""
    os.makedirs(test_dir, exist_ok=True)
    sample_clients = [
        {
            "filename": "alpha_investors.xlsx",
            "name": "Alpha Investors Pvt Ltd",
            "type": "Type 1",
            "state": "Maharashtra",
            "email": "alpha@example.com",
            "cc": "finance@example.com, audit@example.com",
            "address": "Floor 12, Express Towers, Nariman Point, Mumbai 400021",
            "gstin": "27AAACA1234A1Z5",
            "valuation": 25000000
        },
        {
            "filename": "beta_capital.xlsx",
            "name": "Beta Capital LLC",
            "type": "Type 2",
            "state": "Karnataka",
            "email": "beta@example.com",
            "cc": "billing@example.com",
            "address": "UB City, Vittal Mallya Road, Bengaluru 560001",
            "gstin": "29AAACB5678B1Z6",
            "valuation": 65000000
        },
        {
            "filename": "gamma_trust.xlsx",
            "name": "Gamma Trust Holdings",
            "type": "Type 1",
            "state": "Gujarat",
            "email": "gamma@example.com",
            "cc": "",
            "address": "GIFT City, Gandhinagar, Gujarat 382355",
            "gstin": "24AAACG9012C1Z7",
            "valuation": 15000000
        }
    ]
    for client in sample_clients:
        filepath = os.path.join(test_dir, client["filename"])
        if not os.path.exists(filepath):
            wb = openpyxl.Workbook()
            # Default sheet as Portfolio
            ws_port = wb.active
            ws_port.title = "Portfolio"
            ws_port.append(["Security / Asset", "Quantity", "Market Value (INR)"])
            ws_port.append(["HDFC Bank Ltd", 5000, client["valuation"] * 0.4])
            ws_port.append(["Reliance Industries", 3000, client["valuation"] * 0.35])
            ws_port.append(["Tata Consultancy Services", 2000, client["valuation"] * 0.25])
            
            # Metadata sheet
            ws_meta = wb.create_sheet(title="Metadata")
            ws_meta.append(["client_name", client["name"]])
            ws_meta.append(["client_type", client["type"]])
            ws_meta.append(["state", client["state"]])
            ws_meta.append(["email", client["email"]])
            ws_meta.append(["cc_email", client["cc"]])
            ws_meta.append(["address", client["address"]])
            ws_meta.append(["gstin", client["gstin"]])
            ws_meta.append(["fee_calculation_type", "slab"])
            ws_meta.append(["valuation", client["valuation"]])
            
            wb.save(filepath)
            wb.close()
            print(f"Created synthetic portfolio: {filepath}")

def test_unit_components(test_db):
    print("\n--- 1. Testing Component Unit Tests ---")
    
    # 1. Email parsing test
    raw_emails = "user1@example.com, user2@example.com; user3@example.com ,, user1@example.com"
    parsed = email_service.parse_email_list(raw_emails)
    assert len(parsed) == 3, f"Expected 3 unique emails, got {len(parsed)}: {parsed}"
    assert "user1@example.com" in parsed and "user2@example.com" in parsed and "user3@example.com" in parsed
    print(f" [PASS] Email parsing verified: {parsed}")
    
    # 2. Safe AST Formula Evaluation
    formula = "Value * Rate / 4"
    fee_calc = processing.calculate_formula_fee(formula, 10000000, 0.0025)
    assert fee_calc == 6250.0, f"Expected 6250.0, got {fee_calc}"
    
    formula2 = "=(Value * Rate) + 500"
    fee_calc2 = processing.calculate_formula_fee(formula2, 1000000, 0.005)
    assert fee_calc2 == 5500.0, f"Unexpected result {fee_calc2}"
    print(f" [PASS] AST Formula fee evaluation verified: {formula} => {fee_calc}, {formula2} => {fee_calc2}")
    
    # 3. Numeric string cleaner
    num1 = processing.clean_numeric_str("₹ 25,40,000.50")
    assert num1 == 2540000.5, f"Expected 2540000.5, got {num1}"
    print(f" [PASS] Numeric string cleaning verified: {num1}")
    
    # 4. Database WAL & Pragma verification
    conn = database.get_db_connection(test_db)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode;")
    j_mode = cur.fetchone()[0]
    cur.execute("PRAGMA busy_timeout;")
    b_timeout = cur.fetchone()[0]
    conn.close()
    assert j_mode.lower() == "wal", f"Expected WAL mode, got {j_mode}"
    assert b_timeout >= 30000, f"Expected >= 30000ms busy timeout, got {b_timeout}"
    print(f" [PASS] Database WAL & busy timeout verified (journal_mode={j_mode}, busy_timeout={b_timeout})")
    
    # 5. Database Automated Rolling Backup
    backup_file = database.backup_db(test_db)
    assert backup_file and os.path.exists(backup_file), f"Backup file not created: {backup_file}"
    print(f" [PASS] Database backup verified: {backup_file}")
    
    # 6. Non-destructive Client Upsert
    client_payload = {
        "client_name": "Test Client Alpha",
        "client_type": "Type 1",
        "state": "Maharashtra",
        "email": "test@alpha.com",
        "cc_email": "cc@alpha.com",
        "address": "Nariman Point",
        "gstin": "27TEST1234A1Z1"
    }
    database.save_client(client_payload, test_db)
    # Upsert with updated email
    client_payload["email"] = "updated@alpha.com"
    database.save_client(client_payload, test_db)
    fetched = database.get_client("Test Client Alpha", test_db)
    assert fetched is not None, "Client not found after upsert"
    assert fetched["email"] == "updated@alpha.com", f"Expected updated@alpha.com, got {fetched['email']}"
    assert fetched["address"] == "Nariman Point", "Address field not preserved properly"
    print(f" [PASS] Non-destructive client upsert verified.")

def test_backend_pipeline():
    print("=== STARTING FULL BACKEND PIPELINE INTEGRATION TEST ===")
    
    # Test directory and database
    test_dir = os.path.abspath("test_data")
    test_db = os.path.join(test_dir, "test_app.db")
    
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except Exception:
            pass
            
    print(f"Initializing test database at: {test_db}")
    database.init_db(test_db)
    
    # Run unit component tests
    test_unit_components(test_db)
    
    # Ensure sample portfolios exist
    create_sample_portfolios(test_dir)
    
    files_to_test = [
        os.path.join(test_dir, "alpha_investors.xlsx"),
        os.path.join(test_dir, "beta_capital.xlsx"),
        os.path.join(test_dir, "gamma_trust.xlsx")
    ]
    
    print("\n--- 2. Scanning Portfolios ---")
    for fp in files_to_test:
        assert os.path.exists(fp), f"File missing: {fp}"
        print(f" Found: {os.path.basename(fp)}")
        
    # Output Directories
    pdf_dir = os.path.join(test_dir, "pdf")
    os.makedirs(pdf_dir, exist_ok=True)
    static_xlsx_dir = os.path.join(pdf_dir, "processed_xlsx")
    os.makedirs(static_xlsx_dir, exist_ok=True)
    
    # 3. Simulate Batch Processing
    batch_id = database.create_batch(test_dir, len(files_to_test), test_db)
    print(f"\n--- 3. Created Batch ID: {batch_id} ---")
    
    completed = 0
    failed = 0
    
    settings = database.get_all_settings(test_db)
    next_inv_num = int(settings.get("next_invoice_number", "1"))
    invoice_prefix = settings.get("invoice_prefix", "INV-2026-")
    rules = database.get_fee_rules(test_db)
    fee_type = database.get_setting("fee_calculation_type", "slab", test_db)
    
    for fp in files_to_test:
        print(f"\nProcessing {os.path.basename(fp)}...")
        meta = processing.get_client_metadata(fp)
        assert meta is not None, f"Failed to load metadata sheet for {fp}"
        
        client_name = meta["client_name"]
        valuation = meta["valuation"]
        state = meta["state"]
        address = meta["address"]
        gstin = meta["gstin"]
        
        print(f" Client: {client_name} | Valuation: INR {valuation:,.2f} | State: {state}")
        
        safe_name = client_name.replace(" ", "_").replace(".", "")
        flat_excel_path = os.path.join(static_xlsx_dir, f"{safe_name}_Processed.xlsx")
        portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_name}_Portfolio.pdf")
        invoice_pdf_path = os.path.join(pdf_dir, f"{safe_name}_Invoice.pdf")
        
        # Formula Stripping
        processing.cleanse_formulas(fp, flat_excel_path)
        assert os.path.exists(flat_excel_path), "Cleansed workbook not created"
        
        # Calculations
        fee_amount = processing.calculate_fees(valuation, rules, fee_type)
        gst_calc = processing.calculate_gst(fee_amount, state, settings)
        cgst = gst_calc["cgst"]
        sgst = gst_calc["sgst"]
        igst = gst_calc["igst"]
        total_amount = gst_calc["total_amount"]
        
        # Check intra-state vs inter-state tax logic
        our_state = settings.get("advisor_state", "Maharashtra").lower()
        if state.lower() == our_state:
            assert cgst > 0 and sgst > 0 and igst == 0, f"Expected CGST+SGST for intra-state {state}"
        else:
            assert igst > 0 and cgst == 0 and sgst == 0, f"Expected IGST for inter-state {state}"
            
        print(f" Calculated Tax: CGST={cgst:,.2f}, SGST={sgst:,.2f}, IGST={igst:,.2f} | Total={total_amount:,.2f}")
        
        # ReportLab Invoice PDF Generation
        invoice_code = f"{invoice_prefix}{next_inv_num:04d}"
        invoice_data = {
            "invoice_number": invoice_code,
            "date": "27-Oct-2026",
            "client_name": client_name,
            "client_address": address,
            "client_state": state,
            "client_gstin": gstin,
            "valuation": valuation,
            "fee_amount": fee_amount,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_amount": total_amount
        }
        processing.generate_invoice_pdf(invoice_pdf_path, invoice_data, settings)
        assert os.path.exists(invoice_pdf_path), f"Invoice PDF missing: {invoice_pdf_path}"
        assert os.path.getsize(invoice_pdf_path) > 1000, "Invoice PDF appears corrupted or empty"
        print(f" Generated Invoice PDF: {os.path.basename(invoice_pdf_path)} ({os.path.getsize(invoice_pdf_path)} bytes)")
        
        # Log to DB
        job_item_data = {
            "batch_id": batch_id,
            "filename": os.path.basename(fp),
            "client_name": client_name,
            "valuation": valuation,
            "fee_amount": fee_amount,
            "cgst": cgst,
            "sgst": sgst,
            "igst": igst,
            "total_amount": total_amount,
            "status": "Completed",
            "error_msg": "",
            "portfolio_pdf_path": portfolio_pdf_path,
            "invoice_pdf_path": invoice_pdf_path,
            "email_status": "Pending",
            "invoice_number": invoice_code
        }
        item_id = database.add_job_item(job_item_data, test_db)
        assert item_id > 0, "Failed to insert job item into DB"
        
        next_inv_num += 1
        completed += 1
        
    # Finalize batch in DB
    database.save_setting("next_invoice_number", next_inv_num, test_db)
    batch_status = "Completed" if failed == 0 else ("Failed" if completed == 0 else "Partially Completed")
    database.update_batch(batch_id, completed, failed, batch_status, test_db)
    
    # Read back items from DB to verify logging
    items = database.get_batch_items(batch_id, test_db)
    assert len(items) == len(files_to_test), f"Expected {len(files_to_test)} items in batch, got {len(items)}"
    for it in items:
        assert it["status"] == "Completed"
        assert it["invoice_pdf_path"] and os.path.exists(it["invoice_pdf_path"])
        print(f" DB Verified: {it['client_name']} -> Invoice #{it.get('invoice_number', 'N/A')} (INR {it['total_amount']:,.2f})")
        
    print("\n=== ALL BACKEND PIPELINE & INTEGRITY TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_backend_pipeline()
