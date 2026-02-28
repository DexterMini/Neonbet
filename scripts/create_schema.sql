-- Casino Schema - Raw SQL (bypassing Alembic enum issues)
-- Run with: psql -U postgres -d casino -f scripts/create_schema.sql

BEGIN;

-- ============ ENUM TYPES ============

DO $$ BEGIN
    CREATE TYPE userstatus AS ENUM ('active', 'suspended', 'frozen', 'banned', 'pending_verification');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kyclevel AS ENUM ('none', 'tier_1', 'tier_2', 'tier_3');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE currency AS ENUM ('btc', 'eth', 'usdt', 'usdc', 'sol', 'ltc');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE ledgereventtype AS ENUM (
        'deposit', 'withdrawal', 'withdrawal_pending', 'withdrawal_cancelled',
        'bet_placed', 'bet_won', 'bet_lost', 'bet_refunded', 'bet_voided',
        'bonus_credit', 'bonus_wagered', 'bonus_forfeited',
        'rakeback_credit', 'lossback_credit',
        'admin_adjustment', 'system_correction',
        'balance_frozen', 'balance_unfrozen'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE gametype AS ENUM ('dice', 'crash', 'plinko', 'mines', 'limbo', 'wheel', 'blackjack', 'roulette', 'slots');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE betstatus AS ENUM ('pending', 'active', 'won', 'lost', 'refunded', 'voided');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============ TABLES ============

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status userstatus NOT NULL DEFAULT 'pending_verification',
    kyc_level kyclevel NOT NULL DEFAULT 'none',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    totp_secret VARCHAR(32),
    totp_enabled BOOLEAN NOT NULL DEFAULT false,
    phone VARCHAR(20),
    country VARCHAR(2),
    vip_level INTEGER NOT NULL DEFAULT 0,
    vip_xp BIGINT NOT NULL DEFAULT 0,
    risk_score NUMERIC(5,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE INDEX IF NOT EXISTS ix_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_kyc ON users(kyc_level);
CREATE INDEX IF NOT EXISTS idx_users_vip ON users(vip_level);

-- User balances
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency currency NOT NULL,
    available NUMERIC(20,8) NOT NULL DEFAULT 0,
    locked NUMERIC(20,8) NOT NULL DEFAULT 0,
    frozen NUMERIC(20,8) NOT NULL DEFAULT 0,
    bonus_balance NUMERIC(20,8) NOT NULL DEFAULT 0,
    wagering_requirement NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_deposited NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_wagered NUMERIC(20,8) NOT NULL DEFAULT 0,
    total_won NUMERIC(20,8) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_currency UNIQUE (user_id, currency),
    CONSTRAINT ck_available_positive CHECK (available >= 0),
    CONSTRAINT ck_locked_positive CHECK (locked >= 0),
    CONSTRAINT ck_frozen_positive CHECK (frozen >= 0)
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_fingerprint VARCHAR(64),
    country VARCHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token_hash);

-- Ledger events (event sourcing)
CREATE TABLE IF NOT EXISTS ledger_events (
    id BIGSERIAL PRIMARY KEY,
    event_id UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    event_type ledgereventtype NOT NULL,
    currency currency NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    balance_before NUMERIC(20,8) NOT NULL,
    balance_after NUMERIC(20,8) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    event_metadata JSONB,
    checksum VARCHAR(64) NOT NULL,
    previous_checksum VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user_time ON ledger_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_reference ON ledger_events(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ledger_checksum ON ledger_events(checksum);

-- Server seeds (provably fair)
CREATE TABLE IF NOT EXISTS server_seeds (
    id BIGSERIAL PRIMARY KEY,
    seed_id UUID UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed VARCHAR(64) NOT NULL,
    seed_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    nonce INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revealed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_server_seeds_seed_hash ON server_seeds(seed_hash);
CREATE INDEX IF NOT EXISTS idx_seeds_user_active ON server_seeds(user_id, is_active);

-- Client seeds
CREATE TABLE IF NOT EXISTS client_seeds (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_seeds_user ON client_seeds(user_id, is_active);

-- Bets
CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    game_type gametype NOT NULL,
    game_round_id UUID,
    currency currency NOT NULL,
    bet_amount NUMERIC(20,8) NOT NULL,
    status betstatus NOT NULL DEFAULT 'pending',
    multiplier NUMERIC(20,8),
    payout NUMERIC(20,8),
    profit NUMERIC(20,8),
    server_seed_id BIGINT NOT NULL REFERENCES server_seeds(id),
    client_seed VARCHAR(64) NOT NULL,
    nonce INTEGER NOT NULL,
    game_data JSONB,
    result_data JSONB,
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at TIMESTAMPTZ,
    CONSTRAINT ck_bet_amount_positive CHECK (bet_amount > 0)
);
CREATE INDEX IF NOT EXISTS idx_bets_user_time ON bets(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bets_game ON bets(game_type, created_at);
CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
CREATE INDEX IF NOT EXISTS ix_bets_idempotency ON bets(idempotency_key);

-- Deposits
CREATE TABLE IF NOT EXISTS deposits (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    currency currency NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    tx_hash VARCHAR(128) UNIQUE,
    from_address VARCHAR(128),
    to_address VARCHAR(128) NOT NULL,
    confirmations INTEGER NOT NULL DEFAULT 0,
    required_confirmations INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    credited BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx ON deposits(tx_hash);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    currency currency NOT NULL,
    amount NUMERIC(20,8) NOT NULL,
    fee NUMERIC(20,8) NOT NULL DEFAULT 0,
    to_address VARCHAR(128) NOT NULL,
    tx_hash VARCHAR(128) UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    requires_manual_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    idempotency_key VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Admin actions (audit log)
CREATE TABLE IF NOT EXISTS admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    details JSONB,
    ip_address VARCHAR(45) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);

-- System alerts
CREATE TABLE IF NOT EXISTS system_alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alerts_type_severity ON system_alerts(alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON system_alerts(acknowledged, created_at);

-- Mark the Alembic migration as applied
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('001_initial');

COMMIT;
