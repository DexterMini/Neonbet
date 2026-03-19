"""
Database Models - Event Sourced Ledger System
==============================================

All financial state changes are immutable events.
Current balances are derived from event log.
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional, Dict, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    Column, String, Integer, BigInteger, Numeric, Boolean, 
    DateTime, ForeignKey, Index, Text, Enum as SQLEnum,
    CheckConstraint, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


# ============================================================================
# ENUMS
# ============================================================================

class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    FROZEN = "frozen"
    BANNED = "banned"
    PENDING_VERIFICATION = "pending_verification"


class KYCLevel(str, Enum):
    NONE = "none"
    TIER_1 = "tier_1"  # Email + Phone
    TIER_2 = "tier_2"  # ID + Selfie
    TIER_3 = "tier_3"  # Enhanced Due Diligence


class LedgerEventType(str, Enum):
    # Deposits & Withdrawals
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"
    WITHDRAWAL_PENDING = "withdrawal_pending"
    WITHDRAWAL_CANCELLED = "withdrawal_cancelled"
    
    # Gaming
    BET_PLACED = "bet_placed"
    BET_WON = "bet_won"
    BET_LOST = "bet_lost"
    BET_REFUNDED = "bet_refunded"
    BET_VOIDED = "bet_voided"
    
    # Bonuses & Promotions
    BONUS_CREDIT = "bonus_credit"
    BONUS_WAGERED = "bonus_wagered"
    BONUS_FORFEITED = "bonus_forfeited"
    RAKEBACK_CREDIT = "rakeback_credit"
    LOSSBACK_CREDIT = "lossback_credit"
    
    # Admin & System
    ADMIN_ADJUSTMENT = "admin_adjustment"
    SYSTEM_CORRECTION = "system_correction"
    
    # Freeze operations
    BALANCE_FROZEN = "balance_frozen"
    BALANCE_UNFROZEN = "balance_unfrozen"


class Currency(str, Enum):
    BTC = "btc"
    ETH = "eth"
    USDT = "usdt"
    USDC = "usdc"
    SOL = "sol"
    LTC = "ltc"


class GameType(str, Enum):
    DICE = "dice"
    CRASH = "crash"
    PLINKO = "plinko"
    MINES = "mines"
    LIMBO = "limbo"
    WHEEL = "wheel"
    BLACKJACK = "blackjack"
    ROULETTE = "roulette"
    SLOTS = "slots"


class BetStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"  # For games like crash
    WON = "won"
    LOST = "lost"
    REFUNDED = "refunded"
    VOIDED = "voided"


# ============================================================================
# USER MODELS
# ============================================================================

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Status & Verification
    status = Column(SQLEnum(UserStatus, values_callable=lambda e: [x.value for x in e], create_constraint=False), default=UserStatus.PENDING_VERIFICATION, nullable=False)
    kyc_level = Column(SQLEnum(KYCLevel, values_callable=lambda e: [x.value for x in e], create_constraint=False), default=KYCLevel.NONE, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    phone_verified = Column(Boolean, default=False, nullable=False)
    
    # 2FA
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False, nullable=False)
    
    # Profile
    phone = Column(String(20), nullable=True)
    country = Column(String(2), nullable=True)  # ISO 3166-1 alpha-2
    
    # VIP
    vip_level = Column(Integer, default=0, nullable=False)
    vip_xp = Column(BigInteger, default=0, nullable=False)
    
    # Admin
    is_admin = Column(Boolean, default=False, nullable=False)
    
    # Risk
    risk_score = Column(Numeric(5, 4), default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    balances = relationship("UserBalance", back_populates="user", lazy="selectin")
    ledger_events = relationship("LedgerEvent", back_populates="user", lazy="dynamic")
    bets = relationship("Bet", back_populates="user", lazy="dynamic")
    sessions = relationship("UserSession", back_populates="user", lazy="dynamic")
    
    __table_args__ = (
        Index("idx_users_status", "status"),
        Index("idx_users_kyc", "kyc_level"),
        Index("idx_users_vip", "vip_level"),
    )


class UserBalance(Base):
    """Current balance per currency (derived from ledger)"""
    __tablename__ = "user_balances"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    currency = Column(SQLEnum(Currency, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    
    # Balances (always derived from ledger sum)
    available = Column(Numeric(20, 8), default=0, nullable=False)
    locked = Column(Numeric(20, 8), default=0, nullable=False)  # In active bets
    frozen = Column(Numeric(20, 8), default=0, nullable=False)  # Frozen by risk/admin
    
    # Wagering requirements
    bonus_balance = Column(Numeric(20, 8), default=0, nullable=False)
    wagering_requirement = Column(Numeric(20, 8), default=0, nullable=False)
    
    # Stats
    total_deposited = Column(Numeric(20, 8), default=0, nullable=False)
    total_withdrawn = Column(Numeric(20, 8), default=0, nullable=False)
    total_wagered = Column(Numeric(20, 8), default=0, nullable=False)
    total_won = Column(Numeric(20, 8), default=0, nullable=False)
    
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="balances")
    
    __table_args__ = (
        UniqueConstraint("user_id", "currency", name="uq_user_currency"),
        CheckConstraint("available >= 0", name="ck_available_positive"),
        CheckConstraint("locked >= 0", name="ck_locked_positive"),
        CheckConstraint("frozen >= 0", name="ck_frozen_positive"),
    )


class UserSession(Base):
    """User session tracking"""
    __tablename__ = "user_sessions"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    refresh_token_hash = Column(String(255), nullable=False)
    
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    device_fingerprint = Column(String(64), nullable=True)
    country = Column(String(2), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    
    user = relationship("User", back_populates="sessions")
    
    __table_args__ = (
        Index("idx_sessions_user", "user_id"),
        Index("idx_sessions_token", "refresh_token_hash"),
    )


# ============================================================================
# LEDGER (EVENT SOURCING)
# ============================================================================

class LedgerEvent(Base):
    """
    Immutable event log for all balance changes.
    
    This is the source of truth. UserBalance is a cached view.
    """
    __tablename__ = "ledger_events"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    event_id = Column(PGUUID(as_uuid=True), unique=True, default=uuid4, nullable=False)
    
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    event_type = Column(SQLEnum(LedgerEventType, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    currency = Column(SQLEnum(Currency, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    
    # Amounts
    amount = Column(Numeric(20, 8), nullable=False)  # Positive = credit, Negative = debit
    balance_before = Column(Numeric(20, 8), nullable=False)
    balance_after = Column(Numeric(20, 8), nullable=False)
    
    # Reference to originating transaction
    reference_type = Column(String(50), nullable=True)  # "bet", "deposit", "withdrawal", etc.
    reference_id = Column(PGUUID(as_uuid=True), nullable=True)
    
    # Audit metadata
    event_metadata = Column(JSONB, nullable=True)
    
    # Checksum for integrity verification
    checksum = Column(String(64), nullable=False)
    previous_checksum = Column(String(64), nullable=True)  # Chain integrity
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="ledger_events")
    
    __table_args__ = (
        Index("idx_ledger_user_time", "user_id", "created_at"),
        Index("idx_ledger_reference", "reference_type", "reference_id"),
        Index("idx_ledger_type", "event_type"),
        Index("idx_ledger_checksum", "checksum"),
    )


# ============================================================================
# PROVABLY FAIR
# ============================================================================

class ServerSeed(Base):
    """Pre-generated server seeds for provably fair"""
    __tablename__ = "server_seeds"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    seed_id = Column(PGUUID(as_uuid=True), unique=True, default=uuid4, nullable=False)
    
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # The actual seed (revealed after use)
    seed = Column(String(64), nullable=False)
    # Hash commitment (shown to user before betting)
    seed_hash = Column(String(64), nullable=False, index=True)
    
    # State
    is_active = Column(Boolean, default=True, nullable=False)
    nonce = Column(Integer, default=0, nullable=False)  # Current nonce
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revealed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_seeds_user_active", "user_id", "is_active"),
    )


class ClientSeed(Base):
    """Client-provided seeds"""
    __tablename__ = "client_seeds"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    seed = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index("idx_client_seeds_user", "user_id", "is_active"),
    )


# ============================================================================
# BETTING
# ============================================================================

class Bet(Base):
    """Individual bet record"""
    __tablename__ = "bets"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    # Game info
    game_type = Column(SQLEnum(GameType, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    game_round_id = Column(PGUUID(as_uuid=True), nullable=True)  # For multiplayer games
    
    # Bet details
    currency = Column(SQLEnum(Currency, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    bet_amount = Column(Numeric(20, 8), nullable=False)
    
    # Outcome
    status = Column(SQLEnum(BetStatus, values_callable=lambda e: [x.value for x in e], create_constraint=False), default=BetStatus.PENDING, nullable=False)
    multiplier = Column(Numeric(20, 8), nullable=True)  # Win multiplier
    payout = Column(Numeric(20, 8), nullable=True)
    profit = Column(Numeric(20, 8), nullable=True)  # payout - bet_amount
    
    # Provably Fair
    server_seed_id = Column(BigInteger, ForeignKey("server_seeds.id"), nullable=False)
    client_seed = Column(String(64), nullable=False)
    nonce = Column(Integer, nullable=False)
    
    # Game-specific data
    game_data = Column(JSONB, nullable=True)  # Input (e.g., target for dice)
    result_data = Column(JSONB, nullable=True)  # Output (e.g., rolled number)
    
    # Idempotency
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    settled_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="bets")
    
    __table_args__ = (
        Index("idx_bets_user_time", "user_id", "created_at"),
        Index("idx_bets_game", "game_type", "created_at"),
        Index("idx_bets_status", "status"),
        CheckConstraint("bet_amount > 0", name="ck_bet_amount_positive"),
    )


# ============================================================================
# WALLET & TRANSACTIONS
# ============================================================================

class Deposit(Base):
    """Crypto deposit tracking"""
    __tablename__ = "deposits"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    currency = Column(SQLEnum(Currency, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    amount = Column(Numeric(20, 8), nullable=False)
    
    # Blockchain data
    tx_hash = Column(String(128), unique=True, nullable=True)
    from_address = Column(String(128), nullable=True)
    to_address = Column(String(128), nullable=False)
    confirmations = Column(Integer, default=0, nullable=False)
    required_confirmations = Column(Integer, nullable=False)
    
    # Status
    status = Column(String(20), default="pending", nullable=False)  # pending, confirmed, failed
    credited = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_deposits_user", "user_id"),
        Index("idx_deposits_status", "status"),
        Index("idx_deposits_tx", "tx_hash"),
    )


class Withdrawal(Base):
    """Crypto withdrawal tracking"""
    __tablename__ = "withdrawals"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    
    currency = Column(SQLEnum(Currency, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False)
    amount = Column(Numeric(20, 8), nullable=False)
    fee = Column(Numeric(20, 8), default=0, nullable=False)
    
    # Destination
    to_address = Column(String(128), nullable=False)
    
    # Blockchain data
    tx_hash = Column(String(128), unique=True, nullable=True)
    
    # Status
    status = Column(String(20), default="pending", nullable=False)  # pending, approved, processing, completed, rejected
    
    # Approval
    requires_manual_approval = Column(Boolean, default=False, nullable=False)
    approved_by = Column(PGUUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Idempotency
    idempotency_key = Column(String(64), unique=True, nullable=False, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index("idx_withdrawals_user", "user_id"),
        Index("idx_withdrawals_status", "status"),
    )


# ============================================================================
# ADMIN & AUDIT
# ============================================================================

class AdminAction(Base):
    """Audit log for admin actions"""
    __tablename__ = "admin_actions"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    admin_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    action_type = Column(String(50), nullable=False)
    
    target_type = Column(String(50), nullable=True)  # "user", "bet", "withdrawal", etc.
    target_id = Column(PGUUID(as_uuid=True), nullable=True)
    
    # Dual approval
    requires_approval = Column(Boolean, default=False, nullable=False)
    approved_by = Column(PGUUID(as_uuid=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    details = Column(JSONB, nullable=True)
    
    ip_address = Column(String(45), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index("idx_admin_actions_admin", "admin_id"),
        Index("idx_admin_actions_target", "target_type", "target_id"),
    )


class SystemAlert(Base):
    """System alerts and anomalies"""
    __tablename__ = "system_alerts"
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    alert_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)  # info, warning, critical
    
    message = Column(Text, nullable=False)
    details = Column(JSONB, nullable=True)
    
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_by = Column(PGUUID(as_uuid=True), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index("idx_alerts_type_severity", "alert_type", "severity"),
        Index("idx_alerts_unacknowledged", "acknowledged", "created_at"),
    )


# ============================================================================
# GAME CONFIGURATION
# ============================================================================

class GameSettings(Base):
    """Game RTP and house edge configuration"""
    __tablename__ = "game_settings"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Game reference
    game_type = Column(SQLEnum(GameType, values_callable=lambda e: [x.value for x in e], create_constraint=False), nullable=False, unique=True, index=True)
    
    # RTP/House Edge
    house_edge = Column(Numeric(5, 4), nullable=False, default=Decimal("0.05"))  # 5% default
    
    # Description
    description = Column(Text, nullable=True)
    
    # Admin audit
    updated_by = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    __table_args__ = (
        Index("idx_game_settings_type", "game_type"),
    )
