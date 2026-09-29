"""Persist stable Google subject identifiers; legacy records remain unassigned."""
from alembic import op
import sqlalchemy as sa
revision = '003_google_subject'
down_revision = '002_google_user_sessions'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('google_user_sessions', sa.Column('google_subject', sa.String(255), nullable=True))
    op.create_index('ix_google_user_sessions_subject', 'google_user_sessions', ['google_subject'], unique=True)

def downgrade():
    op.drop_index('ix_google_user_sessions_subject', table_name='google_user_sessions')
    op.drop_column('google_user_sessions', 'google_subject')
