import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def list_clients():
    url = os.getenv("SUPABASE_DATABASE_URL")
    if not url:
        return

    fixed_url = url.split("?")[0].replace("postgresql+asyncpg://", "postgresql://")
    if "sslmode" not in fixed_url:
        fixed_url += "?sslmode=require"

    try:
        conn = psycopg2.connect(fixed_url)
        cur = conn.cursor()
        
        cur.execute("SELECT id, name, email FROM clients;")
        rows = cur.fetchall()
        
        print(f"--- Backend Clients ({len(rows)}) ---")
        for row in rows:
            print(f"ID: {row[0]} | Name: {row[1]} | Email: {row[2]}")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    list_clients()
