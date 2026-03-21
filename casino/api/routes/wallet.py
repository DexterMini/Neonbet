"""
Wallet API Endpoints
====================

Deposits, withdrawals, balance management.
"""

from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional, Dict, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import pyotp

from casino.config import settings
from casino.models import (
    User, UserBalance, Currency, Deposit, Withdrawal,
    LedgerEvent, LedgerEventType,
    kyc_level_to_int,
)
from casino.api.dependencies import get_db, get_current_user
from casino.services.ledger import LedgerService, InsufficientBalanceError
from casino.services.payment import get_payment_service, NOWPaymentsService
from casino.services.anti_arbitrage import AntiArbitrageEngine


router = APIRouter(prefix="/wallet", tags=["Wallet"])


# ========================
# Request/Response Models
# ========================

SUPPORTED_CURRENCIES = ["BTC", "ETH", "USDT", "USDC", "SOL", "LTC"]


class BalanceResponse(BaseModel):
    currency: str
    available: str
    locked: str
    total: str


class AllBalancesResponse(BaseModel):
    balances: List[BalanceResponse]
    total_usd: str


class DepositAddressResponse(BaseModel):
    currency: str
    address: str
    memo: Optional[str] = None  # For XRP, etc.
    network: str
    min_deposit: str
    confirmations_required: int


class WithdrawRequest(BaseModel):
    currency: str
    amount: Decimal = Field(..., gt=0)
    address: str
    memo: Optional[str] = None
    network: Optional[str] = None
    two_factor_code: Optional[str] = None
    
    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v):
        if v.upper() not in SUPPORTED_CURRENCIES:
            raise ValueError(f"Unsupported currency. Available: {SUPPORTED_CURRENCIES}")
        return v.upper()
    
    @field_validator("address")
    @classmethod
    def validate_address(cls, v):
        if len(v) < 20:
            raise ValueError("Invalid address")
        return v


class WithdrawResponse(BaseModel):
    withdrawal_id: str
    currency: str
    amount: str
    fee: str
    address: str
    status: str
    estimated_completion: Optional[str] = None
    created_at: str


class TransactionResponse(BaseModel):
    tx_id: str
    type: str  # deposit, withdrawal, bet, win, bonus
    currency: str
    amount: str
    status: str
    timestamp: str
    details: Optional[Dict] = None


# ========================
# Endpoints
# ========================

@router.get("/balances", response_model=AllBalancesResponse)
async def get_all_balances(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all wallet balances for authenticated user.
    
    Returns available, locked, and total for each currency.
    """
    result = await db.execute(
        select(UserBalance).where(UserBalance.user_id == user.id)
    )
    rows = result.scalars().all()

    balances: List[BalanceResponse] = []
    for b in rows:
        cur_name = b.currency.value.upper() if hasattr(b.currency, "value") else str(b.currency).upper()
        avail = b.available or Decimal(0)
        lock = b.locked or Decimal(0)
        balances.append(
            BalanceResponse(
                currency=cur_name,
                available=str(avail),
                locked=str(lock),
                total=str(avail + lock),
            )
        )

    return AllBalancesResponse(balances=balances, total_usd="0.00")


@router.get("/balance/{currency}", response_model=BalanceResponse)
async def get_balance(
    currency: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get balance for specific currency.
    """
    currency_upper = currency.upper()
    if currency_upper not in SUPPORTED_CURRENCIES:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported currency. Available: {SUPPORTED_CURRENCIES}"
        )

    try:
        cur_enum = Currency(currency_upper.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid currency")

    result = await db.execute(
        select(UserBalance).where(
            UserBalance.user_id == user.id,
            UserBalance.currency == cur_enum,
        )
    )
    bal = result.scalar_one_or_none()

    avail = bal.available if bal else Decimal(0)
    lock = bal.locked if bal else Decimal(0)

    return BalanceResponse(
        currency=currency_upper,
        available=str(avail),
        locked=str(lock),
        total=str(avail + lock),
    )


@router.get("/deposit/address/{currency}", response_model=DepositAddressResponse)
async def get_deposit_address(
    currency: str,
    network: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get deposit address for specific currency.
    
    Addresses are generated per-user and reusable.
    """
    raise HTTPException(
        status_code=410,
        detail="Direct deposit addresses are disabled. Use /api/v1/payments/deposit/invoice instead.",
    )


@router.post("/withdraw", response_model=WithdrawResponse)
async def withdraw(
    request: WithdrawRequest,
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
):
    """
    Request a withdrawal.
    
    **Requirements**:
    - Sufficient available balance
    - 2FA required for amounts > $500
    - KYC level determines daily limits
    """
    try:
        cur_enum = Currency(request.currency.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid currency")

    # Calculate fee
    fees = {
        "BTC": Decimal("0.0001"),
        "ETH": Decimal("0.005"),
        "USDT": Decimal("1"),
        "USDC": Decimal("1"),
        "SOL": Decimal("0.01"),
        "LTC": Decimal("0.001"),
    }
    fee = fees.get(request.currency, Decimal("0"))

    # Enforce 2FA for withdrawals when configured
    if settings.security.require_2fa_for_withdrawal:
        if not user.totp_enabled or not user.totp_secret:
            raise HTTPException(status_code=403, detail="2FA is required for withdrawals")
        if not request.two_factor_code:
            raise HTTPException(status_code=400, detail="Two-factor code required")
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(request.two_factor_code, valid_window=1):
            raise HTTPException(status_code=400, detail="Invalid or expired 2FA code")

    # KYC gating (thresholds aligned with risk engine defaults)
    kyc_level = kyc_level_to_int(user.kyc_level)
    if kyc_level == 0 and request.amount > Decimal("500"):
        raise HTTPException(status_code=403, detail="KYC required for withdrawals over $500")
    if kyc_level == 1 and request.amount > Decimal("5000"):
        raise HTTPException(status_code=403, detail="Enhanced KYC required for withdrawals over $5,000")

    # Check balance
    ledger = LedgerService(db)
    balance_info = await ledger.get_balance(user.id, cur_enum)
    if balance_info["available"] < request.amount + fee:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Debit via ledger
    withdrawal_id = uuid4()
    try:
        await ledger.debit(
            user_id=user.id,
            currency=cur_enum,
            amount=request.amount + fee,
            event_type=LedgerEventType.WITHDRAWAL_PENDING,
            reference_type="withdrawal",
            reference_id=withdrawal_id,
            metadata={"address": request.address, "fee": str(fee)},
        )
    except InsufficientBalanceError:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Create withdrawal record
    wd = Withdrawal(
        id=withdrawal_id,
        user_id=user.id,
        currency=cur_enum,
        amount=request.amount,
        fee=fee,
        to_address=request.address,
        status="pending",
        idempotency_key=idempotency_key,
    )
    db.add(wd)
    await db.commit()

    return WithdrawResponse(
        withdrawal_id=str(withdrawal_id),
        currency=request.currency,
        amount=str(request.amount),
        fee=str(fee),
        address=request.address,
        status="pending",
        created_at=datetime.now(UTC).isoformat(),
    )


@router.get("/withdrawals", response_model=List[WithdrawResponse])
async def get_withdrawals(
    status: Optional[str] = None,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get withdrawal history.
    """
    query = select(Withdrawal).where(Withdrawal.user_id == user.id)
    if status:
        query = query.where(Withdrawal.status == status)
    query = query.order_by(Withdrawal.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return [
        WithdrawResponse(
            withdrawal_id=str(w.id),
            currency=w.currency.value.upper() if hasattr(w.currency, "value") else str(w.currency).upper(),
            amount=str(w.amount),
            fee=str(w.fee),
            address=w.to_address,
            status=w.status,
            created_at=w.created_at.isoformat() if w.created_at else "",
        )
        for w in rows
    ]


@router.delete("/withdrawals/{withdrawal_id}")
async def cancel_withdrawal(
    withdrawal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a pending withdrawal.
    
    Only pending withdrawals can be cancelled.
    """
    from uuid import UUID as _UUID

    try:
        wid = _UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal ID")

    result = await db.execute(
        select(Withdrawal).where(
            Withdrawal.id == wid,
            Withdrawal.user_id == user.id,
        )
    )
    wd = result.scalar_one_or_none()
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if wd.status != "pending":
        raise HTTPException(status_code=400, detail="Only pending withdrawals can be cancelled")

    # Return funds
    try:
        cur_enum = Currency(wd.currency.value if hasattr(wd.currency, "value") else str(wd.currency).lower())
    except ValueError:
        cur_enum = wd.currency

    ledger = LedgerService(db)
    await ledger.credit(
        user_id=user.id,
        currency=cur_enum,
        amount=wd.amount + wd.fee,
        event_type=LedgerEventType.WITHDRAWAL_CANCELLED,
        reference_type="withdrawal",
        reference_id=wd.id,
    )
    wd.status = "cancelled"
    await db.commit()

    return {
        "success": True,
        "message": "Withdrawal cancelled",
        "withdrawal_id": withdrawal_id,
    }


@router.get("/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    type: Optional[str] = None,
    currency: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all wallet transactions from the ledger.
    """
    ledger = LedgerService(db)

    cur_enum = None
    if currency:
        try:
            cur_enum = Currency(currency.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid currency")

    event_types = None
    if type:
        mapping = {
            "deposit": [LedgerEventType.DEPOSIT],
            "withdrawal": [LedgerEventType.WITHDRAWAL, LedgerEventType.WITHDRAWAL_PENDING],
            "bet": [LedgerEventType.BET_PLACED],
            "win": [LedgerEventType.BET_WON],
            "loss": [LedgerEventType.BET_LOST],
            "bonus": [LedgerEventType.BONUS_CREDIT, LedgerEventType.RAKEBACK_CREDIT, LedgerEventType.LOSSBACK_CREDIT],
        }
        event_types = mapping.get(type)

    events = await ledger.get_transaction_history(
        user_id=user.id,
        currency=cur_enum,
        event_types=event_types,
        limit=limit,
        offset=offset,
    )

    return [
        TransactionResponse(
            tx_id=str(e.event_id),
            type=e.event_type.value,
            currency=e.currency.value.upper() if hasattr(e.currency, "value") else str(e.currency).upper(),
            amount=str(e.amount),
            status="completed",
            timestamp=e.created_at.isoformat() if e.created_at else "",
            details=e.event_metadata,
        )
        for e in events
    ]


@router.get("/deposits", response_model=List[TransactionResponse])
async def get_deposits(
    status: Optional[str] = None,
    currency: Optional[str] = None,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get deposit history.
    """
    query = select(Deposit).where(Deposit.user_id == user.id)
    if status:
        query = query.where(Deposit.status == status)
    if currency:
        try:
            cur_enum = Currency(currency.lower())
            query = query.where(Deposit.currency == cur_enum)
        except ValueError:
            pass
    query = query.order_by(Deposit.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return [
        TransactionResponse(
            tx_id=str(d.id),
            type="deposit",
            currency=d.currency.value.upper() if hasattr(d.currency, "value") else str(d.currency).upper(),
            amount=str(d.amount),
            status=d.status,
            timestamp=d.created_at.isoformat() if d.created_at else "",
            details={"tx_hash": d.tx_hash, "confirmations": d.confirmations},
        )
        for d in rows
    ]


@router.post("/convert")
async def convert_currency(
    client_request: Request,
    from_currency: str,
    to_currency: str,
    amount: Decimal,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    payment_svc: NOWPaymentsService = Depends(get_payment_service),
):
    """
    Convert between currencies within the casino wallet.

    Uses real-time NOWPayments exchange rates with 0.5% spread.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()

    if from_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {from_currency}")
    if to_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {to_currency}")
    if from_currency == to_currency:
        raise HTTPException(status_code=400, detail="Cannot convert currency to itself")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Anti-arbitrage checks
    redis_client = getattr(client_request.app.state, "redis", None)

    if redis_client:
        arb_engine = AntiArbitrageEngine(redis_client)
        # We pass a placeholder rate; the engine checks market price deviation independently
        ok, reason = await arb_engine.pre_conversion_check(
            user_id=str(user.id),
            from_currency=from_currency,
            to_currency=to_currency,
            platform_rate=Decimal("0"),  # Validated against market inside
        )
        if not ok:
            raise HTTPException(status_code=429, detail=reason)

    # Fetch USD value of source amount via NOWPayments
    try:
        # get_estimated_price gives us crypto amount for 1 USD; we need inverse
        # Use a reference amount of $1000 to get rate
        from_estimate = await payment_svc.get_estimated_price(1000.0, from_currency)
        to_estimate = await payment_svc.get_estimated_price(1000.0, to_currency)

        # from_estimate["estimated_amount"] = how many from_currency for $1000
        # to_estimate["estimated_amount"]   = how many to_currency for $1000
        from_per_usd = Decimal(str(from_estimate["estimated_amount"])) / Decimal("1000")
        to_per_usd = Decimal(str(to_estimate["estimated_amount"])) / Decimal("1000")

        if from_per_usd == 0 or to_per_usd == 0:
            raise HTTPException(status_code=502, detail="Failed to get valid exchange rates")

        # amount (from_currency) → USD → to_currency
        usd_value = amount / from_per_usd
        raw_to_amount = usd_value * to_per_usd

        # Apply 0.5% spread
        fee_percent = Decimal("0.005")
        to_amount = raw_to_amount * (1 - fee_percent)
        rate = raw_to_amount / amount
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Failed to fetch exchange rates")

    ledger = LedgerService(db)
    try:
        await ledger.debit(
            user_id=str(user.id),
            currency=from_currency,
            amount=amount,
            event_type=LedgerEventType.WITHDRAWAL,
            metadata={"reason": f"currency_conversion_{from_currency}_to_{to_currency}"},
        )
        await ledger.credit(
            user_id=str(user.id),
            currency=to_currency,
            amount=to_amount,
            event_type=LedgerEventType.DEPOSIT,
            metadata={"reason": f"currency_conversion_{from_currency}_to_{to_currency}"},
        )
    except InsufficientBalanceError:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Record conversion activity for cycling detection
    if redis_client:
        await arb_engine.record_activity(str(user.id), "convert")

    return {
        "success": True,
        "from_currency": from_currency,
        "from_amount": str(amount),
        "to_currency": to_currency,
        "to_amount": str(to_amount.quantize(Decimal("0.00000001"))),
        "rate": str(rate.quantize(Decimal("0.00000001"))),
        "fee_percent": "0.5",
    }


# ========================
# VIP Rewards & Claims
# ========================

@router.get("/vip/status")
async def get_vip_status(
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current VIP status including rakeback, lossback, and bonus info."""
    redis_client = getattr(client_request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status_code=503, detail="VIP service temporarily unavailable")

    from casino.services.vip_system import VIPService
    vip = VIPService(redis_client)

    status = await vip.get_user_vip_status(str(user.id), db)
    lossback = await vip.get_lossback_available(str(user.id), db)
    tier = vip.get_tier(status.level)

    return {
        "level": status.level.name,
        "level_index": int(status.level),
        "total_wagered": str(status.total_wagered),
        "wagered_this_month": str(status.wagered_this_month),
        "level_progress": status.level_progress,
        "next_level_requirement": str(status.next_level_requirement) if status.next_level_requirement else None,
        "xp": user.vip_xp,
        "rakeback": {
            "available": str(status.rakeback_available),
            "claimed_total": str(status.rakeback_claimed_total),
            "percent": str(tier.rakeback_percent * 100),
        },
        "lossback": {
            "available": lossback["available"],
            "net_loss": lossback["net_loss"],
            "percent": str(tier.lossback_percent * 100),
        },
        "bonuses": {
            "weekly_percent": str(tier.weekly_bonus_percent * 100),
            "monthly_percent": str(tier.monthly_bonus_percent * 100),
        },
        "limits": {
            "withdraw_daily": str(tier.withdraw_limit_daily),
            "withdraw_monthly": str(tier.withdraw_limit_monthly),
        },
        "perks": {
            "personal_manager": tier.personal_manager,
            "priority_support": tier.priority_support,
            "exclusive_events": tier.exclusive_events,
        },
    }


@router.post("/vip/claim-rakeback")
async def claim_rakeback(
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim accumulated rakeback. Credits USDT balance instantly."""
    redis_client = getattr(client_request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status_code=503, detail="VIP service temporarily unavailable")

    from casino.services.vip_system import VIPService
    vip = VIPService(redis_client)
    result = await vip.claim_rakeback(str(user.id), db)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/vip/claim-lossback")
async def claim_lossback(
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim weekly lossback. Credits USDT balance. Can only be claimed once per week."""
    redis_client = getattr(client_request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status_code=503, detail="VIP service temporarily unavailable")

    from casino.services.vip_system import VIPService
    vip = VIPService(redis_client)
    result = await vip.claim_lossback(str(user.id), db)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/vip/claim-weekly-bonus")
async def claim_weekly_bonus(
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim weekly bonus based on last week's wagered amount."""
    redis_client = getattr(client_request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status_code=503, detail="VIP service temporarily unavailable")

    from casino.services.vip_system import VIPService
    vip = VIPService(redis_client)
    result = await vip.claim_weekly_bonus(str(user.id), db)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/vip/claim-monthly-bonus")
async def claim_monthly_bonus(
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim monthly bonus based on last month's wagered amount."""
    redis_client = getattr(client_request.app.state, "redis", None)
    if redis_client is None:
        raise HTTPException(status_code=503, detail="VIP service temporarily unavailable")

    from casino.services.vip_system import VIPService
    vip = VIPService(redis_client)
    result = await vip.claim_monthly_bonus(str(user.id), db)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.get("/vip/tiers")
async def get_vip_tiers():
    """Get all VIP tier information for display."""
    from casino.services.vip_system import VIPService
    import redis.asyncio as aioredis
    from casino.config import settings as _settings

    try:
        r = aioredis.from_url(_settings.redis.url, decode_responses=True)
        try:
            vip = VIPService(r)
            return {"tiers": vip.get_all_tiers()}
        finally:
            await r.close()
    except Exception:
        # Fallback: return tiers without Redis (static data)
        from casino.services.vip_system import VIP_TIERS
        return {
            "tiers": [
                {
                    "level": int(t.level),
                    "name": t.name,
                    "min_wagered": str(t.min_wagered),
                    "rakeback_percent": f"{t.rakeback_percent * 100}%",
                    "lossback_percent": f"{t.lossback_percent * 100}%",
                }
                for t in VIP_TIERS.values()
            ]
        }
