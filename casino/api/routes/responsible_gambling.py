"""
Responsible Gambling API Endpoints
===================================

Deposit limits, loss limits, session time limits, self-exclusion, reality checks.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import User
from casino.models.database import Base, UserStatus
from casino.api.dependencies import get_db, get_current_user

from sqlalchemy import Column, String, Numeric, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from uuid import uuid4
from sqlalchemy.sql import func


# ============================================================================
# MODEL
# ============================================================================

class ResponsibleGamblingSettings(Base):
    """Per-user responsible gambling limits"""
    __tablename__ = "responsible_gambling_settings"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Deposit limits (per period, in USDT equivalent)
    daily_deposit_limit = Column(Numeric(20, 8), nullable=True)
    weekly_deposit_limit = Column(Numeric(20, 8), nullable=True)
    monthly_deposit_limit = Column(Numeric(20, 8), nullable=True)

    # Loss limits
    daily_loss_limit = Column(Numeric(20, 8), nullable=True)
    weekly_loss_limit = Column(Numeric(20, 8), nullable=True)
    monthly_loss_limit = Column(Numeric(20, 8), nullable=True)

    # Wager limits
    daily_wager_limit = Column(Numeric(20, 8), nullable=True)

    # Session time limits (minutes)
    session_time_limit = Column(Numeric(10, 0), nullable=True)

    # Reality check interval (minutes) – popup reminder
    reality_check_interval = Column(Numeric(10, 0), nullable=True)

    # Self-exclusion
    self_excluded = Column(Boolean, default=False, nullable=False)
    self_exclusion_until = Column(DateTime(timezone=True), nullable=True)

    # Cool-off period
    cool_off_until = Column(DateTime(timezone=True), nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


router = APIRouter(prefix="/responsible-gambling", tags=["Responsible Gambling"])


# ============================================================================
# REQUEST / RESPONSE MODELS
# ============================================================================

class LimitsRequest(BaseModel):
    daily_deposit_limit: Optional[float] = Field(None, ge=0)
    weekly_deposit_limit: Optional[float] = Field(None, ge=0)
    monthly_deposit_limit: Optional[float] = Field(None, ge=0)
    daily_loss_limit: Optional[float] = Field(None, ge=0)
    weekly_loss_limit: Optional[float] = Field(None, ge=0)
    monthly_loss_limit: Optional[float] = Field(None, ge=0)
    daily_wager_limit: Optional[float] = Field(None, ge=0)
    session_time_limit: Optional[int] = Field(None, ge=0, le=1440)
    reality_check_interval: Optional[int] = Field(None, ge=5, le=240)


class SelfExclusionRequest(BaseModel):
    duration_days: int = Field(..., ge=1, le=365, description="Self-exclusion duration in days")


class CoolOffRequest(BaseModel):
    hours: int = Field(..., ge=1, le=168, description="Cool-off duration in hours (max 7 days)")


class LimitsResponse(BaseModel):
    daily_deposit_limit: Optional[float] = None
    weekly_deposit_limit: Optional[float] = None
    monthly_deposit_limit: Optional[float] = None
    daily_loss_limit: Optional[float] = None
    weekly_loss_limit: Optional[float] = None
    monthly_loss_limit: Optional[float] = None
    daily_wager_limit: Optional[float] = None
    session_time_limit: Optional[int] = None
    reality_check_interval: Optional[int] = None
    self_excluded: bool = False
    self_exclusion_until: Optional[str] = None
    cool_off_until: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================

async def _get_or_create_settings(db: AsyncSession, user_id) -> ResponsibleGamblingSettings:
    result = await db.execute(
        select(ResponsibleGamblingSettings).where(ResponsibleGamblingSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ResponsibleGamblingSettings(user_id=user_id)
        db.add(settings)
        await db.flush()
    return settings


def _settings_to_response(s: ResponsibleGamblingSettings) -> LimitsResponse:
    return LimitsResponse(
        daily_deposit_limit=float(s.daily_deposit_limit) if s.daily_deposit_limit is not None else None,
        weekly_deposit_limit=float(s.weekly_deposit_limit) if s.weekly_deposit_limit is not None else None,
        monthly_deposit_limit=float(s.monthly_deposit_limit) if s.monthly_deposit_limit is not None else None,
        daily_loss_limit=float(s.daily_loss_limit) if s.daily_loss_limit is not None else None,
        weekly_loss_limit=float(s.weekly_loss_limit) if s.weekly_loss_limit is not None else None,
        monthly_loss_limit=float(s.monthly_loss_limit) if s.monthly_loss_limit is not None else None,
        daily_wager_limit=float(s.daily_wager_limit) if s.daily_wager_limit is not None else None,
        session_time_limit=int(s.session_time_limit) if s.session_time_limit is not None else None,
        reality_check_interval=int(s.reality_check_interval) if s.reality_check_interval is not None else None,
        self_excluded=s.self_excluded,
        self_exclusion_until=s.self_exclusion_until.isoformat() if s.self_exclusion_until else None,
        cool_off_until=s.cool_off_until.isoformat() if s.cool_off_until else None,
    )


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/limits", response_model=LimitsResponse)
async def get_limits(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's responsible gambling limits."""
    settings = await _get_or_create_settings(db, user.id)
    await db.commit()
    return _settings_to_response(settings)


@router.put("/limits", response_model=LimitsResponse)
async def update_limits(
    request: LimitsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update responsible gambling limits.

    Decreasing a limit takes effect immediately.
    Increasing a limit has a 24-hour cooling period (enforced client-side for now).
    """
    settings = await _get_or_create_settings(db, user.id)

    for field in (
        "daily_deposit_limit", "weekly_deposit_limit", "monthly_deposit_limit",
        "daily_loss_limit", "weekly_loss_limit", "monthly_loss_limit",
        "daily_wager_limit", "session_time_limit", "reality_check_interval",
    ):
        value = getattr(request, field)
        if value is not None:
            setattr(settings, field, Decimal(str(value)) if isinstance(value, float) else value)

    await db.commit()
    await db.refresh(settings)
    return _settings_to_response(settings)


@router.post("/self-exclude")
async def self_exclude(
    request: SelfExclusionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Self-exclude for a given number of days.

    This action is IRREVERSIBLE during the exclusion period.
    The account will be suspended and cannot place bets.
    """
    settings = await _get_or_create_settings(db, user.id)
    until = datetime.now(UTC) + timedelta(days=request.duration_days)
    settings.self_excluded = True
    settings.self_exclusion_until = until

    # Also suspend the user account
    await db.execute(
        update(User).where(User.id == user.id).values(status=UserStatus.SUSPENDED)
    )

    await db.commit()
    return {
        "message": f"Self-exclusion activated until {until.isoformat()}",
        "self_exclusion_until": until.isoformat(),
    }


@router.post("/cool-off")
async def cool_off(
    request: CoolOffRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Take a cool-off break. Cannot place bets until the period expires.
    """
    settings = await _get_or_create_settings(db, user.id)
    until = datetime.now(UTC) + timedelta(hours=request.hours)
    settings.cool_off_until = until
    await db.commit()
    return {
        "message": f"Cool-off period active until {until.isoformat()}",
        "cool_off_until": until.isoformat(),
    }


@router.get("/status")
async def gambling_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Check if the user is currently allowed to gamble.
    Returns any active restrictions.
    """
    settings = await _get_or_create_settings(db, user.id)
    now = datetime.now(UTC)

    restrictions = []

    if settings.self_excluded:
        if settings.self_exclusion_until and now < settings.self_exclusion_until:
            restrictions.append({
                "type": "self_exclusion",
                "until": settings.self_exclusion_until.isoformat(),
                "message": "Account is self-excluded",
            })
        else:
            # Exclusion expired — lift it
            settings.self_excluded = False
            settings.self_exclusion_until = None

    if settings.cool_off_until and now < settings.cool_off_until:
        restrictions.append({
            "type": "cool_off",
            "until": settings.cool_off_until.isoformat(),
            "message": "Cool-off period active",
        })

    await db.commit()

    return {
        "allowed": len(restrictions) == 0,
        "restrictions": restrictions,
        "limits": _settings_to_response(settings),
    }
