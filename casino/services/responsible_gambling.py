"""
Responsible Gambling Enforcement Service
==========================================

Enforces deposit, wager, and loss limits by querying actual totals
from the ledger/bet tables and comparing against user-configured limits.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models.database import (
    Bet, BetStatus, Deposit, LedgerEvent, LedgerEventType,
)


def _period_start(period: str) -> datetime:
    """Return the UTC start timestamp for a rolling period."""
    now = datetime.now(UTC)
    if period == "daily":
        return now - timedelta(days=1)
    elif period == "weekly":
        return now - timedelta(weeks=1)
    elif period == "monthly":
        return now - timedelta(days=30)
    raise ValueError(f"Unknown period: {period}")


class ResponsibleGamblingEnforcer:
    """
    Checks user activity against configured limits.

    All monetary values are in the user's primary currency (USDT equivalent).
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Deposit limits
    # ------------------------------------------------------------------

    async def get_deposits_in_period(
        self, user_id: UUID, period: str
    ) -> Decimal:
        """Sum confirmed deposits in the given rolling period."""
        since = _period_start(period)
        result = await self.db.execute(
            select(func.coalesce(func.sum(Deposit.amount), 0)).where(
                and_(
                    Deposit.user_id == user_id,
                    Deposit.credited == True,
                    Deposit.created_at >= since,
                )
            )
        )
        return Decimal(str(result.scalar_one()))

    async def check_deposit_limit(
        self, user_id: UUID, amount: Decimal, settings
    ) -> Tuple[bool, Optional[str]]:
        """
        Check whether a deposit of *amount* would breach any configured limit.

        Returns (allowed, reason).
        """
        checks = [
            ("daily", settings.daily_deposit_limit),
            ("weekly", settings.weekly_deposit_limit),
            ("monthly", settings.monthly_deposit_limit),
        ]
        for period, limit in checks:
            if limit is None:
                continue
            limit = Decimal(str(limit))
            total = await self.get_deposits_in_period(user_id, period)
            if total + amount > limit:
                remaining = max(Decimal("0"), limit - total)
                return False, (
                    f"{period.capitalize()} deposit limit of "
                    f"${limit:.2f} would be exceeded. "
                    f"Remaining allowance: ${remaining:.2f}"
                )
        return True, None

    # ------------------------------------------------------------------
    # Wager (bet amount) limits
    # ------------------------------------------------------------------

    async def get_wagers_in_period(
        self, user_id: UUID, period: str
    ) -> Decimal:
        """Sum of bet amounts placed in the rolling period."""
        since = _period_start(period)
        result = await self.db.execute(
            select(func.coalesce(func.sum(Bet.bet_amount), 0)).where(
                and_(
                    Bet.user_id == user_id,
                    Bet.created_at >= since,
                )
            )
        )
        return Decimal(str(result.scalar_one()))

    async def check_wager_limit(
        self, user_id: UUID, amount: Decimal, settings
    ) -> Tuple[bool, Optional[str]]:
        """Check daily wager limit."""
        if settings.daily_wager_limit is None:
            return True, None
        limit = Decimal(str(settings.daily_wager_limit))
        total = await self.get_wagers_in_period(user_id, "daily")
        if total + amount > limit:
            remaining = max(Decimal("0"), limit - total)
            return False, (
                f"Daily wager limit of ${limit:.2f} would be exceeded. "
                f"Remaining allowance: ${remaining:.2f}"
            )
        return True, None

    # ------------------------------------------------------------------
    # Loss limits
    # ------------------------------------------------------------------

    async def get_losses_in_period(
        self, user_id: UUID, period: str
    ) -> Decimal:
        """Sum of net losses (negative profit on lost bets) in the period."""
        since = _period_start(period)
        result = await self.db.execute(
            select(func.coalesce(func.sum(Bet.bet_amount), 0)).where(
                and_(
                    Bet.user_id == user_id,
                    Bet.status == BetStatus.LOST,
                    Bet.created_at >= since,
                )
            )
        )
        return Decimal(str(result.scalar_one()))

    async def check_loss_limit(
        self, user_id: UUID, amount: Decimal, settings
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if placing a bet of *amount* could breach loss limits.

        Since we don't know the outcome yet, we check whether the user
        has already hit their loss limit. If current losses already
        exceed the limit, block the bet.
        """
        checks = [
            ("daily", settings.daily_loss_limit),
            ("weekly", settings.weekly_loss_limit),
            ("monthly", settings.monthly_loss_limit),
        ]
        for period, limit in checks:
            if limit is None:
                continue
            limit = Decimal(str(limit))
            total_losses = await self.get_losses_in_period(user_id, period)
            if total_losses >= limit:
                return False, (
                    f"{period.capitalize()} loss limit of "
                    f"${limit:.2f} reached (current losses: ${total_losses:.2f}). "
                    f"Take a break and come back later."
                )
        return True, None

    # ------------------------------------------------------------------
    # Combined pre-bet check
    # ------------------------------------------------------------------

    async def check_betting_allowed(
        self, user_id: UUID, bet_amount: Decimal, settings
    ) -> Tuple[bool, Optional[str]]:
        """
        Run all pre-bet responsible gambling checks.

        Returns (allowed, reason).
        """
        # Self-exclusion / cool-off already checked in bets.py before this call

        # Wager limit
        ok, reason = await self.check_wager_limit(user_id, bet_amount, settings)
        if not ok:
            return False, reason

        # Loss limit
        ok, reason = await self.check_loss_limit(user_id, bet_amount, settings)
        if not ok:
            return False, reason

        return True, None
