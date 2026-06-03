import os
import sys
import openpyxl
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

# For Windows Excel Automation
try:
    import win32com.client
    import pythoncom
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

def get_client_metadata(excel_path):
    """
    Scans the excel file for a sheet named 'Metadata' or 'ClientInfo' (case-insensitive).
    Extracts key-value pairs from Column A and B.
    """
    try:
        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    except Exception as e:
        print(f"Error loading {excel_path} for metadata: {e}")
        return None
        
    metadata_sheet = None
    for name in wb.sheetnames:
        if name.strip().lower() in ["metadata", "clientinfo", "client_info"]:
            metadata_sheet = name
            break
            
    if not metadata_sheet:
        wb.close()
        return None
        
    sheet = wb[metadata_sheet]
    metadata = {}
    
    # Read rows (up to 50 rows for safety)
    for r in range(1, 50):
        key_cell = sheet.cell(row=r, column=1).value
        val_cell = sheet.cell(row=r, column=2).value
        
        if key_cell is not None:
            key = str(key_cell).strip().lower().replace(" ", "_")
            metadata[key] = val_cell
            
    wb.close()
    
    # Map to standard keys
    mapped = {
        "client_name": metadata.get("client_name") or metadata.get("name") or "",
        "client_type": metadata.get("client_type") or metadata.get("type") or "Type 1",
        "state": metadata.get("state") or metadata.get("client_state") or "Maharashtra",
        "email": metadata.get("email") or metadata.get("client_email") or "",
        "cc_email": metadata.get("cc_email") or metadata.get("cc") or "",
        "address": metadata.get("address") or metadata.get("client_address") or "",
        "gstin": metadata.get("gstin") or metadata.get("client_gstin") or "",
    }
    
    # Try to parse valuation
    val_raw = metadata.get("valuation") or metadata.get("portfolio_valuation") or metadata.get("portfolio_value") or 0.0
    try:
        # Strip currency symbols and commas if it's a string
        if isinstance(val_raw, str):
            val_raw = val_raw.replace("₹", "").replace("$", "").replace(",", "").strip()
        mapped["valuation"] = float(val_raw)
    except Exception:
        mapped["valuation"] = 0.0
        
    return mapped

def cleanse_formulas(input_path, output_path):
    """
    Reads excel from input_path, converts all formulas to static values
    using the cached values from Excel, preserving all formatting and layout,
    and writes to output_path.
    """
    try:
        # Load workbook with data_only=True to get evaluated values
        wb_data = openpyxl.load_workbook(input_path, data_only=True)
        # Load workbook with data_only=False to keep formatting/properties
        wb_styled = openpyxl.load_workbook(input_path, data_only=False)
        
        for sheet_name in wb_styled.sheetnames:
            sheet_styled = wb_styled[sheet_name]
            # Some sheets might be missing in data-only mode due to openpyxl issues, check first
            if sheet_name not in wb_data.sheetnames:
                continue
            sheet_data = wb_data[sheet_name]
            
            # Iterate through all cells in the styled sheet
            for r in range(1, sheet_styled.max_row + 1):
                for c in range(1, sheet_styled.max_column + 1):
                    cell_styled = sheet_styled.cell(row=r, column=c)
                    val = cell_styled.value
                    
                    # If it's a formula (string starting with '=')
                    if isinstance(val, str) and val.startswith("="):
                        # Copy the evaluated value from the data sheet
                        eval_val = sheet_data.cell(row=r, column=c).value
                        cell_styled.value = eval_val
                        
        # Ensure output folder exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        wb_styled.save(output_path)
        wb_data.close()
        wb_styled.close()
        return True
    except Exception as e:
        print(f"Error in formula cleansing: {e}")
        import traceback
        traceback.print_exc()
        raise e

def calculate_fees(valuation, rules, calculation_type="flat"):
    """
    Calculates fees based on rules.
    rules: list of dicts: {'min_value': X, 'max_value': Y, 'percentage': P, 'flat_rate': F}
    calculation_type: 'flat' or 'slab'
    """
    fee = 0.0
    if calculation_type == "flat":
        # Find the matching bracket
        for rule in rules:
            if rule["min_value"] <= valuation < rule["max_value"]:
                fee = (valuation * rule["percentage"] / 100.0) + rule["flat_rate"]
                break
        else:
            # Fallback to the last rule if value exceeds all
            if rules:
                rule = rules[-1]
                fee = (valuation * rule["percentage"] / 100.0) + rule["flat_rate"]
    else:
        # Slab-based progressive calculation
        remaining = valuation
        for rule in rules:
            min_val = rule["min_value"]
            max_val = rule["max_value"]
            pct = rule["percentage"]
            flat = rule["flat_rate"]
            
            if valuation > min_val:
                taxable_in_slab = min(valuation, max_val) - min_val
                if taxable_in_slab > 0:
                    fee += (taxable_in_slab * pct / 100.0) + flat
                    
    return fee

def calculate_gst(fee_amount, state, gst_rates):
    """
    Calculates GST based on client's state.
    gst_rates: dict with 'cgst', 'sgst', 'igst' float rates
    """
    is_maharashtra = str(state).strip().lower() == "maharashtra"
    
    cgst_pct = float(gst_rates.get("gst_rate_cgst", 9.0))
    sgst_pct = float(gst_rates.get("gst_rate_sgst", 9.0))
    igst_pct = float(gst_rates.get("gst_rate_igst", 18.0))
    
    if is_maharashtra:
        cgst = fee_amount * (cgst_pct / 100.0)
        sgst = fee_amount * (sgst_pct / 100.0)
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = fee_amount * (igst_pct / 100.0)
        
    total_amount = fee_amount + cgst + sgst + igst
    return {
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "total_amount": total_amount,
        "is_maharashtra": is_maharashtra
    }

def convert_excel_to_pdf_fallback(excel_path, pdf_path):
    """
    Fallback method to generate a clean tabular report PDF from the Excel file
    using ReportLab when Microsoft Excel is not installed/configured.
    """
    try:
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        if "Holdings" in wb.sheetnames:
            sheet = wb["Holdings"]
        else:
            sheet = wb.active
            
        rows = []
        # Scan from row 4 (where headers usually start in our sample template)
        for r in range(4, sheet.max_row + 1):
            row_vals = []
            has_val = False
            for c in range(1, 7):
                val = sheet.cell(row=r, column=c).value
                if val is not None:
                    has_val = True
                row_vals.append(val)
            if has_val:
                rows.append(row_vals)
                
        wb.close()
        
        # Ensure pdf directory exists
        os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
        
        doc = SimpleDocTemplate(
            pdf_path,
            pagesize=A4,
            rightMargin=40,
            leftMargin=40,
            topMargin=45,
            bottomMargin=45
        )
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'PortfolioTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=18,
            leading=22,
            textColor=colors.HexColor('#1a365d')
        )
        
        normal_text = ParagraphStyle(
            'NormText',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#4a5568')
        )
        
        bold_text = ParagraphStyle(
            'BoldText',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#2d3748')
        )
        
        table_header_style = ParagraphStyle(
            'TableHeader',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.white
        )
        
        table_cell_style = ParagraphStyle(
            'TableCell',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#2d3748')
        )
        
        table_cell_right = ParagraphStyle(
            'TableCellRight',
            parent=table_cell_style,
            alignment=2
        )
        
        table_cell_right_bold = ParagraphStyle(
            'TableCellRightBold',
            parent=table_cell_style,
            fontName='Helvetica-Bold',
            alignment=2
        )
        
        story = []
        story.append(Paragraph("PORTFOLIO PERFORMANCE REPORT", title_style))
        client_name_info = os.path.basename(pdf_path).replace("_Portfolio.pdf", "").replace("_", " ")
        story.append(Paragraph(f"<b>Client Profile:</b> {client_name_info} | Generated via Local Engine Fallback", normal_text))
        story.append(Spacer(1, 15))
        
        table_data = []
        if rows:
            # Header
            headers = [Paragraph(f"<b>{str(h)}</b>", table_header_style) for h in rows[0]]
            table_data.append(headers)
            
            # Data rows
            for r_idx, r_val in enumerate(rows[1:], 1):
                row_items = []
                is_last_row = (r_idx == len(rows) - 1)
                
                for c_idx, val in enumerate(r_val):
                    if val is None:
                        row_items.append("")
                    else:
                        if c_idx in [2, 3, 4, 5]:
                            try:
                                f_val = float(val)
                                formatted = f"{f_val:,.2f}" if c_idx != 2 or not f_val.is_integer() else f"{int(f_val)}"
                                style = table_cell_right_bold if is_last_row else table_cell_right
                                row_items.append(Paragraph(formatted, style))
                            except ValueError:
                                style = bold_text if is_last_row else table_cell_style
                                row_items.append(Paragraph(str(val), style))
                        else:
                            style = bold_text if is_last_row else table_cell_style
                            row_items.append(Paragraph(str(val), style))
                table_data.append(row_items)
                
        # Total A4 printable width is ~515 pt
        col_widths = [75, 170, 50, 70, 70, 80]
        t = Table(table_data, colWidths=col_widths)
        
        t_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a365d')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('GRID', (0,0), (-1,-2), 0.5, colors.HexColor('#cbd5e0')),
            ('PADDING', (0,0), (-1,-1), 6),
        ]
        if len(table_data) > 1:
            t_style.append(('LINEABOVE', (0, -1), (-1, -1), 1.5, colors.HexColor('#1a365d')))
            t_style.append(('LINEBELOW', (0, -1), (-1, -1), 1.5, colors.HexColor('#1a365d')))
            
        t.setStyle(TableStyle(t_style))
        story.append(t)
        doc.build(story)
        return True
    except Exception as e:
        print(f"Fallback portfolio PDF generation failed: {e}")
        raise e

def convert_excel_to_pdf(excel_path, pdf_path):
    """
    Uses win32com to open the excel file and export to PDF.
    Must be run in main thread or call pythoncom.CoInitialize() first if inside QThread.
    Falls back to ReportLab layout generation if Excel is unavailable.
    """
    if not EXCEL_AVAILABLE:
        print("win32com not available. Running ReportLab fallback for Portfolio PDF.")
        return convert_excel_to_pdf_fallback(excel_path, pdf_path)
        
    pythoncom.CoInitialize()
    excel = None
    wb = None
    try:
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        
        abs_excel = os.path.abspath(excel_path)
        abs_pdf = os.path.abspath(pdf_path)
        
        os.makedirs(os.path.dirname(abs_pdf), exist_ok=True)
        wb = excel.Workbooks.Open(abs_excel)
        wb.ExportAsFixedFormat(0, abs_pdf)
        wb.Close(False)
        return True
    except Exception as e:
        print(f"Excel COM PDF conversion failed: {e}. Attempting ReportLab fallback.")
        try:
            return convert_excel_to_pdf_fallback(excel_path, pdf_path)
        except Exception as fallback_err:
            print(f"Both Excel COM and ReportLab fallback failed: {fallback_err}")
            raise e
    finally:
        if wb:
            try:
                wb.Close(False)
            except:
                pass
        if excel:
            try:
                excel.Quit()
            except:
                pass
        pythoncom.CoUninitialize()

def generate_invoice_pdf(pdf_path, invoice_details, company_details):
    """
    Generates a beautiful, professional, GST-compliant invoice PDF using reportlab.
    invoice_details: dict containing invoice_number, date, client_name, client_address,
                     client_gstin, valuation, fee_amount, cgst, sgst, igst, total_amount
    company_details: dict containing company_name, company_address, company_gstin,
                     company_bank_name, company_bank_account, company_bank_ifsc, company_bank_branch, etc.
    """
    os.makedirs(os.path.dirname(pdf_path), exist_ok=True)
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=45,
        bottomMargin=45
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles for Premium Look
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#1a365d') # Dark Navy Blue
    )
    
    company_name_style = ParagraphStyle(
        'CompName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#2d3748')
    )
    
    normal_text = ParagraphStyle(
        'NormText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#4a5568')
    )
    
    bold_text = ParagraphStyle(
        'BoldText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#2d3748')
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )
    
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#2d3748')
    )
    
    table_cell_right = ParagraphStyle(
        'TableCellRight',
        parent=table_cell_style,
        alignment=2 # Right align
    )

    table_cell_right_bold = ParagraphStyle(
        'TableCellRightBold',
        parent=table_cell_style,
        fontName='Helvetica-Bold',
        alignment=2 # Right align
    )

    story = []
    
    # --- HEADER SECTION ---
    # Two column header: Company details left, INVOICE title & metadata right
    company_p = Paragraph(
        f"<b>{company_details.get('company_name', 'Company Name')}</b><br/>"
        f"{company_details.get('company_address', 'Address')}<br/>"
        f"GSTIN: {company_details.get('company_gstin', 'GSTIN')}<br/>"
        f"Email: {company_details.get('company_email', '')} | Phone: {company_details.get('company_phone', '')}",
        normal_text
    )
    
    invoice_meta_p = Paragraph(
        f"<font color='#1a365d'><b>TAX INVOICE</b></font><br/><br/>"
        f"<b>Invoice No:</b> {invoice_details.get('invoice_number', '')}<br/>"
        f"<b>Date:</b> {invoice_details.get('date', '')}<br/>"
        f"<b>Place of Supply:</b> {invoice_details.get('client_state', 'Maharashtra')}",
        normal_text
    )
    
    header_table = Table([[company_p, invoice_meta_p]], colWidths=[310, 205])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    
    story.append(header_table)
    story.append(Spacer(1, 15))
    
    # Decorative line
    divider = Table([['']], colWidths=[515])
    divider.setStyle(TableStyle([
        ('LINEABOVE', (0,0), (-1,-1), 1.5, colors.HexColor('#1a365d')),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(divider)
    story.append(Spacer(1, 15))
    
    # --- BILL TO SECTION ---
    bill_to_p = Paragraph(
        f"<b>BILL TO:</b><br/>"
        f"<b>{invoice_details.get('client_name', 'Client Name')}</b><br/>"
        f"Address: {invoice_details.get('client_address', 'N/A')}<br/>"
        f"State: {invoice_details.get('client_state', 'N/A')}<br/>"
        f"GSTIN: {invoice_details.get('client_gstin', 'N/A')}",
        normal_text
    )
    
    bill_table = Table([[bill_to_p]], colWidths=[515])
    bill_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f7fafc')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 20))
    
    # --- PARTICULARS TABLE ---
    # Column Headers: Sr. No., Particulars, HSN/SAC, Taxable Value (INR)
    hsn_sac = "997152"  # SAC code for Portfolio Management Services
    
    particulars_p = Paragraph(
        f"Portfolio Management & Advisory Fees<br/>"
        f"<font size='8' color='#718096'>Calculated on Portfolio Valuation of INR {invoice_details.get('valuation', 0.0):,.2f}</font>",
        table_cell_style
    )
    
    cols = ["Sr.", "Description", "SAC", "Taxable Value (INR)"]
    row_data = [
        [Paragraph(f"<b>{c}</b>", table_header_style) for c in cols],
        [
            Paragraph("1", table_cell_style),
            particulars_p,
            Paragraph(hsn_sac, table_cell_style),
            Paragraph(f"{invoice_details.get('fee_amount', 0.0):,.2f}", table_cell_right)
        ]
    ]
    
    # Add tax rows (CGST, SGST, IGST)
    cgst = invoice_details.get("cgst", 0.0)
    sgst = invoice_details.get("sgst", 0.0)
    igst = invoice_details.get("igst", 0.0)
    
    # If CGST/SGST exist
    if cgst > 0 or sgst > 0:
        row_data.append([
            "", Paragraph("CGST @ 9%", table_cell_style), "",
            Paragraph(f"{cgst:,.2f}", table_cell_right)
        ])
        row_data.append([
            "", Paragraph("SGST @ 9%", table_cell_style), "",
            Paragraph(f"{sgst:,.2f}", table_cell_right)
        ])
    else:
        row_data.append([
            "", Paragraph("IGST @ 18%", table_cell_style), "",
            Paragraph(f"{igst:,.2f}", table_cell_right)
        ])
        
    # Total row
    row_data.append([
        "", Paragraph("<b>Total Invoice Value (INR)</b>", table_cell_style), "",
        Paragraph(f"<b>{invoice_details.get('total_amount', 0.0):,.2f}</b>", table_cell_right_bold)
    ])
    
    particulars_table = Table(row_data, colWidths=[30, 315, 60, 110])
    particulars_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1a365d')),
        ('ALIGN', (0,0), (-1,0), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-2), 0.5, colors.HexColor('#cbd5e0')),
        ('LINEBELOW', (0,-1), (-1,-1), 1.5, colors.HexColor('#1a365d')),
        ('SPAN', (1,2), (2,2)),  # CGST/IGST cells span SAC column
        ('SPAN', (1,3), (2,3)),  # SGST cells span SAC column
        ('SPAN', (1,4), (2,4)) if (cgst > 0 or sgst > 0) else ('SPAN', (1,3), (2,3)),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    
    story.append(particulars_table)
    story.append(Spacer(1, 30))
    
    # --- FOOTER SECTION (Bank Details & Signature) ---
    bank_p = Paragraph(
        f"<b>Bank Account Details for Payment:</b><br/>"
        f"Account Name: {company_details.get('company_name', '')}<br/>"
        f"Bank Name: {company_details.get('company_bank_name', '')}<br/>"
        f"Account No: {company_details.get('company_bank_account', '')}<br/>"
        f"IFSC Code: {company_details.get('company_bank_ifsc', '')}<br/>"
        f"Branch: {company_details.get('company_bank_branch', '')}",
        normal_text
    )
    
    sign_p = Paragraph(
        f"For <b>{company_details.get('company_name', 'Company Name')}</b><br/><br/><br/><br/>"
        f"Authorized Signatory",
        ParagraphStyle('Sign', parent=normal_text, alignment=2) # Right align
    )
    
    footer_table = Table([[bank_p, sign_p]], colWidths=[300, 215])
    footer_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    
    # Wrap in KeepTogether to ensure it doesn't break across pages
    story.append(KeepTogether(footer_table))
    
    # Build Document
    doc.build(story)
    return True
