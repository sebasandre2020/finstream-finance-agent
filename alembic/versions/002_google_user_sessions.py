"""Add google_user_sessions table for OAuth persistence and 7-day session state.

Revision ID: 002_google_user_sessions
Revises: 001_initial_schema
Create Date: 2026-09-26 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_google_user_sessions"
down_revision: str | None = "001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "google_user_sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("uuid_generate_v4()"),
        ),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("picture", sa.String(length=500), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("session_token", sa.String(length=255), nullable=False),
        sa.Column("session_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_google_user_sessions_email",
        "google_user_sessions",
        ["email"],
        unique=True,
    )
    op.create_index(
        "ix_google_user_sessions_session_token",
        "google_user_sessions",
        ["session_token"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_google_user_sessions_session_token",
        table_name="google_user_sessions",
    )
    op.drop_index(
        "ix_google_user_sessions_email",
        table_name="google_user_sessions",
    )
    op.drop_table("google_user_sessions")
