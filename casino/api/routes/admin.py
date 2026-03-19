"""
Admin API Endpoints
===================

Administrative functions for risk management, user management, and system monitoring.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Optional, Dict, List, Any
from uuid import uuid4, UUID as _UUID

from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import (
    User, UserStatus, UserBalance, Bet, BetStatus,
    Deposit, Withdrawal, LedgerEventType,
    AdminAction, SystemAlert, kyc_level_to_int,
)
from casino.api.dependencies import get_db, get_current_user, require_admin
from casino.services.ledger import LedgerService


router = APIRouter(prefix="/admin", tags=["Admin"])


# ========================
# Request/Response Models
# ========================

class UserSearchResponse(BaseModel):
    user_id: str
    username: str
    email: str
    status: str
    kyc_level: int
    vip_level: int
    created_at: str
    total_wagered: str
    net_profit: str
    risk_score: int


class RiskAlertResponse(BaseModel):
    alert_id: str
    user_id: str
    username: str
    alert_type: str
    risk_level: str
    description: str
    action_taken: str
    created_at: str
    resolved: bool


class SystemStatsResponse(BaseModel):
    active_users_24h: int
    total_bets_24h: int
    total_wagered_24h: str
    gross_gaming_revenue_24h: str
    deposits_24h: str
    withdrawals_24h: str
    pending_withdrawals: int
    unresolved_alerts: int


class UserActionRequest(BaseModel):
    user_id: str
    action: str  # freeze, unfreeze, limit, unlimit, ban, unban
    reason: str
    duration_hours: Optional[int] = None


class ManualAdjustmentRequest(BaseModel):
    user_id: str
    currency: str
    amount: Decimal
    type: str  # credit, debit
    reason: str


class GameSettingsResponse(BaseModel):
    game_type: str
    house_edge: str
    rtp: str  # Return to Player (100 - house_edge)
    description: Optional[str]
    updated_by: Optional[str]
    updated_at: str


class UpdateGameRTPRequest(BaseModel):
    house_edge: Decimal = Field(..., ge=Decimal("0"), le=Decimal("1"), decimal_places=4)
    description: Optional[str] = None


# ========================
# User Management
# ========================

@router.get("/users/search")
async def search_users(
    query: Optional[str] = None,
    status: Optional[str] = None,
    min_risk_score: Optional[int] = None,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Search users by username, email, or ID.
    """
    stmt = select(User)
    if query:
        stmt = stmt.where(
            or_(
                User.username.ilike(f"%{query}%"),
                User.email.ilike(f"%{query}%"),
            )
        )
    if status:
        try:
            st = UserStatus(status)
            stmt = stmt.where(User.status == st)
        except ValueError:
            pass
    if min_risk_score is not None:
        stmt = stmt.where(User.risk_score >= min_risk_score)

    stmt = stmt.order_by(User.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "users": [
            {
                "user_id": str(u.id),
                "username": u.username,
                "email": u.email,
                "status": u.status.value if hasattr(u.status, "value") else str(u.status),
                "kyc_level": kyc_level_to_int(u.kyc_level),
                "vip_level": u.vip_level,
                "created_at": u.created_at.isoformat() if u.created_at else "",
                "risk_score": float(u.risk_score) if u.risk_score else 0,
            }
            for u in rows
        ],
        "total": len(rows),
    }


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed user information.
    """
    try:
        uid = _UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db.execute(select(User).where(User.id == uid))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Balances
    bal_result = await db.execute(
        select(UserBalance).where(UserBalance.user_id == uid)
    )
    bal_rows = bal_result.scalars().all()
    balances = {
        (b.currency.value.upper() if hasattr(b.currency, "value") else str(b.currency).upper()): str(b.available)
        for b in bal_rows
    }

    # Bet count
    bet_count = (await db.execute(
        select(func.count()).select_from(Bet).where(Bet.user_id == uid)
    )).scalar() or 0

    return {
        "user_id": str(target.id),
        "username": target.username,
        "email": target.email,
        "status": target.status.value if hasattr(target.status, "value") else str(target.status),
        "kyc_level": kyc_level_to_int(target.kyc_level),
        "vip_level": target.vip_level,
        "created_at": target.created_at.isoformat() if target.created_at else "",
        "last_active": target.last_login_at.isoformat() if target.last_login_at else "",
        "balances": balances,
        "stats": {"total_bets": bet_count},
        "risk": {
            "score": float(target.risk_score) if target.risk_score else 0,
            "level": "low",
        },
    }


@router.post("/users/action")
async def user_action(
    request: UserActionRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Take action on a user account.
    """
    valid_actions = ["freeze", "unfreeze", "limit", "unlimit", "ban", "unban", "force_2fa", "reset_password"]
    if request.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Valid: {valid_actions}")

    try:
        uid = _UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db.execute(select(User).where(User.id == uid))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    status_map = {
        "freeze": UserStatus.FROZEN,
        "ban": UserStatus.BANNED,
        "unfreeze": UserStatus.ACTIVE,
        "unban": UserStatus.ACTIVE,
    }
    if request.action in status_map:
        target.status = status_map[request.action]

    # Audit log
    db.add(AdminAction(
        admin_id=admin.id,
        action_type=request.action,
        target_type="user",
        target_id=uid,
        details={"reason": request.reason},
        ip_address="system",
    ))
    await db.commit()

    return {
        "success": True,
        "user_id": request.user_id,
        "action": request.action,
        "performed_by": str(admin.id),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.post("/users/adjust-balance")
async def adjust_balance(
    request: ManualAdjustmentRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually adjust user balance.
    """
    try:
        uid = _UUID(request.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    from casino.models import Currency
    try:
        cur = Currency(request.currency.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid currency")

    ledger = LedgerService(db)
    if request.type == "credit":
        await ledger.credit(
            user_id=uid, currency=cur, amount=abs(request.amount),
            event_type=LedgerEventType.ADMIN_ADJUSTMENT,
            metadata={"reason": request.reason, "admin": str(admin.id)},
        )
    elif request.type == "debit":
        await ledger.debit(
            user_id=uid, currency=cur, amount=abs(request.amount),
            event_type=LedgerEventType.ADMIN_ADJUSTMENT,
            metadata={"reason": request.reason, "admin": str(admin.id)},
        )
    else:
        raise HTTPException(status_code=400, detail="Type must be 'credit' or 'debit'")

    db.add(AdminAction(
        admin_id=admin.id,
        action_type="adjust_balance",
        target_type="user",
        target_id=uid,
        details={"type": request.type, "amount": str(request.amount), "currency": request.currency, "reason": request.reason},
        ip_address="system",
    ))
    await db.commit()

    return {
        "success": True,
        "user_id": request.user_id,
        "type": request.type,
        "amount": str(request.amount),
        "currency": request.currency,
        "reason": request.reason,
        "performed_by": str(admin.id),
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ========================
# Risk Management
# ========================

@router.get("/risk/alerts")
async def get_risk_alerts(
    status: str = "unresolved",
    risk_level: Optional[str] = None,
    alert_type: Optional[str] = None,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get risk alerts requiring review.
    """
    query = select(SystemAlert)
    if status == "unresolved":
        query = query.where(SystemAlert.acknowledged == False)
    elif status == "resolved":
        query = query.where(SystemAlert.acknowledged == True)
    if risk_level:
        query = query.where(SystemAlert.severity == risk_level)
    if alert_type:
        query = query.where(SystemAlert.alert_type == alert_type)
    query = query.order_by(SystemAlert.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "alerts": [
            {
                "alert_id": str(a.id),
                "alert_type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "acknowledged": a.acknowledged,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in rows
        ],
        "total": len(rows),
    }


@router.post("/risk/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    action: str,
    notes: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Resolve a risk alert.
    """
    try:
        aid = int(alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    result = await db.execute(select(SystemAlert).where(SystemAlert.id == aid))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = admin.id
    alert.acknowledged_at = datetime.now(UTC)
    await db.commit()

    return {
        "success": True,
        "alert_id": alert_id,
        "action": action,
        "resolved_by": str(admin.id),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.get("/risk/score/{user_id}")
async def get_user_risk_score(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed risk score for user.
    """
    try:
        uid = _UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    result = await db.execute(select(User).where(User.id == uid))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    score = float(target.risk_score) if target.risk_score else 0
    level = "low" if score < 0.3 else "medium" if score < 0.6 else "high" if score < 0.8 else "critical"

    return {
        "user_id": user_id,
        "score": score,
        "level": level,
        "factors": {},
        "alerts_count": 0,
        "last_calculated": datetime.now(UTC).isoformat(),
    }


# ========================
# Withdrawals
# ========================

@router.get("/withdrawals/pending")
async def get_pending_withdrawals(
    min_amount: Optional[Decimal] = None,
    flagged_only: bool = False,
    limit: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get pending withdrawals requiring review.
    """
    query = select(Withdrawal).where(Withdrawal.status == "pending")
    if min_amount is not None:
        query = query.where(Withdrawal.amount >= min_amount)
    query = query.order_by(Withdrawal.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "withdrawals": [
            {
                "id": str(w.id),
                "user_id": str(w.user_id),
                "currency": w.currency.value.upper() if hasattr(w.currency, "value") else str(w.currency).upper(),
                "amount": str(w.amount),
                "to_address": w.to_address,
                "created_at": w.created_at.isoformat() if w.created_at else "",
            }
            for w in rows
        ],
        "total": len(rows),
        "total_amount_usd": "0.00",
    }


@router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(
    withdrawal_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Approve a pending withdrawal.
    """
    try:
        wid = _UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal ID")

    result = await db.execute(select(Withdrawal).where(Withdrawal.id == wid))
    wd = result.scalar_one_or_none()
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    wd.status = "approved"
    wd.approved_by = admin.id
    wd.approved_at = datetime.now(UTC)
    await db.commit()

    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "approved_by": str(admin.id),
        "timestamp": datetime.now(UTC).isoformat(),
    }


@router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(
    withdrawal_id: str,
    reason: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Reject a pending withdrawal. Funds returned.
    """
    try:
        wid = _UUID(withdrawal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid withdrawal ID")

    result = await db.execute(select(Withdrawal).where(Withdrawal.id == wid))
    wd = result.scalar_one_or_none()
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found")

    wd.status = "rejected"
    wd.rejection_reason = reason

    # Return funds
    from casino.models import Currency as CurrencyEnum
    cur = wd.currency if isinstance(wd.currency, CurrencyEnum) else CurrencyEnum(str(wd.currency).lower())
    ledger = LedgerService(db)
    await ledger.credit(
        user_id=wd.user_id, currency=cur, amount=wd.amount + wd.fee,
        event_type=LedgerEventType.WITHDRAWAL_CANCELLED,
        reference_type="withdrawal", reference_id=wd.id,
    )
    await db.commit()

    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "rejected_by": str(admin.id),
        "reason": reason,
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ========================
# System Stats
# ========================

@router.get("/stats/overview", response_model=SystemStatsResponse)
async def get_system_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get system-wide statistics.
    """
    cutoff = datetime.now(UTC) - timedelta(hours=24)

    active_users = (await db.execute(
        select(func.count(func.distinct(Bet.user_id))).where(Bet.created_at >= cutoff)
    )).scalar() or 0

    total_bets = (await db.execute(
        select(func.count()).select_from(Bet).where(Bet.created_at >= cutoff)
    )).scalar() or 0

    total_wagered = (await db.execute(
        select(func.coalesce(func.sum(Bet.bet_amount), 0)).where(Bet.created_at >= cutoff)
    )).scalar() or 0

    total_payout = (await db.execute(
        select(func.coalesce(func.sum(Bet.payout), 0)).where(
            Bet.created_at >= cutoff, Bet.payout.isnot(None)
        )
    )).scalar() or 0

    pending_wd = (await db.execute(
        select(func.count()).select_from(Withdrawal).where(Withdrawal.status == "pending")
    )).scalar() or 0

    unresolved = (await db.execute(
        select(func.count()).select_from(SystemAlert).where(SystemAlert.acknowledged == False)
    )).scalar() or 0

    return SystemStatsResponse(
        active_users_24h=active_users,
        total_bets_24h=total_bets,
        total_wagered_24h=str(total_wagered),
        gross_gaming_revenue_24h=str(Decimal(str(total_wagered)) - Decimal(str(total_payout))),
        deposits_24h="0.00",
        withdrawals_24h="0.00",
        pending_withdrawals=pending_wd,
        unresolved_alerts=unresolved,
    )


@router.get("/stats/games")
async def get_game_stats(
    period: str = "24h",
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get per-game statistics.
    """
    hours = {"24h": 24, "7d": 168, "30d": 720}.get(period, 24)
    cutoff = datetime.now(UTC) - timedelta(hours=hours)

    rows = (await db.execute(
        select(
            Bet.game_type,
            func.count().label("cnt"),
            func.coalesce(func.sum(Bet.bet_amount), 0).label("wagered"),
            func.coalesce(func.sum(Bet.payout), 0).label("payout"),
        )
        .where(Bet.created_at >= cutoff)
        .group_by(Bet.game_type)
    )).all()

    games = {}
    for r in rows:
        games[r.game_type.value] = {
            "total_bets": r.cnt,
            "total_wagered": str(r.wagered),
            "gross_revenue": str(Decimal(str(r.wagered)) - Decimal(str(r.payout))),
        }

    return {"period": period, "games": games}


@router.get("/stats/revenue")
async def get_revenue_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get revenue breakdown.
    """
    total_wagered = (await db.execute(
        select(func.coalesce(func.sum(Bet.bet_amount), 0))
    )).scalar() or 0
    total_payouts = (await db.execute(
        select(func.coalesce(func.sum(Bet.payout), 0)).where(Bet.payout.isnot(None))
    )).scalar() or 0

    ggr = Decimal(str(total_wagered)) - Decimal(str(total_payouts))

    return {
        "total_wagered": str(total_wagered),
        "total_payouts": str(total_payouts),
        "gross_gaming_revenue": str(ggr),
        "net_gaming_revenue": str(ggr),
        "by_game": {},
        "by_currency": {},
    }


# ========================
# Audit Log
# ========================

@router.get("/audit-log")
async def get_audit_log(
    admin_id: Optional[str] = None,
    action_type: Optional[str] = None,
    target_user: Optional[str] = None,
    limit: int = 100,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get admin action audit log.
    """
    query = select(AdminAction)
    if admin_id:
        try:
            query = query.where(AdminAction.admin_id == _UUID(admin_id))
        except ValueError:
            pass
    if action_type:
        query = query.where(AdminAction.action_type == action_type)
    if target_user:
        try:
            query = query.where(AdminAction.target_id == _UUID(target_user))
        except ValueError:
            pass
    query = query.order_by(AdminAction.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.scalars().all()

    return {
        "actions": [
            {
                "id": a.id,
                "admin_id": str(a.admin_id),
                "action_type": a.action_type,
                "target_type": a.target_type,
                "target_id": str(a.target_id) if a.target_id else None,
                "created_at": a.created_at.isoformat() if a.created_at else "",
            }
            for a in rows
        ],
        "total": len(rows),
    }


# ========================
# Game Settings & RTP
# ========================

@router.get("/games/settings", response_model=List[GameSettingsResponse])
async def get_game_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all game RTP/house edge settings.
    """
    from casino.models import GameSettings
    
    result = await db.execute(select(GameSettings).order_by(GameSettings.game_type))
    games = result.scalars().all()
    
    response = []
    for game in games:
        rtp = Decimal("100") - (Decimal(str(game.house_edge)) * Decimal("100"))
        response.append(GameSettingsResponse(
            game_type=game.game_type.value,
            house_edge=f"{float(game.house_edge)*100:.2f}%",
            rtp=f"{float(rtp):.2f}%",
            description=game.description,
            updated_by=str(game.updated_by) if game.updated_by else None,
            updated_at=game.updated_at.isoformat() if game.updated_at else "",
        ))
    
    return response


@router.get("/games/settings/{game_type}", response_model=GameSettingsResponse)
async def get_game_settings_by_type(
    game_type: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get RTP/house edge for a specific game.
    """
    from casino.models import GameSettings, GameType
    
    try:
        gt = GameType(game_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid game type: {game_type}")
    
    result = await db.execute(select(GameSettings).where(GameSettings.game_type == gt))
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(status_code=404, detail=f"Settings not found for game: {game_type}")
    
    rtp = Decimal("100") - (Decimal(str(game.house_edge)) * Decimal("100"))
    return GameSettingsResponse(
        game_type=game.game_type.value,
        house_edge=f"{float(game.house_edge)*100:.2f}%",
        rtp=f"{float(rtp):.2f}%",
        description=game.description,
        updated_by=str(game.updated_by) if game.updated_by else None,
        updated_at=game.updated_at.isoformat() if game.updated_at else "",
    )


@router.post("/games/settings/{game_type}")
async def update_game_rtp(
    game_type: str,
    request: UpdateGameRTPRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update RTP/house edge for a specific game.
    House edge should be between 0.00 (0%) and 1.00 (100%) in decimal format.
    Example: 0.05 = 5% house edge = 95% RTP
    """
    from casino.models import GameSettings, GameType
    
    try:
        gt = GameType(game_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid game type: {game_type}")
    
    result = await db.execute(select(GameSettings).where(GameSettings.game_type == gt))
    game = result.scalar_one_or_none()
    
    if not game:
        raise HTTPException(status_code=404, detail=f"Settings not found for game: {game_type}")
    
    # Update settings
    old_house_edge = game.house_edge
    game.house_edge = request.house_edge
    game.description = request.description or game.description
    game.updated_by = admin.id
    game.updated_at = datetime.now(UTC)
    
    # Audit log
    db.add(AdminAction(
        admin_id=admin.id,
        action_type="update_game_rtp",
        target_type="game",
        target_id=None,
        details={
            "game_type": game_type,
            "old_house_edge": str(old_house_edge),
            "new_house_edge": str(request.house_edge),
            "description": request.description,
        },
        ip_address="system",
    ))
    
    await db.commit()
    
    rtp = Decimal("100") - (Decimal(str(game.house_edge)) * Decimal("100"))
    return {
        "success": True,
        "game_type": game_type,
        "house_edge": f"{float(game.house_edge)*100:.2f}%",
        "rtp": f"{float(rtp):.2f}%",
        "updated_by": str(admin.id),
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ========================
# Admin Grant / Revoke
# ========================
# ========================

class AdminRoleRequest(BaseModel):
    user_id: str
    reason: str = ""


@router.post("/grant-admin")
async def grant_admin(
    body: AdminRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Grant admin privileges to a user. Only existing admins can do this."""
    try:
        target_id = _UUID(body.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    result = await db.execute(select(User).where(User.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.is_admin:
        return {"message": f"{target.username} is already an admin"}

    target.is_admin = True

    db.add(AdminAction(
        admin_id=admin.id,
        action_type="grant_admin",
        target_type="user",
        target_id=target.id,
        details={"reason": body.reason},
    ))
    await db.commit()

    return {"message": f"Admin granted to {target.username}"}


@router.post("/revoke-admin")
async def revoke_admin(
    body: AdminRoleRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Revoke admin privileges from a user. Only existing admins can do this."""
    try:
        target_id = _UUID(body.user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")

    if str(admin.id) == body.user_id:
        raise HTTPException(status_code=400, detail="Cannot revoke your own admin privileges")

    result = await db.execute(select(User).where(User.id == target_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if not target.is_admin:
        return {"message": f"{target.username} is not an admin"}

    target.is_admin = False

    db.add(AdminAction(
        admin_id=admin.id,
        action_type="revoke_admin",
        target_type="user",
        target_id=target.id,
        details={"reason": body.reason},
    ))
    await db.commit()

    return {"message": f"Admin revoked from {target.username}"}


@router.get("/check-admin")
async def check_admin(
    user: User = Depends(get_current_user),
):
    """Check if the current user has admin privileges. No 403 — just returns the flag."""
    return {"is_admin": getattr(user, 'is_admin', False)}
