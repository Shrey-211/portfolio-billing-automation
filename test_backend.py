import os
import sys
import openpyxl
import database
import processing

def test_backend_pipeline():
    print("=== STARTING BACKEND PIPELINE TEST ===")
    
    # 1. Initialize SQLite Database using a temporary file for testing
    test_db = os.path.abspath("test_data/test_app.db")
    if os.path.exists(test_db):
        try:
            os.remove(test_db)
        except:
            pass
            
    print(f"Initializing database at: {test_db}")
    database.init_db(test_db)
    
    # Verify defaults are in place
    gst_cgst = database.get_setting("gst_rate_cgst", "0.0", test_db)
    fee_type = database.get_setting("fee_calculation_type", "", test_db)
    print(f"Loaded Settings: CGST={gst_cgst}%, FeeType={fee_type}")
    
    # Load default rules
    rules = database.get_fee_rules(test_db)
    print(f"Loaded {len(rules)} fee rules.")
    for r in rules:
        print(f" - Range: {r['min_value']} to {r['max_value']} | Percentage: {r['percentage']}%")
        
    # 2. Scan generated portfolios
    test_dir = os.path.abspath("test_data")
    files_to_test = [
        os.path.join(test_dir, "alpha_investors.xlsx"),
        os.path.join(test_dir, "beta_capital.xlsx"),
        os.path.join(test_dir, "gamma_trust.xlsx")
    ]
    
    print("\nScanning Portfolios:")
    for fp in files_to_test:
        if not os.path.exists(fp):
            print(f"Error: {fp} does not exist.")
            sys.exit(1)
        print(f" Found: {os.path.basename(fp)}")
        
    # Output Directory
    pdf_dir = os.path.join(test_dir, "pdf")
    os.makedirs(pdf_dir, exist_ok=True)
    static_xlsx_dir = os.path.join(pdf_dir, "processed_xlsx")
    os.makedirs(static_xlsx_dir, exist_ok=True)
    
    # 3. Simulate Batch Processing
    batch_id = database.create_batch(test_dir, len(files_to_test), test_db)
    print(f"\nCreated Test Batch ID: {batch_id}")
    
    completed = 0
    failed = 0
    
    settings = database.get_all_settings(test_db)
    next_inv_num = int(settings.get("next_invoice_number", "1"))
    invoice_prefix = settings.get("invoice_prefix", "INV-2026-")
    
    for fp in files_to_test:
        print(f"\n--- Processing {os.path.basename(fp)} ---")
        meta = processing.get_client_metadata(fp)
        if not meta:
            print("Failed to load metadata sheet!")
            failed += 1
            continue
            
        client_name = meta["client_name"]
        valuation = meta["valuation"]
        state = meta["state"]
        address = meta["address"]
        gstin = meta["gstin"]
        
        print(f"Client Profile: {client_name}")
        print(f"Valuation: INR {valuation:,.2f} | State: {state}")
        
        safe_name = client_name.replace(" ", "_").replace(".", "")
        flat_excel_path = os.path.join(static_xlsx_dir, f"{safe_name}_Processed.xlsx")
        portfolio_pdf_path = os.path.join(pdf_dir, f"{safe_name}_Portfolio.pdf")
        invoice_pdf_path = os.path.join(pdf_dir, f"{safe_name}_Invoice.pdf")
        
        try:
            # Formula Stripping
            print("Running formula cleansing...")
            processing.cleanse_formulas(fp, flat_excel_path)
            print(f"Saved cleansed workbook to {os.path.basename(flat_excel_path)}")
            
            # Verify formulas are cleared (optional check: load sheet and verify)
            wb_test = openpyxl.load_workbook(flat_excel_path)
            metadata_val = wb_test["Metadata"]["B9"].value # Valuation cell
            print(f"Cleansed valuation cell type: {type(metadata_val)} | value: {metadata_val}")
            wb_test.close()
            
            # Calculations
            fee_amount = processing.calculate_fees(valuation, rules, fee_type)
            print(f"Calculated base fee: INR {fee_amount:,.2f}")
            
            gst_calc = processing.calculate_gst(fee_amount, state, settings)
            cgst = gst_calc["cgst"]
            sgst = gst_calc["sgst"]
            igst = gst_calc["igst"]
            total_amount = gst_calc["total_amount"]
            
            print(f"Calculated Tax: CGST={cgst:,.2f}, SGST={sgst:,.2f}, IGST={igst:,.2f} | Total={total_amount:,.2f}")
            
            # Excel to PDF Export (using win32com if Excel is installed)
            print("Exporting Portfolio sheet to PDF (Excel automation)...")
            if processing.EXCEL_AVAILABLE:
                processing.convert_excel_to_pdf(flat_excel_path, portfolio_pdf_path)
                print(f"Generated Portfolio PDF at: {os.path.basename(portfolio_pdf_path)}")
            else:
                print("Skipping Excel-to-PDF: Microsoft Excel is not installed/running locally.")
                
            # ReportLab Invoice PDF Generation
            print("Generating GST Compliant Tax Invoice PDF...")
            invoice_code = f"{invoice_prefix}{next_inv_num:04d}"
            invoice_data = {
                "invoice_number": invoice_code,
                "date": "03-Jun-2026",
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
            print(f"Generated Invoice PDF at: {os.path.basename(invoice_pdf_path)} with No: {invoice_code}")
            
            # Increment invoice counter
            next_inv_num += 1
            completed += 1
            
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
                "email_status": "Pending"
            }
            database.add_job_item(job_item_data, test_db)
            print("Successfully logged job item in SQLite.")
            
        except Exception as e:
            failed += 1
            print(f"Error processing item: {e}")
            import traceback
            traceback.print_exc()
            
    # Finalize batch in DB
    database.save_setting("next_invoice_number", next_inv_num, test_db)
    batch_status = "Completed" if failed == 0 else ("Failed" if completed == 0 else "Partially Completed")
    database.update_batch(batch_id, completed, failed, batch_status, test_db)
    print(f"\nBatch finalized in database. Status: {batch_status}")
    
    # Read back items from DB to verify logging
    items = database.get_batch_items(batch_id, test_db)
    print(f"\nVerifying SQLite logs. Found {len(items)} items inside batch:")
    for it in items:
        print(f" - {it['client_name']}: Valuation={it['valuation']:,.2f} | Total Invoice={it['total_amount']:,.2f} | Status={it['status']}")
        
    print("\n=== PIPELINE TEST COMPLETED ===")

if __name__ == "__main__":
    test_backend_pipeline()
