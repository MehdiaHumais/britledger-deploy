#!/usr/bin/env python3
# BritLedger AI - Create Notifications Table Script
# This script ensures the notifications table exists in the SQLite database

import sqlite3
import os
import sys
from pathlib import Path

# Set UTF-8 encoding for stdout to support emojis
sys.stdout.reconfigure(encoding='utf-8')

# Database path
DB_PATH = Path(__file__).parent / "britledger_dev.db"

def create_notification_table():
    """Create the notifications table if it doesn't exist."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Create notifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('info', 'warning', 'error', 'success')),
                read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Create index for faster querying by user_id and read status
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
            ON notifications (user_id, read)
        """)

        conn.commit()
        print("✅ Notifications table created successfully!")
        
    except Exception as e:
        print("❌ Error creating notifications table:", str(e))
        raise
    finally:
        if 'conn' in locals():
            conn.close()

def main():
    """Main entry point."""
    print("🔍 Connecting to database...")
    
    try:
        create_notification_table()
        print("🎉 Notifications table setup completed successfully.")
    except Exception as e:
        print("💥 Critical failure during notification table creation:", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()