import os
import sys

def clear_databases():
    # 1. Main Application Database
    db_main = os.path.join(os.path.expanduser('~'), '.portfolio_billing', 'app_database.db')
    
    # 2. Test/Pipeline Database
    db_test = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'test_data', 'test_app.db')
    
    deleted_any = False
    for path in (db_main, db_test):
        if os.path.exists(path):
            try:
                os.remove(path)
                print(f"Successfully deleted: {path}")
                deleted_any = True
            except Exception as e:
                print(f"Error deleting {path}: {e}")
                print("⚠️ Make sure the application is closed or the python server is stopped before running this script.")
        else:
            print(f"Already clean / Not found: {path}")
            
    if deleted_any:
        print("\n✨ Database reset complete. Restart the application server to initialize a fresh database.")
    else:
        print("\nAll database files are already cleared.")

if __name__ == "__main__":
    clear_databases()
