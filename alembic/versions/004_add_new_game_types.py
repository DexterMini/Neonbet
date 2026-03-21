"""Add new game types to gametype enum

Revision ID: 004_add_new_game_types
Revises: 003_add_game_settings
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '004_add_new_game_types'
down_revision: Union[str, None] = '003_add_game_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new enum values to gametype
    # Must run outside transaction for PostgreSQL
    op.execute(text("COMMIT"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'keno'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'flip'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'hilo'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'stairs'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'chicken'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'coinclimber'"))
    op.execute(text("ALTER TYPE gametype ADD VALUE IF NOT EXISTS 'snake'"))
    op.execute(text("BEGIN"))

    # Insert default game settings for new game types
    op.execute("""
        INSERT INTO game_settings (id, game_type, house_edge, description, created_at, updated_at) VALUES
        (gen_random_uuid(), 'keno', 0.04, 'Keno Number Draw', now(), now()),
        (gen_random_uuid(), 'flip', 0.03, 'Coin Flip', now(), now()),
        (gen_random_uuid(), 'hilo', 0.04, 'Hi-Lo Card Game', now(), now()),
        (gen_random_uuid(), 'stairs', 0.04, 'Stairs Climbing Game', now(), now()),
        (gen_random_uuid(), 'chicken', 0.04, 'Chicken Road', now(), now()),
        (gen_random_uuid(), 'coinclimber', 0.04, 'Coin Climber', now(), now()),
        (gen_random_uuid(), 'snake', 0.04, 'Snake Game', now(), now())
        ON CONFLICT (game_type) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM game_settings WHERE game_type IN ('keno', 'flip', 'hilo', 'stairs', 'chicken', 'coinclimber', 'snake')")
    # Note: PostgreSQL does not support removing enum values
