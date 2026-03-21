"""Add responsible gambling settings table

Revision ID: 005_responsible_gambling
Revises: 004_add_new_game_types
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '005_responsible_gambling'
down_revision = '004_add_new_game_types'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'responsible_gambling_settings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('daily_deposit_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('weekly_deposit_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('monthly_deposit_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('daily_loss_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('weekly_loss_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('monthly_loss_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('daily_wager_limit', sa.Numeric(20, 8), nullable=True),
        sa.Column('session_time_limit', sa.Numeric(10, 0), nullable=True),
        sa.Column('reality_check_interval', sa.Numeric(10, 0), nullable=True),
        sa.Column('self_excluded', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('self_exclusion_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cool_off_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('responsible_gambling_settings')
