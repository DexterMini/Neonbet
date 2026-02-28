"""
WebSocket routes for real-time game communication.
"""

import logging
from uuid import uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional

from casino.websocket.manager import manager
from casino.websocket.crash_game import CrashGameManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])

# Initialize crash game manager
crash_game = CrashGameManager(manager)


@router.websocket("/crash")
async def crash_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for Crash game.
    
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
    
    # TODO: Validate token and get user info
    # For now, allow anonymous connections
    user_id = None
    username = f"Guest_{connection_id[:8]}"
    
    try:
        # Connect and join crash room
        client = await manager.connect(
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
                # Place bet
                from decimal import Decimal
                from uuid import UUID
                
                amount = Decimal(data.get("amount", "0"))
                auto_cashout = data.get("auto_cashout")
                if auto_cashout:
                    auto_cashout = Decimal(auto_cashout)
                
                # For demo, use random UUID if not authenticated
                bet_user_id = user_id or uuid4()
                
                result = await crash_game.place_bet(
                    user_id=bet_user_id,
                    username=username,
                    bet_amount=amount,
                    auto_cashout=auto_cashout,
                )
                
                await manager.send_personal(connection_id, {
                    "type": "bet_result",
                    **result,
                })
            
            elif msg_type == "cashout":
                # Manual cashout
                from uuid import UUID
                
                # For demo, try to find player by username
                if crash_game.current_round:
                    for uid, player in crash_game.current_round.players.items():
                        if player.username == username:
                            result = await crash_game.cashout(UUID(uid))
                            await manager.send_personal(connection_id, {
                                "type": "cashout_result",
                                **result,
                            })
                            break
            
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
