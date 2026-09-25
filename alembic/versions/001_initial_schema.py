"""Initial schema with pgvector, accounts, transactions, and merchant cache.

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-09-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable required PostgreSQL extensions
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute('CREATE EXTENSION IF NOT EXISTS "vector";')

    # 2. Create accounts table
    op.create_table(
        'accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('institution_name', sa.String(length=100), nullable=False),
        sa.Column('account_number_mask', sa.String(length=10), nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('idx_accounts_user_id', 'accounts', ['user_id'])

    # 3. Create merchant_entities table
    op.create_table(
        'merchant_entities',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('normalized_name', sa.String(length=255), nullable=False),
        sa.Column('default_category', sa.String(length=100), nullable=False),
        sa.Column('default_subcategory', sa.String(length=100), nullable=True),
        sa.Column('embedding', Vector(1536), nullable=False),
        sa.Column('occurrence_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('normalized_name', name='uq_merchant_normalized_name')
    )
    op.create_index('idx_merchant_normalized_name', 'merchant_entities', ['normalized_name'])

    # 4. Create HNSW Cosine Index on merchant embeddings for sub-millisecond semantic search
    op.execute("""
        CREATE INDEX idx_merchant_embedding_hnsw 
        ON merchant_entities 
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
    """)

    # 5. Create transactions table
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ext_transaction_id', sa.String(length=255), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('raw_description', sa.Text(), nullable=False),
        sa.Column('normalized_merchant', sa.String(length=255), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('sub_category', sa.String(length=100), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=False),
        sa.Column('is_anomaly', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('anomaly_reason', sa.Text(), nullable=True),
        sa.Column('transaction_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('account_id', 'ext_transaction_id', name='uq_account_ext_tx')
    )
    op.create_index('idx_transactions_account_time', 'transactions', ['account_id', sa.text('transaction_time DESC')])
    op.create_index('idx_transactions_category', 'transactions', ['category'])
    op.create_index('idx_transactions_anomaly', 'transactions', ['is_anomaly'])


def downgrade() -> None:
    op.drop_table('transactions')
    op.execute('DROP INDEX IF EXISTS idx_merchant_embedding_hnsw;')
    op.drop_table('merchant_entities')
    op.drop_table('accounts')
