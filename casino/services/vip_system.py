"""
VIP System
==========

Rakeback, level progression, and rewards.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Dict, List, Optional, Any
from enum import IntEnum
import json

import redis.asyncio as redis


class VIPLevel(IntEnum):
    """VIP level tiers"""
    BRONZE = 0
    SILVER = 1
    GOLD = 2
    PLATINUM = 3
    DIAMOND = 4
    VIP = 5
    SVIP = 6


@dataclass
class VIPTier:
    """VIP tier configuration"""
    level: VIPLevel
    name: str
    min_wagered: Decimal  # Monthly wagered requirement (USD)
    rakeback_percent: Decimal
    level_up_bonus: Decimal
    weekly_bonus_percent: Decimal
    monthly_bonus_percent: Decimal
    withdraw_limit_daily: Decimal
    withdraw_limit_monthly: Decimal
    personal_manager: bool = False
    priority_support: bool = False
    exclusive_events: bool = False


# VIP tier configurations
VIP_TIERS: Dict[VIPLevel, VIPTier] = {
    VIPLevel.BRONZE: VIPTier(
        level=VIPLevel.BRONZE,
        name="Bronze",
        min_wagered=Decimal("0"),
        rakeback_percent=Decimal("0.05"),  # 5%
        level_up_bonus=Decimal("0"),
        weekly_bonus_percent=Decimal("0.001"),
        monthly_bonus_percent=Decimal("0.005"),
        withdraw_limit_daily=Decimal("1000"),
        withdraw_limit_monthly=Decimal("10000"),
    ),
    VIPLevel.SILVER: VIPTier(
        level=VIPLevel.SILVER,
        name="Silver",
        min_wagered=Decimal("5000"),
        rakeback_percent=Decimal("0.10"),  # 10%
        level_up_bonus=Decimal("25"),
        weekly_bonus_percent=Decimal("0.002"),
        monthly_bonus_percent=Decimal("0.01"),
        withdraw_limit_daily=Decimal("5000"),
        withdraw_limit_monthly=Decimal("50000"),
        priority_support=True,
    ),
    VIPLevel.GOLD: VIPTier(
        level=VIPLevel.GOLD,
        name="Gold",
        min_wagered=Decimal("25000"),
        rakeback_percent=Decimal("0.15"),  # 15%
        level_up_bonus=Decimal("100"),
        weekly_bonus_percent=Decimal("0.003"),
        monthly_bonus_percent=Decimal("0.015"),
        withdraw_limit_daily=Decimal("10000"),
        withdraw_limit_monthly=Decimal("100000"),
        priority_support=True,
    ),
    VIPLevel.PLATINUM: VIPTier(
        level=VIPLevel.PLATINUM,
        name="Platinum",
        min_wagered=Decimal("100000"),
        rakeback_percent=Decimal("0.20"),  # 20%
        level_up_bonus=Decimal("500"),
        weekly_bonus_percent=Decimal("0.004"),
        monthly_bonus_percent=Decimal("0.02"),
        withdraw_limit_daily=Decimal("25000"),
        withdraw_limit_monthly=Decimal("250000"),
        priority_support=True,
        exclusive_events=True,
    ),
    VIPLevel.DIAMOND: VIPTier(
        level=VIPLevel.DIAMOND,
        name="Diamond",
        min_wagered=Decimal("500000"),
        rakeback_percent=Decimal("0.25"),  # 25%
        level_up_bonus=Decimal("2500"),
        weekly_bonus_percent=Decimal("0.005"),
        monthly_bonus_percent=Decimal("0.025"),
        withdraw_limit_daily=Decimal("50000"),
        withdraw_limit_monthly=Decimal("500000"),
        priority_support=True,
        exclusive_events=True,
        personal_manager=True,
    ),
    VIPLevel.VIP: VIPTier(
        level=VIPLevel.VIP,
        name="VIP",
        min_wagered=Decimal("2000000"),
        rakeback_percent=Decimal("0.30"),  # 30%
        level_up_bonus=Decimal("10000"),
        weekly_bonus_percent=Decimal("0.006"),
        monthly_bonus_percent=Decimal("0.03"),
        withdraw_limit_daily=Decimal("100000"),
        withdraw_limit_monthly=Decimal("1000000"),
        priority_support=True,
        exclusive_events=True,
        personal_manager=True,
    ),
    VIPLevel.SVIP: VIPTier(
        level=VIPLevel.SVIP,
        name="SVIP",
        min_wagered=Decimal("10000000"),
        rakeback_percent=Decimal("0.35"),  # 35%
        level_up_bonus=Decimal("50000"),
        weekly_bonus_percent=Decimal("0.007"),
        monthly_bonus_percent=Decimal("0.035"),
        withdraw_limit_daily=Decimal("500000"),
        withdraw_limit_monthly=Decimal("5000000"),
        priority_support=True,
        exclusive_events=True,
        personal_manager=True,
    ),
}

# Approximate USD rates for wagering calculations (updated periodically)
_CURRENCY_USD_RATES: Dict[str, Decimal] = {
    "btc": Decimal("50000"),
    "eth": Decimal("3000"),
    "sol": Decimal("150"),
    "ltc": Decimal("80"),
    "usdt": Decimal("1"),
    "usdc": Decimal("1"),
}


def _to_usd(amount: Decimal, currency: str) -> Decimal:
    """Convert crypto amount to approximate USD."""
    rate = _CURRENCY_USD_RATES.get(currency.lower(), Decimal("1"))
    return amount * rate


@dataclass
class UserVIPStatus:
    """User's VIP status"""
    user_id: str
    level: VIPLevel
    total_wagered: Decimal
    wagered_this_month: Decimal
    rakeback_available: Decimal
    rakeback_claimed_total: Decimal
    weekly_bonus_available: Decimal
    monthly_bonus_available: Decimal
    level_progress: float  # 0-100% to next level
    next_level_requirement: Optional[Decimal] = None
    last_updated: datetime = field(default_factory=lambda: datetime.now(UTC))


class VIPService:
    """
    VIP system service.

    Handles:
    - Level progression
    - Rakeback calculation and distribution
    - Weekly/Monthly bonuses
    - Level-up bonuses
    """

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    def get_tier(self, level: VIPLevel) -> VIPTier:
        """Get VIP tier configuration"""
        return VIP_TIERS[level]

    def calculate_level(self, monthly_wagered: Decimal) -> VIPLevel:
        """Calculate VIP level based on monthly wagered amount (in USD)"""
        level = VIPLevel.BRONZE

        for tier in sorted(VIP_TIERS.values(), key=lambda t: t.min_wagered, reverse=True):
            if monthly_wagered >= tier.min_wagered:
                level = tier.level
                break

        return level

    def calculate_level_progress(
        self,
        monthly_wagered: Decimal,
        current_level: VIPLevel
    ) -> tuple[float, Optional[Decimal]]:
        """
        Calculate progress to next level.

        Returns:
            (progress_percent, next_level_requirement)
        """
        if current_level == VIPLevel.SVIP:
            return 100.0, None  # Max level

        current_tier = VIP_TIERS[current_level]
        next_level = VIPLevel(int(current_level) + 1)
        next_tier = VIP_TIERS[next_level]

        current_req = current_tier.min_wagered
        next_req = next_tier.min_wagered

        range_total = next_req - current_req
        progress = monthly_wagered - current_req

        progress_percent = min(100.0, max(0.0, float(progress / range_total * 100)))
        remaining = next_req - monthly_wagered

        return progress_percent, remaining if remaining > 0 else None

    async def get_user_vip_status(
        self,
        user_id: str,
        db=None,
    ) -> "UserVIPStatus":
        """Get user's complete VIP status, querying DB when not cached."""
        # Try cache first
        cached = await self.redis.get(f"vip:status:{user_id}")
        if cached:
            data = json.loads(cached)
            return UserVIPStatus(
                user_id=data["user_id"],
                level=VIPLevel(data["level"]),
                total_wagered=Decimal(data["total_wagered"]),
                wagered_this_month=Decimal(data["wagered_this_month"]),
                rakeback_available=Decimal(data["rakeback_available"]),
                rakeback_claimed_total=Decimal(data["rakeback_claimed_total"]),
                weekly_bonus_available=Decimal(data["weekly_bonus_available"]),
                monthly_bonus_available=Decimal(data["monthly_bonus_available"]),
                level_progress=data["level_progress"],
                next_level_requirement=Decimal(data["next_level_requirement"]) if data.get("next_level_requirement") else None,
                last_updated=datetime.fromisoformat(data["last_updated"])
            )

        # Query from database
        if db is not None:
            return await self._query_vip_status_from_db(user_id, db)

        # Fallback: return default bronze status
        return UserVIPStatus(
            user_id=user_id,
            level=VIPLevel.BRONZE,
            total_wagered=Decimal("0"),
            wagered_this_month=Decimal("0"),
            rakeback_available=Decimal("0"),
            rakeback_claimed_total=Decimal("0"),
            weekly_bonus_available=Decimal("0"),
            monthly_bonus_available=Decimal("0"),
            level_progress=0.0,
            next_level_requirement=VIP_TIERS[VIPLevel.SILVER].min_wagered
        )

    async def _query_vip_status_from_db(self, user_id: str, db) -> "UserVIPStatus":
        """Query VIP status directly from the database."""
        from sqlalchemy import select, func
        from casino.models.database import UserBalance, Bet, User
        from uuid import UUID

        try:
            uid = UUID(user_id)
        except (ValueError, AttributeError):
            uid = user_id

        # Get all balance rows for total_wagered
        balance_result = await db.execute(
            select(UserBalance).where(UserBalance.user_id == uid)
        )
        balances = balance_result.scalars().all()

        total_wagered_usd = Decimal("0")
        for bal in balances:
            cur = bal.currency.value if hasattr(bal.currency, "value") else str(bal.currency)
            total_wagered_usd += _to_usd(bal.total_wagered or Decimal("0"), cur)

        # Get monthly wagered from bets in last 30 days
        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        monthly_result = await db.execute(
            select(Bet.currency, func.sum(Bet.bet_amount)).where(
                Bet.user_id == uid,
                Bet.created_at >= thirty_days_ago,
            ).group_by(Bet.currency)
        )
        monthly_wagered_usd = Decimal("0")
        for cur_enum, amount in monthly_result.all():
            cur = cur_enum.value if hasattr(cur_enum, "value") else str(cur_enum)
            monthly_wagered_usd += _to_usd(amount or Decimal("0"), cur)

        # Get current VIP level from user record
        user_result = await db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        current_level = VIPLevel(user.vip_level if user else 0)

        # Recalculate level based on actual monthly wagered
        computed_level = self.calculate_level(monthly_wagered_usd)
        progress, next_req = self.calculate_level_progress(monthly_wagered_usd, computed_level)

        # Get rakeback info from redis (separate key)
        rakeback_available = Decimal("0")
        rakeback_claimed = Decimal("0")
        rb_data = await self.redis.get(f"vip:rakeback:{user_id}")
        if rb_data:
            rb = json.loads(rb_data)
            rakeback_available = Decimal(rb.get("available", "0"))
            rakeback_claimed = Decimal(rb.get("claimed_total", "0"))

        status = UserVIPStatus(
            user_id=user_id,
            level=computed_level,
            total_wagered=total_wagered_usd,
            wagered_this_month=monthly_wagered_usd,
            rakeback_available=rakeback_available,
            rakeback_claimed_total=rakeback_claimed,
            weekly_bonus_available=Decimal("0"),
            monthly_bonus_available=Decimal("0"),
            level_progress=progress,
            next_level_requirement=next_req,
        )

        await self._cache_status(status)
        return status

    async def record_wager(
        self,
        user_id: str,
        wager_amount: Decimal,
        house_edge_amount: Decimal,
        db=None,
    ) -> Dict[str, Any]:
        """
        Record a wager and calculate rakeback.

        Called after each bet is placed.

        Args:
            user_id: User ID
            wager_amount: Total bet amount (in USD)
            house_edge_amount: House edge portion (in USD)
            db: Optional AsyncSession for level-up persistence

        Returns:
            Dict with rakeback earned and level-up info if applicable
        """
        status = await self.get_user_vip_status(user_id, db)
        tier = self.get_tier(status.level)

        # Calculate rakeback (percentage of house edge)
        rakeback_earned = house_edge_amount * tier.rakeback_percent

        # Update wagered amounts
        new_total = status.total_wagered + wager_amount
        new_monthly = status.wagered_this_month + wager_amount
        new_rakeback = status.rakeback_available + rakeback_earned

        # Persist rakeback to redis
        rb_data = {
            "available": str(new_rakeback),
            "claimed_total": str(status.rakeback_claimed_total),
        }
        await self.redis.setex(f"vip:rakeback:{user_id}", 86400, json.dumps(rb_data))

        # Check for level up
        new_level = self.calculate_level(new_monthly)
        level_up_bonus = Decimal("0")
        leveled_up = False

        if new_level > status.level:
            leveled_up = True
            new_tier = self.get_tier(new_level)
            level_up_bonus = new_tier.level_up_bonus

            # Persist new VIP level to DB
            if db is not None:
                from sqlalchemy import update
                from casino.models.database import User
                from uuid import UUID
                try:
                    uid = UUID(user_id)
                except (ValueError, AttributeError):
                    uid = user_id
                await db.execute(
                    update(User).where(User.id == uid).values(vip_level=int(new_level))
                )
                await db.commit()

        # Calculate new progress
        progress, next_req = self.calculate_level_progress(new_monthly, new_level)

        # Update cached status
        new_status = UserVIPStatus(
            user_id=user_id,
            level=new_level,
            total_wagered=new_total,
            wagered_this_month=new_monthly,
            rakeback_available=new_rakeback,
            rakeback_claimed_total=status.rakeback_claimed_total,
            weekly_bonus_available=status.weekly_bonus_available,
            monthly_bonus_available=status.monthly_bonus_available,
            level_progress=progress,
            next_level_requirement=next_req
        )

        await self._cache_status(new_status)

        return {
            "rakeback_earned": str(rakeback_earned),
            "rakeback_available": str(new_rakeback),
            "leveled_up": leveled_up,
            "new_level": new_level.name if leveled_up else None,
            "level_up_bonus": str(level_up_bonus) if leveled_up else None,
            "level_progress": progress
        }

    async def claim_rakeback(self, user_id: str, db=None) -> Dict[str, Any]:
        """
        Claim accumulated rakeback.

        Instant rakeback - can be claimed any time.
        Credits the USDT balance via LedgerService.
        """
        status = await self.get_user_vip_status(user_id, db)

        if status.rakeback_available <= Decimal("0"):
            return {
                "success": False,
                "message": "No rakeback available to claim",
                "amount": "0"
            }

        amount = status.rakeback_available

        # Credit user balance via ledger
        if db is not None:
            from casino.services.ledger import LedgerService
            from casino.models.database import Currency, LedgerEventType
            from uuid import UUID

            try:
                uid = UUID(user_id)
            except (ValueError, AttributeError):
                uid = user_id

            ledger = LedgerService(db)
            await ledger.credit(
                user_id=uid,
                currency=Currency.usdt,
                amount=amount,
                event_type=LedgerEventType.RAKEBACK_CREDIT,
                reference_type="rakeback",
                metadata={"claimed_at": datetime.now(UTC).isoformat()},
            )

        # Update rakeback state
        new_claimed = status.rakeback_claimed_total + amount
        rb_data = {
            "available": "0",
            "claimed_total": str(new_claimed),
        }
        await self.redis.setex(f"vip:rakeback:{user_id}", 86400, json.dumps(rb_data))

        # Invalidate cached VIP status
        await self.redis.delete(f"vip:status:{user_id}")

        return {
            "success": True,
            "amount": str(amount),
            "total_claimed": str(new_claimed)
        }

    async def calculate_weekly_bonus(self, user_id: str, db=None) -> Decimal:
        """Calculate weekly bonus based on last week's wagered amount."""
        if db is None:
            return Decimal("0")

        from sqlalchemy import select, func
        from casino.models.database import Bet
        from uuid import UUID

        try:
            uid = UUID(user_id)
        except (ValueError, AttributeError):
            uid = user_id

        seven_days_ago = datetime.now(UTC) - timedelta(days=7)
        fourteen_days_ago = datetime.now(UTC) - timedelta(days=14)

        result = await db.execute(
            select(Bet.currency, func.sum(Bet.bet_amount)).where(
                Bet.user_id == uid,
                Bet.created_at >= fourteen_days_ago,
                Bet.created_at < seven_days_ago,
            ).group_by(Bet.currency)
        )
        wagered_last_week = Decimal("0")
        for cur_enum, amount in result.all():
            cur = cur_enum.value if hasattr(cur_enum, "value") else str(cur_enum)
            wagered_last_week += _to_usd(amount or Decimal("0"), cur)

        status = await self.get_user_vip_status(user_id, db)
        tier = self.get_tier(status.level)

        return wagered_last_week * tier.weekly_bonus_percent

    async def calculate_monthly_bonus(self, user_id: str, db=None) -> Decimal:
        """Calculate monthly bonus based on last month's wagered amount."""
        if db is None:
            return Decimal("0")

        from sqlalchemy import select, func
        from casino.models.database import Bet
        from uuid import UUID

        try:
            uid = UUID(user_id)
        except (ValueError, AttributeError):
            uid = user_id

        thirty_days_ago = datetime.now(UTC) - timedelta(days=30)
        sixty_days_ago = datetime.now(UTC) - timedelta(days=60)

        result = await db.execute(
            select(Bet.currency, func.sum(Bet.bet_amount)).where(
                Bet.user_id == uid,
                Bet.created_at >= sixty_days_ago,
                Bet.created_at < thirty_days_ago,
            ).group_by(Bet.currency)
        )
        wagered_last_month = Decimal("0")
        for cur_enum, amount in result.all():
            cur = cur_enum.value if hasattr(cur_enum, "value") else str(cur_enum)
            wagered_last_month += _to_usd(amount or Decimal("0"), cur)

        status = await self.get_user_vip_status(user_id, db)
        tier = self.get_tier(status.level)

        return wagered_last_month * tier.monthly_bonus_percent

    async def claim_weekly_bonus(self, user_id: str, db=None) -> Dict[str, Any]:
        """Claim weekly bonus."""
        amount = await self.calculate_weekly_bonus(user_id, db)

        if amount <= Decimal("0"):
            return {
                "success": False,
                "message": "No weekly bonus available",
                "amount": "0"
            }

        if db is not None:
            from casino.services.ledger import LedgerService
            from casino.models.database import Currency, LedgerEventType
            from uuid import UUID

            try:
                uid = UUID(user_id)
            except (ValueError, AttributeError):
                uid = user_id

            ledger = LedgerService(db)
            await ledger.credit(
                user_id=uid,
                currency=Currency.usdt,
                amount=amount,
                event_type=LedgerEventType.BONUS_CREDIT,
                reference_type="weekly_bonus",
                metadata={"claimed_at": datetime.now(UTC).isoformat()},
            )

        await self.redis.delete(f"vip:status:{user_id}")

        return {
            "success": True,
            "amount": str(amount)
        }

    async def claim_monthly_bonus(self, user_id: str, db=None) -> Dict[str, Any]:
        """Claim monthly bonus."""
        amount = await self.calculate_monthly_bonus(user_id, db)

        if amount <= Decimal("0"):
            return {
                "success": False,
                "message": "No monthly bonus available",
                "amount": "0"
            }

        if db is not None:
            from casino.services.ledger import LedgerService
            from casino.models.database import Currency, LedgerEventType
            from uuid import UUID

            try:
                uid = UUID(user_id)
            except (ValueError, AttributeError):
                uid = user_id

            ledger = LedgerService(db)
            await ledger.credit(
                user_id=uid,
                currency=Currency.usdt,
                amount=amount,
                event_type=LedgerEventType.BONUS_CREDIT,
                reference_type="monthly_bonus",
                metadata={"claimed_at": datetime.now(UTC).isoformat()},
            )

        await self.redis.delete(f"vip:status:{user_id}")

        return {
            "success": True,
            "amount": str(amount)
        }

    async def _cache_status(self, status: UserVIPStatus):
        """Cache user VIP status"""
        data = {
            "user_id": status.user_id,
            "level": int(status.level),
            "total_wagered": str(status.total_wagered),
            "wagered_this_month": str(status.wagered_this_month),
            "rakeback_available": str(status.rakeback_available),
            "rakeback_claimed_total": str(status.rakeback_claimed_total),
            "weekly_bonus_available": str(status.weekly_bonus_available),
            "monthly_bonus_available": str(status.monthly_bonus_available),
            "level_progress": status.level_progress,
            "next_level_requirement": str(status.next_level_requirement) if status.next_level_requirement else None,
            "last_updated": status.last_updated.isoformat()
        }

        await self.redis.setex(
            f"vip:status:{status.user_id}",
            300,  # 5 minute cache
            json.dumps(data)
        )

    def get_all_tiers(self) -> List[Dict[str, Any]]:
        """Get all VIP tier info for display"""
        return [
            {
                "level": tier.level,
                "name": tier.name,
                "min_wagered": str(tier.min_wagered),
                "rakeback_percent": f"{tier.rakeback_percent * 100}%",
                "level_up_bonus": str(tier.level_up_bonus),
                "weekly_bonus_percent": f"{tier.weekly_bonus_percent * 100}%",
                "monthly_bonus_percent": f"{tier.monthly_bonus_percent * 100}%",
                "withdraw_limit_daily": str(tier.withdraw_limit_daily),
                "withdraw_limit_monthly": str(tier.withdraw_limit_monthly),
                "personal_manager": tier.personal_manager,
                "priority_support": tier.priority_support,
                "exclusive_events": tier.exclusive_events
            }
            for tier in VIP_TIERS.values()
        ]

