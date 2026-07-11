"""Run FK cascade migration against Supabase DB (via psycopg2 — no prepared stmts)."""
import os
os.environ["APP_ENV"] = "development"

import psycopg2
from app.core.config import settings

SQL = """
-- expenses (missing from original migration)
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- vat_records (missing from original migration)
ALTER TABLE vat_records DROP CONSTRAINT IF EXISTS vat_records_user_id_fkey;
ALTER TABLE vat_records ADD CONSTRAINT vat_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- clients
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;
ALTER TABLE clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- invoices
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- quotations
ALTER TABLE quotations DROP CONSTRAINT IF EXISTS quotations_user_id_fkey;
ALTER TABLE quotations ADD CONSTRAINT quotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- payment_settings
ALTER TABLE payment_settings DROP CONSTRAINT IF EXISTS payment_settings_user_id_fkey;
ALTER TABLE payment_settings ADD CONSTRAINT payment_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- payment_transactions
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_user_id_fkey;
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- invoices (client_id FK cascade too)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
"""

def run():
    dsn = settings.sync_database_url
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        for stmt in SQL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                try:
                    cur.execute(stmt + ";")
                    print(f"  OK: {stmt[:80]}...")
                except Exception as e:
                    print(f"  SKIP ({e}): {stmt[:80]}...")
        print("\nMigration complete.")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    run()
