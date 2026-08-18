"""Add Settings fields to users

Revision ID: 20260811_001
Revises: 20260515_001
Create Date: 2026-08-11 12:00:00.000000+00:00
"""

from __future__ import annotations
from typing import Union, Sequence
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20260811_001'
down_revision: Union[str, None] = '20260515_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    columns_users = [
        ("company_name", sa.String(255)),
        ("vat_number", sa.String(50)),
        ("address", sa.Text()),
        ("email_notifications", sa.Boolean()),
        ("ai_notifications", sa.Boolean()),
    ]

    for col_name, col_type in columns_users:
        op.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type.compile(conn.engine.dialect)};")

def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS company_name;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS vat_number;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS address;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_notifications;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS ai_notifications;")
