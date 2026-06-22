import psycopg2
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def fix_database():
    url = os.getenv("SUPABASE_DATABASE_URL")
    if not url:
        print("❌ Error: SUPABASE_DATABASE_URL not found in .env")
        return

    # Convert asyncpg URL to standard postgres URL for psycopg2
    # Also handle the ssl requirement
    fixed_url = url.split("?")[0].replace("postgresql+asyncpg://", "postgresql://")
    if "ssl=require" in url or "sslmode=require" in url:
        if "?" not in fixed_url:
            fixed_url += "?sslmode=require"
        elif "sslmode" not in fixed_url:
            fixed_url += "&sslmode=require"

    print(f"Connecting to Supabase at: {fixed_url.split('@')[1] if '@' in fixed_url else fixed_url}")
    
    try:
        conn = psycopg2.connect(fixed_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Connected! Fixing schema...")
        
        # 1. Convert UUID columns to VARCHAR(50) to match SQLAlchemy models
        tables_to_fix = [
            ("users", ["id"]),
            ("clients", ["id", "user_id"]),
            ("invoices", ["id", "user_id", "client_id"]),
            ("payment_settings", ["id", "user_id"]),
            ("payment_transactions", ["id", "user_id", "invoice_id"]),
            ("webhook_logs", ["id"])
        ]
        
        for table, columns in tables_to_fix:
            # Check if table exists
            cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');")
            if not cur.fetchone()[0]:
                print(f"⚠️ Table '{table}' does not exist, skipping.")
                continue
                
            for col in columns:
                try:
                    # Check column type
                    cur.execute(f"""
                        SELECT data_type 
                        FROM information_schema.columns 
                        WHERE table_name = '{table}' AND column_name = '{col}';
                    """)
                    res = cur.fetchone()
                    if res and res[0] == 'uuid':
                        print(f"Altering {table}.{col} from UUID to VARCHAR(50)...")
                        # We need to cast to text first
                        cur.execute(f"ALTER TABLE {table} ALTER COLUMN {col} TYPE VARCHAR(50) USING {col}::text;")
                        print(f"✅ {table}.{col} updated.")
                    else:
                        print(f"ℹ️ {table}.{col} is already {res[0] if res else 'unknown'}, skipping.")
                except Exception as e:
                    print(f"❌ Failed to alter {table}.{col}: {e}")
                    conn.rollback()
                    conn.autocommit = True

        print("\n✅ Database schema fixed and aligned with models!")
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Failed to connect to Supabase: {e}")
        if "timeout" in str(e).lower():
            print("\n💡 TIP: If you see a timeout, it might be an IPv6 issue.")
            print("Try using the 'Transaction Pooler' connection string from Supabase (Port 6543).")

if __name__ == "__main__":
    fix_database()
