"""Initial casino schema

Revision ID: 001_initial
Revises: 
Create Date: 2025-01-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum types matching casino.models.database
user_status_enum = sa.Enum(
    'active', 'suspended', 'frozen', 'banned', 'pending_verification',
    name='userstatus', create_type=False,
)
kyc_level_enum = sa.Enum('none', 'tier_1', 'tier_2', 'tier_3', name='kyclevel', create_type=False)
currency_enum = sa.Enum('btc', 'eth', 'usdt', 'usdc', 'sol', 'ltc', name='currency', create_type=False)
ledger_event_type_enum = sa.Enum(
    'deposit', 'withdrawal', 'withdrawal_pending', 'withdrawal_cancelled',
    'bet_placed', 'bet_won', 'bet_lost', 'bet_refunded', 'bet_voided',
    'bonus_credit', 'bonus_wagered', 'bonus_forfeited',
    'rakeback_credit', 'lossback_credit',
    'admin_adjustment', 'system_correction',
    'balance_frozen', 'balance_unfrozen',
    name='ledgereventtype', create_type=False,
)
game_type_enum = sa.Enum(
    'dice', 'crash', 'plinko', 'mines', 'limbo', 'wheel',
    'blackjack', 'roulette', 'slots',
    name='gametype', create_type=False,
)
bet_status_enum = sa.Enum(
    'pending', 'active', 'won', 'lost', 'refunded', 'voided',
    name='betstatus', create_type=False,
)


def upgrade() -> None:
    # ---- Enum types (use raw SQL for IF NOT EXISTS support) ----
    op.execute("DO $$ BEGIN CREATE TYPE userstatus AS ENUM ('active', 'suspended', 'frozen', 'banned', 'pending_verification'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE kyclevel AS ENUM ('none', 'tier_1', 'tier_2', 'tier_3'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE currency AS ENUM ('btc', 'eth', 'usdt', 'usdc', 'sol', 'ltc'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE ledgereventtype AS ENUM ('deposit', 'withdrawal', 'withdrawal_pending', 'withdrawal_cancelled', 'bet_placed', 'bet_won', 'bet_lost', 'bet_refunded', 'bet_voided', 'bonus_credit', 'bonus_wagered', 'bonus_forfeited', 'rakeback_credit', 'lossback_credit', 'admin_adjustment', 'system_correction', 'balance_frozen', 'balance_unfrozen'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE gametype AS ENUM ('dice', 'crash', 'plinko', 'mines', 'limbo', 'wheel', 'blackjack', 'roulette', 'slots'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE betstatus AS ENUM ('pending', 'active', 'won', 'lost', 'refunded', 'voided'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Use postgresql.ENUM with create_type=False to reference existing enums in columns
    _user_status = postgresql.ENUM('active', 'suspended', 'frozen', 'banned', 'pending_verification', name='userstatus', create_type=False)
    _kyc_level = postgresql.ENUM('none', 'tier_1', 'tier_2', 'tier_3', name='kyclevel', create_type=False)
    _currency = postgresql.ENUM('btc', 'eth', 'usdt', 'usdc', 'sol', 'ltc', name='currency', create_type=False)
    _ledger_event_type = postgresql.ENUM('deposit', 'withdrawal', 'withdrawal_pending', 'withdrawal_cancelled', 'bet_placed', 'bet_won', 'bet_lost', 'bet_refunded', 'bet_voided', 'bonus_credit', 'bonus_wagered', 'bonus_forfeited', 'rakeback_credit', 'lossback_credit', 'admin_adjustment', 'system_correction', 'balance_frozen', 'balance_unfrozen', name='ledgereventtype', create_type=False)
    _game_type = postgresql.ENUM('dice', 'crash', 'plinko', 'mines', 'limbo', 'wheel', 'blackjack', 'roulette', 'slots', name='gametype', create_type=False)
    _bet_status = postgresql.ENUM('pending', 'active', 'won', 'lost', 'refunded', 'voided', name='betstatus', create_type=False)

    # ---- Users ----
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(50), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('status', _user_status, server_default='pending_verification', nullable=False),
        sa.Column('kyc_level', _kyc_level, server_default='none', nullable=False),
        sa.Column('email_verified', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('phone_verified', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('totp_secret', sa.String(32), nullable=True),
        sa.Column('totp_enabled', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('vip_level', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('vip_xp', sa.BigInteger, server_default=sa.text('0'), nullable=False),
        sa.Column('risk_score', sa.Numeric(5, 4), server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('idx_users_status', 'users', ['status'])
    op.create_index('idx_users_kyc', 'users', ['kyc_level'])
    op.create_index('idx_users_vip', 'users', ['vip_level'])

    # ---- User balances ----
    op.create_table(
        'user_balances',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('currency', _currency, nullable=False),
        sa.Column('available', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('locked', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('frozen', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('bonus_balance', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('wagering_requirement', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('total_deposited', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('total_withdrawn', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('total_wagered', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('total_won', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'currency', name='uq_user_currency'),
        sa.CheckConstraint('available >= 0', name='ck_available_positive'),
        sa.CheckConstraint('locked >= 0', name='ck_locked_positive'),
        sa.CheckConstraint('frozen >= 0', name='ck_frozen_positive'),
    )

    # ---- User sessions ----
    op.create_table(
        'user_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('refresh_token_hash', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('device_fingerprint', sa.String(64), nullable=True),
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_sessions_user', 'user_sessions', ['user_id'])
    op.create_index('idx_sessions_token', 'user_sessions', ['refresh_token_hash'])

    # ---- Ledger events (event sourcing) ----
    op.create_table(
        'ledger_events',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('event_id', postgresql.UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('event_type', _ledger_event_type, nullable=False),
        sa.Column('currency', _currency, nullable=False),
        sa.Column('amount', sa.Numeric(20, 8), nullable=False),
        sa.Column('balance_before', sa.Numeric(20, 8), nullable=False),
        sa.Column('balance_after', sa.Numeric(20, 8), nullable=False),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('event_metadata', postgresql.JSONB, nullable=True),
        sa.Column('checksum', sa.String(64), nullable=False),
        sa.Column('previous_checksum', sa.String(64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_ledger_user_time', 'ledger_events', ['user_id', 'created_at'])
    op.create_index('idx_ledger_reference', 'ledger_events', ['reference_type', 'reference_id'])
    op.create_index('idx_ledger_type', 'ledger_events', ['event_type'])
    op.create_index('idx_ledger_checksum', 'ledger_events', ['checksum'])

    # ---- Server seeds (provably fair) ----
    op.create_table(
        'server_seeds',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('seed_id', postgresql.UUID(as_uuid=True), unique=True, nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seed', sa.String(64), nullable=False),
        sa.Column('seed_hash', sa.String(64), nullable=False),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('nonce', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('revealed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_server_seeds_seed_hash', 'server_seeds', ['seed_hash'])
    op.create_index('idx_seeds_user_active', 'server_seeds', ['user_id', 'is_active'])

    # ---- Client seeds ----
    op.create_table(
        'client_seeds',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('seed', sa.String(64), nullable=False),
        sa.Column('is_active', sa.Boolean, server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_client_seeds_user', 'client_seeds', ['user_id', 'is_active'])

    # ---- Bets ----
    op.create_table(
        'bets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('game_type', _game_type, nullable=False),
        sa.Column('game_round_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('currency', _currency, nullable=False),
        sa.Column('bet_amount', sa.Numeric(20, 8), nullable=False),
        sa.Column('status', _bet_status, server_default='pending', nullable=False),
        sa.Column('multiplier', sa.Numeric(20, 8), nullable=True),
        sa.Column('payout', sa.Numeric(20, 8), nullable=True),
        sa.Column('profit', sa.Numeric(20, 8), nullable=True),
        sa.Column('server_seed_id', sa.BigInteger, sa.ForeignKey('server_seeds.id'), nullable=False),
        sa.Column('client_seed', sa.String(64), nullable=False),
        sa.Column('nonce', sa.Integer, nullable=False),
        sa.Column('game_data', postgresql.JSONB, nullable=True),
        sa.Column('result_data', postgresql.JSONB, nullable=True),
        sa.Column('idempotency_key', sa.String(64), unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('settled_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint('bet_amount > 0', name='ck_bet_amount_positive'),
    )
    op.create_index('idx_bets_user_time', 'bets', ['user_id', 'created_at'])
    op.create_index('idx_bets_game', 'bets', ['game_type', 'created_at'])
    op.create_index('idx_bets_status', 'bets', ['status'])
    op.create_index('ix_bets_idempotency', 'bets', ['idempotency_key'])

    # ---- Deposits ----
    op.create_table(
        'deposits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('currency', _currency, nullable=False),
        sa.Column('amount', sa.Numeric(20, 8), nullable=False),
        sa.Column('tx_hash', sa.String(128), unique=True, nullable=True),
        sa.Column('from_address', sa.String(128), nullable=True),
        sa.Column('to_address', sa.String(128), nullable=False),
        sa.Column('confirmations', sa.Integer, server_default=sa.text('0'), nullable=False),
        sa.Column('required_confirmations', sa.Integer, nullable=False),
        sa.Column('status', sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column('credited', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_deposits_user', 'deposits', ['user_id'])
    op.create_index('idx_deposits_status', 'deposits', ['status'])
    op.create_index('idx_deposits_tx', 'deposits', ['tx_hash'])

    # ---- Withdrawals ----
    op.create_table(
        'withdrawals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('currency', _currency, nullable=False),
        sa.Column('amount', sa.Numeric(20, 8), nullable=False),
        sa.Column('fee', sa.Numeric(20, 8), server_default=sa.text('0'), nullable=False),
        sa.Column('to_address', sa.String(128), nullable=False),
        sa.Column('tx_hash', sa.String(128), unique=True, nullable=True),
        sa.Column('status', sa.String(20), server_default=sa.text("'pending'"), nullable=False),
        sa.Column('requires_manual_approval', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text, nullable=True),
        sa.Column('idempotency_key', sa.String(64), unique=True, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_withdrawals_user', 'withdrawals', ['user_id'])
    op.create_index('idx_withdrawals_status', 'withdrawals', ['status'])

    # ---- Admin actions (audit log) ----
    op.create_table(
        'admin_actions',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('requires_approval', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('details', postgresql.JSONB, nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_admin_actions_admin', 'admin_actions', ['admin_id'])
    op.create_index('idx_admin_actions_target', 'admin_actions', ['target_type', 'target_id'])

    # ---- System alerts ----
    op.create_table(
        'system_alerts',
        sa.Column('id', sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('details', postgresql.JSONB, nullable=True),
        sa.Column('acknowledged', sa.Boolean, server_default=sa.text('false'), nullable=False),
        sa.Column('acknowledged_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_alerts_type_severity', 'system_alerts', ['alert_type', 'severity'])
    op.create_index('idx_alerts_unacknowledged', 'system_alerts', ['acknowledged', 'created_at'])


def downgrade() -> None:
    op.drop_table('system_alerts')
    op.drop_table('admin_actions')
    op.drop_table('withdrawals')
    op.drop_table('deposits')
    op.drop_table('bets')
    op.drop_table('client_seeds')
    op.drop_table('server_seeds')
    op.drop_table('ledger_events')
    op.drop_table('user_sessions')
    op.drop_table('user_balances')
    op.drop_table('users')

    bet_status_enum.drop(op.get_bind(), checkfirst=True)
    game_type_enum.drop(op.get_bind(), checkfirst=True)
    ledger_event_type_enum.drop(op.get_bind(), checkfirst=True)
    currency_enum.drop(op.get_bind(), checkfirst=True)
    kyc_level_enum.drop(op.get_bind(), checkfirst=True)
    user_status_enum.drop(op.get_bind(), checkfirst=True)
