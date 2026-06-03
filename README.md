# Portfolio Billing Automation Desktop

A modern, local desktop application built with a React frontend (Vite + Tailwind CSS), a Python FastAPI backend, and packaged within a native desktop window container via PyWebView. It automates portfolio report scanning, fee calculations, GST-compliant invoice generation, and email distribution.

---

## Technical Stack
* **Frontend**: React (Vite, Tailwind CSS, Lucide React Icons)
* **API Server**: FastAPI, Uvicorn
* **Native Frame**: PyWebView (native webview wrapper)
* **Local Database**: SQLite (for billing history and client metadata registries)
* **Excel cleansing**: openpyxl
* **PDF Generators**: win32com (Excel COM automation) with a styled **ReportLab** tabular PDF fallback if Excel is not installed.
* **Mail Dispatcher**: SMTP Mail Server or Microsoft Outlook client via COM automation.

---

## Development Setup

To run the application in development mode (with Hot Module Replacement for frontend code):

### 1. Prerequisites
Ensure Python 3.12+ and Node.js are installed on your machine.

### 2. Setup Backend Environment
Create a virtual environment and install backend requirements:
```powershell
# Create venv
python -m venv .venv

# Activate (Windows PowerShell)
.venv/Scripts/Activate.ps1

# Install requirements
pip install -r requirements.txt
```

### 3. Setup Frontend Environment
Install Node packages in the `frontend` folder:
```bash
cd frontend
npm install
```

### 4. Run in Development Mode
To develop, launch both the Vite server and the Python app with the `--dev` flag:

* **Terminal 1 (Vite Dev Server)**:
  ```bash
  cd frontend
  npm run dev
  ```
* **Terminal 2 (Python Dev Client)**:
  ```powershell
  # Activate venv first
  .venv/Scripts/Activate.ps1
  
  # Run app with --dev flag (points webview to localhost:5173 and APIs to port 8000)
  python main.py --dev
  ```

---

## Production Packaging & Distribution

Before delivering to clients, compile the frontend static files and bundle everything into a single standalone `.exe` using PyInstaller.

### 1. Compile the React Frontend
Run Vite compilation in the `frontend` folder to output static assets inside `frontend/dist/`:
```bash
cd frontend
npm run build
cd ..
```

### 2. Package with PyInstaller
Run the build command using the provided Spec file (which bundles the `frontend/dist/` files inside the executable and excludes heavy unused Qt libraries):
```powershell
# Build executable
.venv/Scripts/pyinstaller PortfolioInvoicing.spec --noconfirm
```
* The standalone executable `PortfolioInvoicing.exe` will be generated inside the `dist/` folder.
* Double-clicking `PortfolioInvoicing.exe` runs the complete app (FastAPI server + PyWebView GUI) without needing Python or Node.js on the client machine.

---

## cross-Platform & Fallback Behaviors

If the application is compiled or run on non-Windows environments (like **macOS**):
1. **win32com Fallback**: Since Excel COM automation is Windows-only, the engine automatically catches import errors and runs a **ReportLab holdings table parser** to render styled portfolio PDFs directly.
2. **Outlook COM Fallback**: If Outlook is unavailable, the application falls back to sending reports directly through the direct **SMTP mail server** configured in settings.
3. **App Packaging**: PyInstaller can compile a native `.app` bundle on macOS using `pyinstaller PortfolioInvoicing.spec --noconfirm`.
