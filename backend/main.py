import os
import sys
import time
import socket
import threading
import uvicorn
import webview

import backend.database as database
from backend.server import app

def find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def main():
    # 1. Initialize SQLite Database
    try:
        database.init_db()
        print("SQLite Database initialized successfully.")
    except Exception as e:
        print(f"Error initializing SQLite Database: {e}")
        sys.exit(1)

    # 2. Check for dev mode
    dev_mode = "--dev" in sys.argv
    
    if dev_mode:
        url = "http://localhost:5173"
        print("Running in DEV mode, pointing WebView to Vite dev server:", url)
        # Start server anyway in case frontend needs to call APIs during dev
        port = 8000  # Default API port for development
        t = threading.Thread(
            target=uvicorn.run,
            kwargs={"app": app, "host": "127.0.0.1", "port": port, "log_level": "info"},
            daemon=True
        )
        t.start()
    else:
        # Production mode: run FastAPI on a dynamic free port
        port = find_free_port()
        print(f"Starting FastAPI production server on 127.0.0.1:{port}...")
        t = threading.Thread(
            target=uvicorn.run,
            kwargs={"app": app, "host": "127.0.0.1", "port": port, "log_level": "warning"},
            daemon=True
        )
        t.start()
        # Give uvicorn a second to spin up
        time.sleep(1.0)
        url = f"http://127.0.0.1:{port}"

    # 3. Launch PyWebView
    # Design settings for PyWebView window: 1200x800, dark-themed chrome (where supported)
    print("Launching PyWebView frame window...")
    window = webview.create_window(
        title="Portfolio Invoicing & Reporting Automation",
        url=url,
        width=1200,
        height=800,
        min_size=(1000, 700),
        resizable=True
    )
    
    # Start webview loop (blocks until window is closed)
    webview.start()

if __name__ == "__main__":
    main()
