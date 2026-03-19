"""Add game_settings table for RTP configuration

Revision ID: 003_add_game_settings
Revises: 002_add_is_admin
Create Date: 2026-03-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003_add_game_settings'
down_revision: Union[str, None] = '002_add_is_admin'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'game_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('game_type', sa.Enum('dice', 'crash', 'plinko', 'mines', 'limbo', 'wheel', 'blackjack', 'roulette', 'slots', name='gametype'), nullable=False),
        sa.Column('house_edge', sa.Numeric(precision=5, scale=4), nullable=False, server_default=sa.text("'0.0500'")),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('game_type', name='uq_game_settings_type'),
    )
    op.create_index('idx_game_settings_type', 'game_settings', ['game_type'])

    # Insert default game settings
    op.execute("""
        INSERT INTO game_settings (id, game_type, house_edge, description, created_at, updated_at) VALUES
        (gen_random_uuid(), 'dice', 0.03, 'Classic Dice Game', now(), now()),
        (gen_random_uuid(), 'crash', 0.01, 'Crash Game', now(), now()),
        (gen_random_uuid(), 'plinko', 0.04, 'Plinko Ball Drop', now(), now()),
        (gen_random_uuid(), 'mines', 0.05, 'Mines Game', now(), now()),
        (gen_random_uuid(), 'limbo', 0.05, 'Limbo Game', now(), now()),
        (gen_random_uuid(), 'wheel', 0.06, 'Wheel of Fortune', now(), now()),
        (gen_random_uuid(), 'blackjack', 0.04, 'Blackjack', now(), now()),
        (gen_random_uuid(), 'roulette', 0.027, 'European Roulette', now(), now()),
        (gen_random_uuid(), 'slots', 0.05, 'Slot Machine', now(), now())
    """)


def downgrade() -> None:
    op.drop_table('game_settings')
