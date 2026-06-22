import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def patch_database():
    url = os.getenv("SUPABASE_DATABASE_URL")
    if not url:
        print("❌ Error: SUPABASE_DATABASE_URL not found in .env")
        return

    fixed_url = url.split("?")[0].replace("postgresql+asyncpg://", "postgresql://")
    if "ssl=require" in url or "sslmode=require" in url:
        if "?" not in fixed_url:
            fixed_url += "?sslmode=require"
        elif "sslmode" not in fixed_url:
            fixed_url += "&sslmode=require"

    print(f"Connecting to database to add missing columns...")
    
    try:
        conn = psycopg2.connect(fixed_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        # 1. Update Invoices table
        print("Updating 'invoices' table...")
        columns_to_add_invoices = [
            ("issue_date", "DATE"),
            ("items", "JSONB"),
            ("tax_amount", "FLOAT DEFAULT 0.0"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0")
        ]
        
        for col_name, col_type in columns_to_add_invoices:
            try:
                cur.execute(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_type};")
                print(f"✅ Added {col_name} to invoices.")
            except psycopg2.errors.DuplicateColumn:
                print(f"ℹ️ {col_name} already exists in invoices.")
            except Exception as e:
                print(f"❌ Error adding {col_name} to invoices: {e}")

        # 2. Update Quotations table
        print("\nUpdating 'quotations' table...")
        columns_to_add_quotations = [
            ("issue_date", "DATE"),
            ("expiry_date", "DATE"),
            ("total_amount", "FLOAT DEFAULT 0.0"),
            ("tax_amount", "FLOAT DEFAULT 0.0"),
            ("subtotal_amount", "FLOAT DEFAULT 0.0"),
            ("currency", "VARCHAR(10) DEFAULT 'GBP'"),
            ("items", "JSONB"),
            ("notes", "TEXT"),
            ("terms", "TEXT")
        ]
        
        # Ensure quotations table exists (Alembic might have created it but without columns)
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quotations');")
        if not cur.fetchone()[0]:
            print("⚠️ Table 'quotations' does not exist. Creating it...")
            cur.execute("""
                CREATE TABLE quotations (
                    id VARCHAR(50) PRIMARY KEY,
                    user_id VARCHAR(50) REFERENCES users(id),
                    client_id VARCHAR(50) REFERENCES clients(id),
                    quotation_number VARCHAR(50),
                    status VARCHAR(20) DEFAULT 'DRAFT',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            print("✅ Created 'quotations' table.")

        for col_name, col_type in columns_to_add_quotations:
            try:
                cur.execute(f"ALTER TABLE quotations ADD COLUMN {col_name} {col_type};")
                print(f"✅ Added {col_name} to quotations.")
            except psycopg2.errors.DuplicateColumn:
                print(f"ℹ️ {col_name} already exists in quotations.")
            except Exception as e:
                print(f"❌ Error adding {col_name} to quotations: {e}")

        print("\n🚀 Database patch complete!")
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Failed to connect: {e}")

if __name__ == "__main__":
    patch_database()
