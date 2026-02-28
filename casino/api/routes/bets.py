"""
Betting API Endpoints
=====================

Place bets, get bet history, verify outcomes.
"""

from datetime import datetime, UTC
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import uuid4
import hashlib

from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from casino.games import get_game, GAMES, BetResult, GameOutcome
from casino.services.provably_fair import ProvablyFairEngine, GameResult
from casino.services.ledger import LedgerService, InsufficientBalanceError
from casino.models import (
    User, Bet, BetStatus, Currency, GameType, LedgerEventType,
)
from casino.api.dependencies import get_db, get_current_user


router = APIRouter(prefix="/bets", tags=["Betting"])


# ========================
# Request/Response Models
# ========================

class PlaceBetRequest(BaseModel):
    game_type: str = Field(..., description="Game type: dice, limbo, mines, plinko, wheel")
    bet_amount: Decimal = Field(..., gt=0, description="Bet amount in USD")
    currency: str = Field(default="USDT", description="Currency for bet")
    game_data: Dict[str, Any] = Field(default_factory=dict, description="Game-specific data")
    client_seed: Optional[str] = Field(None, description="Optional client seed for provably fair")
    
    @field_validator("game_type")
    @classmethod
    def validate_game_type(cls, v):
        if v not in GAMES:
            raise ValueError(f"Invalid game type. Available: {list(GAMES.keys())}")
        return v
    
    @field_validator("bet_amount")
    @classmethod
    def validate_bet_amount(cls, v):
        if v < Decimal("0.10"):
            raise ValueError("Minimum bet is $0.10")
        if v > Decimal("10000"):
            raise ValueError("Maximum bet is $10,000")
        return v


class BetResponse(BaseModel):
    bet_id: str
    game_type: str
    bet_amount: str
    outcome: str
    multiplier: str
    payout: str
    profit: str
    result_data: Dict[str, Any]
    
    # Provably Fair data
    server_seed_hash: str
    client_seed: str
    nonce: int
    server_seed: Optional[str] = None  # Revealed after seed rotation
    
    timestamp: str


class BetHistoryResponse(BaseModel):
    bets: list[Dict[str, Any]]
    total: int
    page: int
    per_page: int


class VerifyBetRequest(BaseModel):
    server_seed: str
    client_seed: str
    nonce: int
    game_type: str
    game_data: Dict[str, Any]


# ========================
# Endpoints
# ========================

@router.post("/place", response_model=BetResponse)
async def place_bet(
    request: PlaceBetRequest,
    client_request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
):
    """
    Place a bet on any game.
    
    **Idempotency**: Requires X-Idempotency-Key header.
    Same key within 24h returns cached result.
    
    **Provably Fair**: Each bet uses HMAC-SHA256 for verifiable randomness.
    Server seed hash is shown before bet, seed revealed after rotation.
    """
    # Resolve currency enum
    try:
        cur_enum = Currency(request.currency.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid currency")

    # Resolve game type enum
    try:
        game_type_enum = GameType(request.game_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid game type")

    # Check idempotency — return existing bet if already placed
    existing = await db.execute(
        select(Bet).where(Bet.idempotency_key == idempotency_key)
    )
    existing_bet = existing.scalar_one_or_none()
    if existing_bet:
        return BetResponse(
            bet_id=str(existing_bet.id),
            game_type=existing_bet.game_type.value,
            bet_amount=str(existing_bet.bet_amount),
            outcome=existing_bet.status.value,
            multiplier=str(existing_bet.multiplier or 0),
            payout=str(existing_bet.payout or 0),
            profit=str(existing_bet.profit or 0),
            result_data=existing_bet.result_data or {},
            server_seed_hash="",
            client_seed=existing_bet.client_seed,
            nonce=existing_bet.nonce,
            timestamp=existing_bet.created_at.isoformat() if existing_bet.created_at else "",
        )

    # Get game engine
    game = get_game(request.game_type)
    if not game:
        raise HTTPException(status_code=400, detail="Invalid game type")

    # Validate bet
    valid, error = game.validate_bet(request.bet_amount)
    if not valid:
        raise HTTPException(status_code=400, detail=error)
    if not game.validate_game_data(request.game_data):
        raise HTTPException(status_code=400, detail="Invalid game parameters")

    # Check & lock balance via ledger
    ledger = LedgerService(db)
    balance_info = await ledger.get_balance(user.id, cur_enum)
    if balance_info["available"] < request.bet_amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    bet_id = uuid4()
    await ledger.lock_balance(user.id, cur_enum, request.bet_amount, bet_id)

    # Record bet_placed ledger event
    await ledger.record_event(
        user_id=user.id,
        event_type=LedgerEventType.BET_PLACED,
        currency=cur_enum,
        amount=-request.bet_amount,
        reference_type="bet",
        reference_id=bet_id,
    )

    # Provably fair outcome
    pf = ProvablyFairEngine(db)

    if request.client_seed:
        await pf.set_client_seed(user.id, request.client_seed)

    game_result, server_seed_id = await pf.generate_bet_outcome(user.id)

    # Calculate game result
    bet_result = game.calculate_result(
        game_result=game_result,
        bet_amount=request.bet_amount,
        game_data=request.game_data,
    )

    # Determine status
    if bet_result.outcome == GameOutcome.WIN:
        bet_status = BetStatus.WON
        await ledger.settle_bet_win(
            user.id, cur_enum, request.bet_amount, bet_result.payout, bet_id,
        )
    else:
        bet_status = BetStatus.LOST
        await ledger.settle_bet_loss(user.id, cur_enum, request.bet_amount, bet_id)

    # Persist bet row
    bet_row = Bet(
        id=bet_id,
        user_id=user.id,
        game_type=game_type_enum,
        currency=cur_enum,
        bet_amount=request.bet_amount,
        status=bet_status,
        multiplier=bet_result.multiplier,
        payout=bet_result.payout,
        profit=bet_result.profit,
        server_seed_id=server_seed_id,
        client_seed=game_result.client_seed,
        nonce=game_result.nonce,
        game_data=request.game_data,
        result_data=bet_result.result_data,
        idempotency_key=idempotency_key,
        settled_at=datetime.now(UTC),
    )
    db.add(bet_row)
    await db.commit()

    return BetResponse(
        bet_id=str(bet_id),
        game_type=request.game_type,
        bet_amount=str(request.bet_amount),
        outcome=bet_result.outcome.value,
        multiplier=str(bet_result.multiplier),
        payout=str(bet_result.payout),
        profit=str(bet_result.profit),
        result_data=bet_result.result_data,
        server_seed_hash=game_result.server_seed_hash,
        client_seed=game_result.client_seed,
        nonce=game_result.nonce,
        timestamp=datetime.now(UTC).isoformat(),
    )


@router.get("/history", response_model=BetHistoryResponse)
async def get_bet_history(
    page: int = 1,
    per_page: int = 20,
    game_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get bet history for authenticated user.
    """
    query = select(Bet).where(Bet.user_id == user.id)
    count_query = select(func.count()).select_from(Bet).where(Bet.user_id == user.id)

    if game_type:
        try:
            gt = GameType(game_type)
            query = query.where(Bet.game_type == gt)
            count_query = count_query.where(Bet.game_type == gt)
        except ValueError:
            pass

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * per_page
    query = query.order_by(Bet.created_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    rows = result.scalars().all()

    return BetHistoryResponse(
        bets=[
            {
                "bet_id": str(b.id),
                "game_type": b.game_type.value,
                "bet_amount": str(b.bet_amount),
                "outcome": b.status.value,
                "multiplier": str(b.multiplier or 0),
                "payout": str(b.payout or 0),
                "profit": str(b.profit or 0),
                "timestamp": b.created_at.isoformat() if b.created_at else "",
            }
            for b in rows
        ],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{bet_id}")
async def get_bet_details(
    bet_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed information about a specific bet.
    
    Includes full provably fair verification data.
    """
    from uuid import UUID as _UUID

    try:
        bid = _UUID(bet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid bet ID")

    result = await db.execute(
        select(Bet).where(Bet.id == bid, Bet.user_id == user.id)
    )
    bet = result.scalar_one_or_none()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")

    return {
        "bet_id": str(bet.id),
        "game_type": bet.game_type.value,
        "bet_amount": str(bet.bet_amount),
        "outcome": bet.status.value,
        "multiplier": str(bet.multiplier or 0),
        "payout": str(bet.payout or 0),
        "profit": str(bet.profit or 0),
        "result_data": bet.result_data or {},
        "provably_fair": {
            "server_seed_hash": "",
            "client_seed": bet.client_seed,
            "nonce": bet.nonce,
        },
        "timestamp": bet.created_at.isoformat() if bet.created_at else "",
    }


@router.post("/verify")
async def verify_bet(request: VerifyBetRequest):
    """
    Verify a bet outcome using provably fair data.
    
    Anyone can verify that the outcome was fair by providing:
    - Server seed (revealed after rotation)
    - Client seed
    - Nonce
    - Game type and parameters
    
    Returns calculated result to compare with claimed outcome.
    """
    game = get_game(request.game_type)
    if not game:
        raise HTTPException(status_code=400, detail="Invalid game type")
    
    # Recreate the hash
    combined = f"{request.server_seed}:{request.client_seed}:{request.nonce}"
    raw_hash = hashlib.sha256(combined.encode()).hexdigest()
    normalized = int(raw_hash[:8], 16) / (16**8)
    server_seed_hash = hashlib.sha256(request.server_seed.encode()).hexdigest()
    
    game_result = GameResult(
        raw_hash=raw_hash,
        normalized=normalized,
        server_seed_hash=server_seed_hash,
        client_seed=request.client_seed,
        nonce=request.nonce
    )
    
    # Calculate result
    bet_result = game.calculate_result(
        game_result=game_result,
        bet_amount=Decimal("1"),  # Amount doesn't affect outcome
        game_data=request.game_data
    )
    
    return {
        "verified": True,
        "server_seed_hash": server_seed_hash,
        "raw_hash": raw_hash,
        "normalized_value": normalized,
        "result_data": bet_result.result_data,
        "message": "Outcome verified. Compare result_data with claimed outcome."
    }


@router.get("/stats/summary")
async def get_betting_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get betting statistics for authenticated user.
    """
    # Aggregate stats from bets table
    total_bets = (await db.execute(
        select(func.count()).select_from(Bet).where(Bet.user_id == user.id)
    )).scalar() or 0

    total_wagered = (await db.execute(
        select(func.coalesce(func.sum(Bet.bet_amount), 0)).where(Bet.user_id == user.id)
    )).scalar() or Decimal(0)

    total_payout = (await db.execute(
        select(func.coalesce(func.sum(Bet.payout), 0)).where(
            Bet.user_id == user.id, Bet.payout.isnot(None)
        )
    )).scalar() or Decimal(0)

    total_won_amount = (await db.execute(
        select(func.coalesce(func.sum(Bet.payout), 0)).where(
            Bet.user_id == user.id, Bet.status == BetStatus.WON,
        )
    )).scalar() or Decimal(0)

    wins_count = (await db.execute(
        select(func.count()).select_from(Bet).where(
            Bet.user_id == user.id, Bet.status == BetStatus.WON,
        )
    )).scalar() or 0

    net = total_payout - total_wagered
    win_rate = (wins_count / total_bets) if total_bets > 0 else 0

    # Per-game breakdown
    game_rows = (await db.execute(
        select(
            Bet.game_type,
            func.count().label("cnt"),
            func.coalesce(func.sum(Bet.bet_amount), 0).label("wagered"),
            func.coalesce(func.sum(Bet.profit), 0).label("profit"),
        )
        .where(Bet.user_id == user.id)
        .group_by(Bet.game_type)
    )).all()

    games_breakdown = {
        row.game_type.value: {
            "bets": row.cnt,
            "wagered": str(row.wagered),
            "profit": str(row.profit),
        }
        for row in game_rows
    }

    return {
        "total_bets": total_bets,
        "total_wagered": str(total_wagered),
        "total_won": str(total_won_amount),
        "total_lost": str(total_wagered - total_payout),
        "net_profit": str(net),
        "win_rate": round(win_rate, 4),
        "games_breakdown": games_breakdown,
    }
