"""
WebSocket routes for real-time game communication.
"""

import hashlib
import logging
from datetime import datetime, UTC
from uuid import uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy import select
from typing import Optional

from casino.websocket.manager import manager
from casino.websocket.crash_game import CrashGameManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# Initialize crash game manager
crash_game = CrashGameManager(manager)


async def _get_user_from_token(token: str) -> Optional[tuple]:
    """
    Validate a session token and return (user_id, username).
    Returns None if token is invalid or expired.
    """
    from casino.models.session import async_session_factory
    from casino.models import User, UserSession

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    async with async_session_factory() as db:
        result = await db.execute(
            select(UserSession).where(
                UserSession.refresh_token_hash == token_hash,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > datetime.now(UTC),
            )
        )
        session_row = result.scalar_one_or_none()

        if not session_row:
            return None

        user_result = await db.execute(
            select(User).where(User.id == session_row.user_id)
        )
        user = user_result.scalar_one_or_none()

        if not user:
            return None

        return (user.id, user.username)


@router.websocket("/crash")
async def crash_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for Crash game.

    Requires a valid session token as a query parameter.

    Messages from client:
    - {"type": "bet", "amount": "0.001", "auto_cashout": "2.0"}
    - {"type": "cashout"}

    Messages from server:
    - {"type": "round_start", ...}
    - {"type": "countdown", "countdown": 3}
    - {"type": "game_running"}
    - {"type": "multiplier", "multiplier": "1.50"}
    - {"type": "crashed", "crash_point": "2.34", ...}
    - {"type": "new_bet", "username": "...", "bet_amount": "..."}
    - {"type": "cashout", "username": "...", "multiplier": "...", "profit": "..."}
    """
    connection_id = str(uuid4())

    # Authenticate user via session token
    if not token:
        await websocket.close(code=4001, reason="Authentication required")
        return

    user_info = await _get_user_from_token(token)
    if not user_info:
        await websocket.close(code=4001, reason="Invalid or expired session")
        return

    user_id, username = user_info

    try:
        # Connect and join crash room
        await manager.connect(
            websocket=websocket,
            connection_id=connection_id,
            user_id=user_id,
            username=username,
        )
        await manager.join_room(connection_id, crash_game.ROOM_NAME)

        # Send current state
        await manager.send_personal(connection_id, {
            "type": "connected",
            "connection_id": connection_id,
            "username": username,
            "state": crash_game.get_state(),
            "history": crash_game.get_history(),
        })

        # Handle messages
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "bet":
                from decimal import Decimal
                from uuid import UUID

                amount = Decimal(data.get("amount", "0"))
                auto_cashout = data.get("auto_cashout")
                if auto_cashout:
                    auto_cashout = Decimal(auto_cashout)

                result = await crash_game.place_bet(
                    user_id=user_id,
                    username=username,
                    bet_amount=amount,
                    auto_cashout=auto_cashout,
                )

                await manager.send_personal(connection_id, {
                    "type": "bet_result",
                    **result,
                })

            elif msg_type == "cashout":
                from uuid import UUID

                if crash_game.current_round:
                    result = await crash_game.cashout(user_id)
                    await manager.send_personal(connection_id, {
                        "type": "cashout_result",
                        **result,
                    })

            elif msg_type == "ping":
                await manager.send_personal(connection_id, {"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        await manager.disconnect(connection_id)


@router.get("/crash/state")
async def get_crash_state():
    """Get current crash game state (HTTP fallback)."""
    return crash_game.get_state()


@router.get("/crash/history")
async def get_crash_history(limit: int = 20):
    """Get crash game history."""
    return crash_game.get_history(limit)


# Startup/shutdown hooks
async def start_crash_game():
    """Start the crash game on application startup."""
    await crash_game.start()


async def stop_crash_game():
    """Stop the crash game on application shutdown."""
    await crash_game.stop()
