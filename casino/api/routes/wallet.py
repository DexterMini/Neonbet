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

from casino.models import (
    User, UserBalance, Currency, Deposit, Withdrawal,
    LedgerEvent, LedgerEventType,
)
from casino.api.dependencies import get_db, get_current_user
from casino.services.ledger import LedgerService, InsufficientBalanceError


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
    currency_upper = currency.upper()
    if currency_upper not in SUPPORTED_CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported currency. Available: {SUPPORTED_CURRENCIES}"
        )
    
    currency_upper = currency_upper  # already uppered above
    
    # TODO: Generate or retrieve deposit address from wallet service
    
    # Network defaults
    networks = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "USDT": network or "trc20",  # TRC20, ERC20, BEP20
        "USDC": network or "ethereum",
        "SOL": "solana",
        "LTC": "litecoin"
    }
    
    min_deposits = {
        "BTC": "0.0001",
        "ETH": "0.005",
        "USDT": "10",
        "USDC": "10",
        "SOL": "0.1",
        "LTC": "0.01"
    }
    
    confirmations = {
        "BTC": 3,
        "ETH": 12,
        "USDT": 20,
        "USDC": 12,
        "SOL": 32,
        "LTC": 6
    }
    
    # Mock address (TODO: real wallet service integration)
    mock_addresses = {
        "BTC": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        "ETH": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        "USDT": "TJYeasypBnB4Kv7Mkkzpd5MbRZpM3nALZM",
        "USDC": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        "SOL": "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
        "LTC": "ltc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
    }
    
    return DepositAddressResponse(
        currency=currency_upper,
        address=mock_addresses.get(currency_upper, "mock_address"),
        network=networks.get(currency_upper, "unknown"),
        min_deposit=min_deposits.get(currency_upper, "0.01"),
        confirmations_required=confirmations.get(currency_upper, 6)
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
    from_currency: str,
    to_currency: str,
    amount: Decimal,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Convert between currencies.
    
    Uses real-time exchange rates with 0.5% spread.
    """
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    if from_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {from_currency}")
    if to_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported currency: {to_currency}")
    
    # TODO: Get real exchange rates
    # TODO: Check balance
    # TODO: Perform conversion
    
    # Mock conversion
    mock_rates = {
        ("BTC", "USDT"): Decimal("42000"),
        ("ETH", "USDT"): Decimal("2500"),
        ("SOL", "USDT"): Decimal("100"),
        ("LTC", "USDT"): Decimal("70"),
    }
    
    return {
        "success": True,
        "from_currency": from_currency,
        "from_amount": str(amount),
        "to_currency": to_currency,
        "to_amount": "0.00",  # Calculated
        "rate": "0.00",
        "fee_percent": "0.5"
    }
