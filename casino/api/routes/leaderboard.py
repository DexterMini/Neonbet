"""
Leaderboard API Endpoints
=========================

Real leaderboard data from bet history.
"""

from datetime import datetime, timedelta, UTC

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, desc
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models import User, Bet, BetStatus
from casino.api.dependencies import get_db

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


def _period_start(period: str) -> datetime:
    now = datetime.now(UTC)
    if period == "daily":
        return now - timedelta(days=1)
    elif period == "weekly":
        return now - timedelta(weeks=1)
    elif period == "monthly":
        return now - timedelta(days=30)
    else:  # all-time
        return datetime(2020, 1, 1, tzinfo=UTC)


@router.get("/top")
async def get_leaderboard(
    period: str = Query("weekly", pattern="^(daily|weekly|monthly|all)$"),
    sort: str = Query("wagered", pattern="^(wagered|profit|wins)$"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get top players leaderboard."""
    start = _period_start(period)

    # Build aggregation query on settled bets
    base = (
        select(
            Bet.user_id,
            func.sum(Bet.bet_amount).label("total_wagered"),
            func.sum(Bet.profit).label("total_profit"),
            func.count(case((Bet.profit > 0, 1))).label("total_wins"),
            func.count(Bet.id).label("total_bets"),
        )
        .where(
            Bet.status.in_([BetStatus.WON, BetStatus.LOST]),
            Bet.created_at >= start,
        )
        .group_by(Bet.user_id)
    )

    # Sort
    if sort == "wagered":
        base = base.order_by(desc("total_wagered"))
    elif sort == "profit":
        base = base.order_by(desc("total_profit"))
    else:
        base = base.order_by(desc("total_wins"))

    base = base.limit(limit)

    result = await db.execute(base)
    rows = result.all()

    if not rows:
        return {"period": period, "sort": sort, "players": []}

    # Fetch usernames
    user_ids = [r.user_id for r in rows]
    users_result = await db.execute(
        select(User.id, User.username, User.vip_level).where(User.id.in_(user_ids))
    )
    user_map = {u.id: {"username": u.username, "vip_level": u.vip_level} for u in users_result.all()}

    players = []
    for rank, row in enumerate(rows, 1):
        info = user_map.get(row.user_id, {"username": "Unknown", "vip_level": 0})
        players.append({
            "rank": rank,
            "username": info["username"],
            "vip_level": info["vip_level"],
            "wagered": float(row.total_wagered or 0),
            "profit": float(row.total_profit or 0),
            "wins": int(row.total_wins or 0),
            "bets": int(row.total_bets or 0),
        })

    return {"period": period, "sort": sort, "players": players}
