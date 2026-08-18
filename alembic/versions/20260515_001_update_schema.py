"""Update Invoices and Quotations Schema

Revision ID: 20260515_001
Revises: 27b214794abd
Create Date: 2026-05-15 14:25:00.000000+00:00
"""

from __future__ import annotations
from typing import Union, Sequence
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260515_001'
down_revision: Union[str, None] = '27b214794abd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Ensure quotations table exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS quotations (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(50),
            client_id VARCHAR(50),
            quotation_number VARCHAR(50),
            status VARCHAR(20) DEFAULT 'DRAFT',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # 2. Add columns to invoices
    columns_invoices = [
        ("issue_date", sa.Date()),
        ("items", sa.JSON()),
    ]
    
    # We use a safer way to add columns if they don't exist
    conn = op.get_bind()
    
    # Check and add columns to invoices
    for col_name, col_type in columns_invoices:
        op.execute(f"ALTER TABLE invoices ADD COLUMN IF NOT EXISTS {col_name} {col_type.compile(conn.engine.dialect)};")

    # 3. Add columns to quotations
    columns_quotations = [
        ("issue_date", sa.Date()),
        ("expiry_date", sa.Date()),
        ("total_amount", sa.Float()),
        ("tax_amount", sa.Float()),
        ("subtotal_amount", sa.Float()),
        ("currency", sa.String(10)),
        ("items", sa.JSON()),
        ("notes", sa.Text()),
        ("terms", sa.Text())
    ]
    
    for col_name, col_type in columns_quotations:
        op.execute(f"ALTER TABLE quotations ADD COLUMN IF NOT EXISTS {col_name} {col_type.compile(conn.engine.dialect)};")

    # 4. Fix types for foreign keys if they are still UUID in the DB but our models expect String
    # This is handled by fix_db.py but we can add it here for safety
    tables_to_fix = [
        ("users", ["id"]),
        ("clients", ["id", "user_id"]),
        ("invoices", ["id", "user_id", "client_id"]),
        ("quotations", ["id", "user_id", "client_id"]),
        ("payment_settings", ["id", "user_id"]),
        ("payment_transactions", ["id", "user_id", "invoice_id"])
    ]
    
    for table, columns in tables_to_fix:
        for col in columns:
            op.execute(f"""
                DO $$ 
                BEGIN 
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = '{table}' AND column_name = '{col}' AND data_type = 'uuid'
                    ) THEN
                        ALTER TABLE {table} ALTER COLUMN {col} TYPE VARCHAR(50) USING {col}::text;
                    END IF;
                END $$;
            """)

def downgrade() -> None:
    pass
