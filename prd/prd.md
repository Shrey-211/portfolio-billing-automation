# **Product Requirements Document (PRD)**

## **Product Name**

Portfolio Billing Automation Desktop

Version: 1.0

---

# **1\. Overview**

Portfolio Billing Automation Desktop is a locally installed desktop application that automates the generation of portfolio reports, fee calculations, GST-compliant invoices, PDF generation, and client-ready email packages.

The application is designed for financial advisors, wealth managers, portfolio managers, and accounting teams who currently process portfolio Excel files manually.

The entire workflow runs on the user's local machine. No cloud infrastructure is required.

---

# **2\. Problem Statement**

Current workflow requires:

* Opening portfolio Excel files manually  
* Removing formulas  
* Generating reports  
* Exporting reports to PDF  
* Calculating fees manually  
* Generating GST invoices manually  
* Combining documents  
* Sending reports to clients

This process is repetitive, time-consuming, and error-prone.

The system should automate the complete workflow.

---

# **3\. Goals**

Primary Goals:

* Import multiple portfolio Excel files  
* Process all files in batch  
* Generate portfolio PDFs  
* Calculate fees automatically  
* Generate GST-compliant invoices  
* Save all generated documents locally  
* Allow users to preview PDFs  
* Allow users to email documents directly

Success Criteria:

* Process 100+ portfolios in a single batch  
* Generate all reports without manual intervention  
* Reduce processing time by 90%  
* Eliminate manual invoice creation

---

# **4\. User Persona**

Primary User:

* Wealth Manager  
* Financial Advisor  
* Relationship Manager  
* Back Office Operations Executive  
* Chartered Accountant

Technical Skill Level:

* Basic computer knowledge  
* No programming knowledge required

---

# **5\. Platform**

Desktop Application

Supported OS:

* Windows 10  
* Windows 11

Future Support:

* macOS

---

# **6\. High Level Workflow**

User launches application

↓

Select Portfolio Folder

↓

Application scans for Excel files

↓

User imports files into Workbench

↓

User reviews imported files

↓

User clicks Proceed

↓

Application processes each portfolio

↓

Generate Portfolio PDF

↓

Calculate Fees

↓

Apply GST

↓

Generate Invoice PDF

↓

Save documents locally

↓

Display generated documents

↓

User previews PDFs

↓

User emails reports to clients

---

# **7\. Functional Requirements**

## **FR-1 Folder Selection**

User can select a folder from local machine.

System scans folder for:

* .xlsx  
* .xlsm

System displays:

* Total files found  
* File names  
* Import status

---

## **FR-2 Workbench**

Workbench acts as processing queue.

Display:

* Client Name  
* Source File  
* Status

Statuses:

* Pending  
* Processing  
* Completed  
* Failed

User actions:

* Remove file  
* Re-import folder  
* Proceed

---

## **FR-3 Excel Processing**

For every imported Excel file:

System should:

* Open workbook  
* Evaluate formulas  
* Convert formulas to values  
* Preserve formatting  
* Preserve report layout

Output:

Processed workbook

---

## **FR-4 Portfolio PDF Generation**

Generate PDF from processed workbook.

Requirements:

* Preserve layout  
* Preserve branding  
* Preserve tables  
* Preserve page breaks

Output:

ClientName\_Portfolio.pdf

---

## **FR-5 Client Classification**

Each portfolio belongs to one of:

### **Type 1**

Regular Client

### **Type 2**

RI Client – Equity

### **Type 3**

RI Client – Mutual Fund

Classification source:

* Configurable mapping  
* Metadata sheet  
* Client master file

System must support future client types.

---

## **FR-6 Fee Calculation Engine**

Fee calculation based on portfolio values extracted from workbook.

Input:

Portfolio valuation

Output:

Calculated fee amount

Rules should be configurable.

Example:

Portfolio Value \< 1 Cr

Fee \= X%

Portfolio Value \> 1 Cr

Fee \= Y%

No hardcoded rules.

---

## **FR-7 GST Engine**

GST depends on client state.

### **Maharashtra Clients**

Apply:

* CGST  
* SGST

### **Non-Maharashtra Clients**

Apply:

* IGST

Rule:

If State \== Maharashtra

GST Type \= CGST \+ SGST

Else

GST Type \= IGST

Rates configurable.

---

## **FR-8 Invoice Generation**

Generate GST-compliant invoice.

Invoice contains:

* Invoice Number  
* Date  
* Client Name  
* Client Address  
* Client GST Details  
* Portfolio Value  
* Fee Amount  
* GST Amount  
* Total Amount

Output:

ClientName\_Invoice.pdf

---

## **FR-9 Document Packaging**

Generated documents:

Portfolio Report PDF

Invoice PDF

Stored under:

/pdf

folder inside selected directory.

Example:

Portfolio Folder

ClientA.xlsx

ClientB.xlsx

pdf/

ClientA\_Portfolio.pdf

ClientA\_Invoice.pdf

ClientB\_Portfolio.pdf

ClientB\_Invoice.pdf

---

## **FR-10 Results Dashboard**

After processing:

Display all generated documents.

Columns:

* Client  
* Portfolio PDF  
* Invoice PDF  
* Status

Actions:

* Open Portfolio  
* Open Invoice  
* Open Folder

---

## **FR-11 PDF Preview**

User can preview PDFs inside application.

Requirements:

* Zoom  
* Scroll  
* Open in external viewer

---

## **FR-12 Email Module**

User can email documents directly.

Fields:

* To  
* CC  
* Subject  
* Body

Attachments:

* Portfolio PDF  
* Invoice PDF

Actions:

* Send Individual Email  
* Send Bulk Emails

Email delivery through:

* SMTP  
* Outlook Integration

---

## **FR-13 Configuration Management**

Admin-configurable settings:

Fee Rules

GST Rates

Company Details

Invoice Template

Email Template

PDF Naming Convention

Storage Location

---

# **8\. Non Functional Requirements**

## **Performance**

100 portfolios should process within 5 minutes.

---

## **Reliability**

Application must continue processing remaining files if one file fails.

---

## **Security**

No data leaves local machine.

No cloud dependency.

All client data remains local.

---

## **Logging**

Maintain logs for:

* Imported files  
* Processing status  
* Fee calculations  
* Invoice generation  
* Email delivery

---

# **9\. User Interface**

## **Screen 1**

Home

Components:

* Select Folder  
* Import Files  
* Recent Projects

---

## **Screen 2**

Workbench

Components:

* File Grid  
* Status Indicators  
* Proceed Button

---

## **Screen 3**

Processing

Components:

* Progress Bar  
* Current File  
* Logs

---

## **Screen 4**

Results

Components:

* Portfolio PDF  
* Invoice PDF  
* Open Buttons  
* Email Buttons

---

## **Screen 5**

Settings

Components:

* Fee Rules  
* GST Rules  
* Invoice Settings  
* Email Settings

---

# **10\. Technical Architecture**

Frontend

* PySide6 (Qt)

Backend

* Python

Libraries

* pandas  
* openpyxl  
* reportlab  
* pypdf  
* yagmail / SMTP  
* sqlite

Local Database

SQLite

Purpose:

* Configuration  
* Processing History  
* Email Logs

---

# **11\. Future Enhancements**

Phase 2

* Digital Signature Support  
* Client Master Database  
* CRM Integration  
* Excel Template Builder  
* Bulk Portfolio Validation  
* Auto Email Scheduling

Phase 3

* Multi-user Version  
* Network Deployment  
* Audit Trail  
* Role Based Access  
* Cloud Sync

---

# **12\. Definition of Done**

System is considered complete when:

* User can import Excel files  
* Reports are generated automatically  
* Fees are calculated correctly  
* GST is applied correctly  
* Invoices are generated automatically  
* PDFs are saved locally  
* PDFs can be previewed  
* Emails can be sent from application  
* Errors are logged properly  
* Processing is fully automated

