"""master_migration_ultimate

Revision ID: 27b214794abd
Revises: 20260511_001
Create Date: 2026-05-12 15:23:24.066425+00:00
"""

from __future__ import annotations
from typing import Union, Sequence
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '27b214794abd'
down_revision: Union[str, None] = '20260511_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Safely create ENUM types
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN CREATE TYPE userrole AS ENUM ('SUPERADMIN', 'ADMIN', 'ACCOUNTANT', 'VIEWER'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoicestatus') THEN CREATE TYPE invoicestatus AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotationstatus') THEN CREATE TYPE quotationstatus AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentprovider') THEN CREATE TYPE paymentprovider AS ENUM ('STRIPE', 'PAYPAL', 'BANK_TRANS'); END IF; END $$;")
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactionstatus') THEN CREATE TYPE transactionstatus AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'); END IF; END $$;")

    # 2. Create Core Tables (Raw SQL IF NOT EXISTS)
    op.execute("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, hashed_password VARCHAR(255) NOT NULL, full_name VARCHAR(255), avatar VARCHAR, is_active BOOLEAN DEFAULT TRUE, role userrole, created_at TIMESTAMP, updated_at TIMESTAMP)")
    op.execute("CREATE TABLE IF NOT EXISTS clients (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), name VARCHAR(255) NOT NULL, email VARCHAR(255), phone VARCHAR(50), address VARCHAR(1000), company_name VARCHAR(255), vat_number VARCHAR(50), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP, updated_at TIMESTAMP)")
    op.execute("CREATE TABLE IF NOT EXISTS invoices (id UUID PRIMARY KEY, user_id UUID REFERENCES users(id), client_id UUID REFERENCES clients(id), invoice_number VARCHAR(50) NOT NULL, status invoicestatus, total_amount FLOAT DEFAULT 0, tax_amount FLOAT DEFAULT 0, subtotal_amount FLOAT DEFAULT 0, currency VARCHAR(10) DEFAULT 'GBP', due_date DATE, stripe_payment_link VARCHAR(255), paypal_payment_link VARCHAR(255), notes TEXT, terms TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)")

    # 3. Create New Payment Tables (Raw SQL IF NOT EXISTS)
    op.execute("""
        CREATE TABLE IF NOT EXISTS payment_settings (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL UNIQUE REFERENCES users(id),
            stripe_public_key VARCHAR(255),
            stripe_secret_key TEXT,
            stripe_webhook_secret TEXT,
            stripe_enabled BOOLEAN DEFAULT FALSE,
            paypal_client_id VARCHAR(255),
            paypal_client_secret TEXT,
            paypal_webhook_id VARCHAR(255),
            paypal_enabled BOOLEAN DEFAULT FALSE,
            bank_name VARCHAR(255),
            account_name VARCHAR(255),
            account_number VARCHAR(50),
            sort_code VARCHAR(20),
            iban VARCHAR(50),
            swift_bic VARCHAR(50),
            bank_transfer_enabled BOOLEAN DEFAULT FALSE,
            company_logo_url VARCHAR(255),
            company_vat_number VARCHAR(50),
            company_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS webhook_logs (
            id UUID PRIMARY KEY,
            provider paymentprovider NOT NULL,
            payload JSON NOT NULL,
            status_code VARCHAR(10),
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id),
            invoice_id UUID NOT NULL REFERENCES invoices(id),
            provider paymentprovider NOT NULL,
            provider_transaction_id VARCHAR(255),
            amount FLOAT NOT NULL,
            currency VARCHAR(10) DEFAULT 'GBP',
            status transactionstatus DEFAULT 'PENDING',
            metadata_json JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

def downgrade() -> None:
    pass
