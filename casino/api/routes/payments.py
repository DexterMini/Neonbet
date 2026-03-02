"""
Payment API Routes
==================

Handles NOWPayments integration:
- Create deposit invoices
- IPN webhook callbacks  
- Payment status checking
- Payout (withdrawal) processing
"""

import logging
from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import uuid4, UUID as _UUID

from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import (
    User, Currency, Deposit, LedgerEventType,
)
from casino.api.dependencies import get_db, get_current_user
from casino.services.ledger import LedgerService
from casino.services.payment import (
    get_payment_service,
    PaymentError,
    NOWPaymentsService,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])


# ═══════════════════════════════════
# Request / Response Models
# ═══════════════════════════════════

class CreateDepositRequest(BaseModel):
    amount_usd: float = Field(..., gt=0, le=50000, description="Amount in USD")
    currency: str = Field(..., description="Crypto currency (BTC, ETH, SOL, USDT, USDC, LTC)")


class CreateDepositResponse(BaseModel):
    deposit_id: str
    payment_id: Optional[int] = None
    invoice_id: Optional[str] = None
    invoice_url: Optional[str] = None
    pay_address: Optional[str] = None
    pay_amount: Optional[str] = None
    pay_currency: str
    price_amount_usd: float
    status: str
    created_at: str


class PaymentStatusResponse(BaseModel):
    deposit_id: str
    payment_id: Optional[int] = None
    status: str
    currency: str
    amount_usd: float
    pay_amount: Optional[str] = None
    actually_paid: Optional[str] = None
    created_at: str


class EstimateResponse(BaseModel):
    currency: str
    amount_usd: float
    estimated_crypto_amount: str
    min_amount: Optional[str] = None


class AvailableCurrenciesResponse(BaseModel):
    currencies: list[Dict[str, str]]


SUPPORTED = {"BTC", "ETH", "SOL", "USDT", "USDC", "LTC"}


# ═══════════════════════════════════
# Endpoints
# ═══════════════════════════════════

@router.get("/status")
async def payment_api_status():
    """Check if NOWPayments API is reachable"""
    svc = get_payment_service()
    try:
        data = await svc.get_status()
        return {"status": "ok", "nowpayments": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/currencies", response_model=AvailableCurrenciesResponse)
async def get_supported_currencies():
    """List supported deposit currencies with metadata"""
    currencies = [
        {"symbol": "BTC", "name": "Bitcoin", "network": "Bitcoin", "icon": "₿"},
        {"symbol": "ETH", "name": "Ethereum", "network": "ERC-20", "icon": "Ξ"},
        {"symbol": "SOL", "name": "Solana", "network": "Solana", "icon": "◎"},
        {"symbol": "USDT", "name": "Tether", "network": "TRC-20", "icon": "₮"},
        {"symbol": "USDC", "name": "USD Coin", "network": "ERC-20", "icon": "$"},
        {"symbol": "LTC", "name": "Litecoin", "network": "Litecoin", "icon": "Ł"},
    ]
    return AvailableCurrenciesResponse(currencies=currencies)


@router.get("/estimate", response_model=EstimateResponse)
async def estimate_deposit(
    amount_usd: float,
    currency: str,
):
    """
    Get estimated crypto amount for a USD deposit.
    No auth required — useful for showing amounts before deposit.
    """
    currency = currency.upper()
    if currency not in SUPPORTED:
        raise HTTPException(400, f"Unsupported currency: {currency}")
    
    svc = get_payment_service()
    try:
        estimate = await svc.get_estimated_price(amount_usd, currency)
        min_amt = await svc.get_minimum_amount(svc.map_currency(currency))
        
        return EstimateResponse(
            currency=currency,
            amount_usd=amount_usd,
            estimated_crypto_amount=str(estimate.get("estimated_amount", "0")),
            min_amount=str(min_amt),
        )
    except Exception as e:
        logger.error(f"Estimation failed: {e}")
        raise HTTPException(502, f"Payment processor unavailable: {str(e)}")


@router.post("/deposit", response_model=CreateDepositResponse)
async def create_deposit(
    req: CreateDepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a crypto deposit.
    
    Returns a unique pay address and amount.
    User sends crypto to this address → IPN callback credits balance.
    """
    currency = req.currency.upper()
    if currency not in SUPPORTED:
        raise HTTPException(400, f"Unsupported currency: {currency}")
    
    deposit_id = uuid4()
    order_id = f"dep_{user.id}_{deposit_id}"
    
    svc = get_payment_service()
    
    try:
        # Create payment via NOWPayments
        payment = await svc.create_payment(
            amount_usd=req.amount_usd,
            currency=currency,
            order_id=order_id,
            order_description=f"NeonBet Deposit - ${req.amount_usd:.2f}",
        )
        
        # Save deposit record in DB
        try:
            cur_enum = Currency(currency.lower())
        except ValueError:
            cur_enum = Currency.usd
        
        dep = Deposit(
            id=deposit_id,
            user_id=user.id,
            currency=cur_enum,
            amount=Decimal(str(payment.get("pay_amount", 0))),
            status="waiting",
            from_address=payment.get("pay_address", ""),
            tx_hash=str(payment.get("payment_id", "")),
            confirmations=0,
        )
        db.add(dep)
        await db.commit()
        
        return CreateDepositResponse(
            deposit_id=str(deposit_id),
            payment_id=payment.get("payment_id"),
            pay_address=payment.get("pay_address"),
            pay_amount=str(payment.get("pay_amount", "")),
            pay_currency=currency,
            price_amount_usd=req.amount_usd,
            status="waiting",
            created_at=datetime.now(UTC).isoformat(),
        )
        
    except PaymentError as e:
        logger.error(f"Deposit creation failed: {e}")
        raise HTTPException(502, f"Payment processor error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error creating deposit: {e}")
        raise HTTPException(500, "Failed to create deposit")


@router.post("/deposit/invoice", response_model=CreateDepositResponse)
async def create_deposit_invoice(
    req: CreateDepositRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a deposit invoice (hosted page).
    
    Returns an invoice_url that user can visit to complete payment.
    This is the easiest flow — NOWPayments handles the UI.
    """
    currency = req.currency.upper()
    if currency not in SUPPORTED:
        raise HTTPException(400, f"Unsupported currency: {currency}")
    
    deposit_id = uuid4()
    order_id = f"dep_{user.id}_{deposit_id}"
    
    svc = get_payment_service()
    
    try:
        invoice = await svc.create_invoice(
            amount_usd=req.amount_usd,
            currency=currency,
            order_id=order_id,
            order_description=f"NeonBet Deposit - ${req.amount_usd:.2f}",
        )
        
        try:
            cur_enum = Currency(currency.lower())
        except ValueError:
            cur_enum = Currency.usd
        
        dep = Deposit(
            id=deposit_id,
            user_id=user.id,
            currency=cur_enum,
            amount=Decimal(str(req.amount_usd)),
            status="waiting",
            tx_hash=str(invoice.get("id", "")),
            confirmations=0,
        )
        db.add(dep)
        await db.commit()
        
        return CreateDepositResponse(
            deposit_id=str(deposit_id),
            invoice_id=str(invoice.get("id", "")),
            invoice_url=invoice.get("invoice_url"),
            pay_currency=currency,
            price_amount_usd=req.amount_usd,
            status="waiting",
            created_at=datetime.now(UTC).isoformat(),
        )
        
    except PaymentError as e:
        raise HTTPException(502, f"Payment processor error: {str(e)}")
    except Exception as e:
        logger.error(f"Invoice creation failed: {e}")
        raise HTTPException(500, "Failed to create deposit invoice")


@router.get("/deposit/{deposit_id}", response_model=PaymentStatusResponse)
async def get_deposit_status(
    deposit_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check status of a deposit"""
    try:
        dep_uuid = _UUID(deposit_id)
    except ValueError:
        raise HTTPException(400, "Invalid deposit ID")
    
    result = await db.execute(
        select(Deposit).where(
            Deposit.id == dep_uuid,
            Deposit.user_id == user.id,
        )
    )
    dep = result.scalar_one_or_none()
    if not dep:
        raise HTTPException(404, "Deposit not found")
    
    # Optionally check live status from NOWPayments
    payment_id = None
    actually_paid = None
    if dep.tx_hash and dep.tx_hash.isdigit():
        payment_id = int(dep.tx_hash)
        try:
            svc = get_payment_service()
            live = await svc.get_payment_status(payment_id)
            dep.status = live.get("payment_status", dep.status)
            actually_paid = str(live.get("actually_paid", "0"))
            await db.commit()
        except Exception:
            pass  # Use cached status
    
    cur_name = dep.currency.value.upper() if hasattr(dep.currency, "value") else str(dep.currency).upper()
    
    return PaymentStatusResponse(
        deposit_id=str(dep.id),
        payment_id=payment_id,
        status=dep.status,
        currency=cur_name,
        amount_usd=float(dep.amount),
        pay_amount=str(dep.amount),
        actually_paid=actually_paid,
        created_at=dep.created_at.isoformat() if dep.created_at else "",
    )


@router.get("/deposits")
async def list_deposits(
    status: Optional[str] = None,
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's deposits"""
    query = select(Deposit).where(Deposit.user_id == user.id)
    if status:
        query = query.where(Deposit.status == status)
    query = query.order_by(Deposit.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    deps = result.scalars().all()
    
    return {
        "deposits": [
            {
                "id": str(d.id),
                "currency": d.currency.value.upper() if hasattr(d.currency, "value") else str(d.currency).upper(),
                "amount": str(d.amount),
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else "",
            }
            for d in deps
        ]
    }


# ═══════════════════════════════════
# IPN Webhook (No auth — verified via HMAC)
# ═══════════════════════════════════

@router.post("/ipn/nowpayments")
async def nowpayments_ipn_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    IPN (Instant Payment Notification) webhook from NOWPayments.
    
    Called automatically when payment status changes.
    Verifies HMAC-SHA512 signature before processing.
    
    Key statuses:
    - finished → Credit user balance
    - partially_paid → Log, potentially credit partial
    - failed/expired → Mark as failed
    """
    body = await request.body()
    signature = request.headers.get("x-nowpayments-sig", "")
    
    svc = get_payment_service()
    
    # Verify signature
    if not svc.verify_ipn_signature(body, signature):
        logger.warning("IPN signature verification FAILED — possible tampering")
        raise HTTPException(403, "Invalid signature")
    
    # Parse callback
    raw_data = await request.json()
    parsed = svc.parse_ipn_callback(raw_data)
    
    logger.info(
        f"IPN received: payment_id={parsed['payment_id']}, "
        f"status={parsed['status']}, order_id={parsed['order_id']}"
    )
    
    order_id = parsed.get("order_id", "")
    payment_status = parsed.get("status", "")
    
    # Extract user_id and deposit_id from order_id format: "dep_{user_id}_{deposit_id}"
    parts = order_id.split("_", 2) if order_id else []
    if len(parts) < 3 or parts[0] != "dep":
        logger.error(f"Invalid order_id format: {order_id}")
        return {"status": "error", "message": "Invalid order_id"}
    
    try:
        user_id = _UUID(parts[1])
        deposit_id = _UUID(parts[2])
    except ValueError:
        logger.error(f"Cannot parse UUIDs from order_id: {order_id}")
        return {"status": "error", "message": "Invalid order_id"}
    
    # Find deposit record
    result = await db.execute(
        select(Deposit).where(Deposit.id == deposit_id)
    )
    dep = result.scalar_one_or_none()
    
    if not dep:
        logger.warning(f"Deposit not found: {deposit_id}")
        return {"status": "error", "message": "Deposit not found"}
    
    # Check if already processed
    if dep.status in ("finished", "completed", "credited"):
        logger.info(f"Deposit {deposit_id} already processed, skipping")
        return {"status": "ok", "message": "Already processed"}
    
    # Update deposit status
    old_status = dep.status
    dep.status = payment_status
    dep.tx_hash = str(parsed.get("payment_id", dep.tx_hash))
    
    # Credit balance on "finished" status
    if payment_status == "finished":
        amount_to_credit = parsed.get("actually_paid") or parsed.get("pay_amount", Decimal(0))
        
        if amount_to_credit > 0:
            try:
                cur_enum = Currency(parsed["currency"].lower())
            except ValueError:
                cur_enum = dep.currency
            
            ledger = LedgerService(db)
            
            try:
                await ledger.credit(
                    user_id=user_id,
                    currency=cur_enum,
                    amount=amount_to_credit,
                    event_type=LedgerEventType.DEPOSIT,
                    reference_type="deposit",
                    reference_id=deposit_id,
                    metadata={
                        "payment_id": parsed["payment_id"],
                        "pay_address": parsed.get("pay_address"),
                        "usd_value": str(parsed.get("price_amount_usd", 0)),
                        "source": "nowpayments",
                    },
                )
                dep.status = "credited"
                dep.amount = amount_to_credit
                
                logger.info(
                    f"✅ Deposit credited: {amount_to_credit} {parsed['currency']} "
                    f"to user {user_id} (deposit {deposit_id})"
                )
            except Exception as e:
                logger.error(f"Failed to credit deposit: {e}")
                dep.status = "credit_failed"
    
    elif payment_status == "partially_paid":
        logger.warning(
            f"Partial payment: expected {parsed.get('pay_amount')}, "
            f"got {parsed.get('actually_paid')}"
        )
    
    elif payment_status in ("failed", "expired", "refunded"):
        logger.info(f"Deposit {deposit_id} marked as {payment_status}")
    
    await db.commit()
    
    logger.info(f"IPN processed: {deposit_id} {old_status} → {dep.status}")
    return {"status": "ok"}


# ═══════════════════════════════════
# Payout (Withdrawal) via NOWPayments
# ═══════════════════════════════════

@router.post("/payout/{withdrawal_id}")
async def process_payout(
    withdrawal_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Process a pending withdrawal through NOWPayments payout API.
    
    Admin-only in production, but available for testing.
    """
    from casino.models import Withdrawal
    
    try:
        wid = _UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(400, "Invalid withdrawal ID")
    
    result = await db.execute(
        select(Withdrawal).where(Withdrawal.id == wid)
    )
    wd = result.scalar_one_or_none()
    
    if not wd:
        raise HTTPException(404, "Withdrawal not found")
    if wd.status != "pending":
        raise HTTPException(400, f"Withdrawal is {wd.status}, not pending")
    
    cur_name = wd.currency.value.upper() if hasattr(wd.currency, "value") else str(wd.currency).upper()
    
    svc = get_payment_service()
    
    try:
        payout = await svc.create_payout(
            amount=float(wd.amount),
            currency=cur_name,
            address=wd.to_address,
            withdrawal_id=str(wd.id),
        )
        
        wd.status = "processing"
        await db.commit()
        
        return {
            "success": True,
            "withdrawal_id": withdrawal_id,
            "status": "processing",
            "payout": payout,
        }
        
    except PaymentError as e:
        raise HTTPException(502, f"Payout failed: {str(e)}")
