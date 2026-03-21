"""
Crash Game Manager - Real-time multiplayer crash game with WebSocket support.
"""

import asyncio
import logging
import math
import secrets
import hashlib
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID, uuid4
from decimal import Decimal
from enum import Enum

from .manager import ConnectionManager

logger = logging.getLogger(__name__)


async def _get_db_session():
    """Get a new async DB session for ledger operations."""
    from casino.models.session import async_session_factory
    return async_session_factory()


class GameState(str, Enum):
    WAITING = "waiting"
    STARTING = "starting"
    RUNNING = "running"
    CRASHED = "crashed"


@dataclass
class PlayerBet:
    """Represents a player's bet in a crash round."""
    user_id: UUID
    username: str
    bet_amount: Decimal
    currency: str = "BTC"
    auto_cashout: Optional[Decimal] = None
    cashed_out: bool = False
    cashout_multiplier: Optional[Decimal] = None
    profit: Optional[Decimal] = None


@dataclass
class CrashRound:
    """Represents a single crash game round."""
    round_id: UUID = field(default_factory=uuid4)
    server_seed: str = field(default_factory=lambda: secrets.token_hex(32))
    state: GameState = GameState.WAITING
    crash_point: Optional[Decimal] = None
    current_multiplier: Decimal = Decimal("1.00")
    players: Dict[str, PlayerBet] = field(default_factory=dict)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    hash: str = ""
    
    def __post_init__(self):
        self.hash = hashlib.sha256(self.server_seed.encode()).hexdigest()


class CrashGameManager:
    """
    Manages the Crash game state and logic.
    
    Game Flow:
    1. WAITING: Players can place bets (5-10 seconds)
    2. STARTING: Countdown to game start (3 seconds)
    3. RUNNING: Multiplier increases until crash
    4. CRASHED: Round ends, winnings calculated
    
    Provably Fair:
    - Server seed is hashed before round starts
    - Crash point derived from server seed
    - Players can verify after round ends
    """
    
    ROOM_NAME = "crash"
    WAITING_TIME = 7.0  # seconds
    STARTING_COUNTDOWN = 3  # seconds
    TICK_RATE = 0.05  # 20 updates per second
    HOUSE_EDGE = Decimal("0.01")  # 1%
    
    def __init__(self, connection_manager: ConnectionManager):
        self.manager = connection_manager
        self.current_round: Optional[CrashRound] = None
        self.history: List[dict] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None
    
    def _calculate_crash_point(self, server_seed: str) -> Decimal:
        """
        Calculate the crash point from server seed.
        Uses exponential distribution with house edge.
        """
        # Use first 52 bits of hash
        hash_bytes = hashlib.sha256(server_seed.encode()).digest()
        h = int.from_bytes(hash_bytes[:8], 'big')
        
        # Convert to crash point with house edge
        e = 2 ** 52
        house_edge_int = int(e * float(self.HOUSE_EDGE))
        
        if h % 33 == 0:
            # Instant crash (1.00x) ~3% of the time
            return Decimal("1.00")
        
        # Exponential distribution
        result = (100 * e - h) / (e - h)
        result = max(1.0, result / 100)
        
        return Decimal(str(round(result, 2)))
    
    async def start(self):
        """Start the crash game loop."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._game_loop())
        logger.info("Crash game manager started")
    
    async def stop(self):
        """Stop the crash game loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Crash game manager stopped")
    
    async def _game_loop(self):
        """Main game loop."""
        while self._running:
            try:
                # Create new round
                self.current_round = CrashRound()
                self.current_round.crash_point = self._calculate_crash_point(
                    self.current_round.server_seed
                )
                
                # WAITING phase
                await self._waiting_phase()
                
                # STARTING phase
                await self._starting_phase()
                
                # RUNNING phase
                await self._running_phase()
                
                # CRASHED phase
                await self._crashed_phase()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in crash game loop: {e}")
                await asyncio.sleep(5)
    
    async def _waiting_phase(self):
        """Waiting phase - players can place bets."""
        self.current_round.state = GameState.WAITING
        
        await self._broadcast({
            "type": "round_start",
            "round_id": str(self.current_round.round_id),
            "hash": self.current_round.hash,
            "state": GameState.WAITING.value,
            "wait_time": self.WAITING_TIME,
        })
        
        await asyncio.sleep(self.WAITING_TIME)
    
    async def _starting_phase(self):
        """Starting phase - countdown before multiplier starts."""
        self.current_round.state = GameState.STARTING
        
        for countdown in range(self.STARTING_COUNTDOWN, 0, -1):
            await self._broadcast({
                "type": "countdown",
                "countdown": countdown,
            })
            await asyncio.sleep(1)
    
    async def _running_phase(self):
        """Running phase - multiplier increases until crash."""
        self.current_round.state = GameState.RUNNING
        self.current_round.start_time = datetime.utcnow()
        self.current_round.current_multiplier = Decimal("1.00")
        
        await self._broadcast({
            "type": "game_running",
            "state": GameState.RUNNING.value,
        })
        
        start_time = asyncio.get_event_loop().time()
        
        while self._running:
            elapsed = asyncio.get_event_loop().time() - start_time
            
            # Multiplier formula: e^(0.06 * t)
            # Reaches 2x at ~11.5s, 3x at ~18.3s, 10x at ~38.4s
            new_multiplier = Decimal(str(round(math.exp(0.06 * elapsed), 2)))
            self.current_round.current_multiplier = new_multiplier
            
            # Check for auto-cashouts
            await self._process_auto_cashouts(new_multiplier)
            
            # Check if crashed
            if new_multiplier >= self.current_round.crash_point:
                break
            
            # Broadcast multiplier update
            await self._broadcast({
                "type": "multiplier",
                "multiplier": str(new_multiplier),
                "elapsed": round(elapsed, 2),
            })
            
            await asyncio.sleep(self.TICK_RATE)
    
    async def _crashed_phase(self):
        """Crashed phase - calculate winnings and prepare for next round."""
        self.current_round.state = GameState.CRASHED
        self.current_round.end_time = datetime.utcnow()
        self.current_round.current_multiplier = self.current_round.crash_point
        
        # Process remaining players (losers)
        for player in self.current_round.players.values():
            if not player.cashed_out:
                player.profit = -player.bet_amount
        
        # Add to history
        self.history.insert(0, {
            "round_id": str(self.current_round.round_id),
            "crash_point": str(self.current_round.crash_point),
            "hash": self.current_round.hash,
            "server_seed": self.current_round.server_seed,
            "player_count": len(self.current_round.players),
            "timestamp": self.current_round.end_time.isoformat(),
        })
        self.history = self.history[:100]  # Keep last 100 rounds
        
        # Broadcast crash
        await self._broadcast({
            "type": "crashed",
            "crash_point": str(self.current_round.crash_point),
            "server_seed": self.current_round.server_seed,
            "hash": self.current_round.hash,
            "results": [
                {
                    "username": p.username,
                    "bet": str(p.bet_amount),
                    "cashed_out": p.cashed_out,
                    "multiplier": str(p.cashout_multiplier) if p.cashed_out else None,
                    "profit": str(p.profit) if p.profit else None,
                }
                for p in self.current_round.players.values()
            ],
        })
        
        # Wait before next round
        await asyncio.sleep(3)
    
    async def _process_auto_cashouts(self, current_multiplier: Decimal):
        """Process automatic cashouts for players."""
        for user_id, player in self.current_round.players.items():
            if player.cashed_out:
                continue
            
            if player.auto_cashout and current_multiplier >= player.auto_cashout:
                await self._cashout_player(user_id, player.auto_cashout)
    
    async def place_bet(
        self,
        user_id: UUID,
        username: str,
        bet_amount: Decimal,
        auto_cashout: Optional[Decimal] = None,
        currency: str = "BTC"
    ) -> dict:
        """Place a bet in the current round."""
        if not self.current_round:
            return {"success": False, "error": "No active round"}
        
        if self.current_round.state != GameState.WAITING:
            return {"success": False, "error": "Betting closed"}
        
        if str(user_id) in self.current_round.players:
            return {"success": False, "error": "Already placed bet"}
        
        player = PlayerBet(
            user_id=user_id,
            username=username,
            bet_amount=bet_amount,
            currency=currency,
            auto_cashout=auto_cashout,
        )
        
        # Debit balance via ledger
        try:
            from casino.services.ledger import LedgerService, InsufficientBalanceError
            from casino.models import Currency, LedgerEventType
            async with await _get_db_session() as db:
                ledger = LedgerService(db)
                cur_enum = Currency(currency.lower())
                balance_info = await ledger.get_balance(user_id, cur_enum)
                if balance_info["available"] < bet_amount:
                    return {"success": False, "error": "Insufficient balance"}
                await ledger.debit(
                    user_id=user_id,
                    currency=cur_enum,
                    amount=bet_amount,
                    event_type=LedgerEventType.BET_PLACED,
                    reference_type="crash_bet",
                    reference_id=self.current_round.round_id,
                    metadata={"game": "crash", "round_id": str(self.current_round.round_id)},
                )
                await db.commit()
        except InsufficientBalanceError:
            return {"success": False, "error": "Insufficient balance"}
        except Exception as e:
            logger.error(f"Failed to debit balance for crash bet: {e}")
            return {"success": False, "error": "Balance error"}

        self.current_round.players[str(user_id)] = player
        
        # Broadcast new bet
        await self._broadcast({
            "type": "new_bet",
            "username": username,
            "bet_amount": str(bet_amount),
        })
        
        logger.info(f"Bet placed: {username} - {bet_amount} {currency}")
        
        return {
            "success": True,
            "round_id": str(self.current_round.round_id),
            "bet_amount": str(bet_amount),
        }
    
    async def cashout(self, user_id: UUID) -> dict:
        """Manual cashout for a player."""
        if not self.current_round:
            return {"success": False, "error": "No active round"}
        
        if self.current_round.state != GameState.RUNNING:
            return {"success": False, "error": "Game not running"}
        
        user_key = str(user_id)
        if user_key not in self.current_round.players:
            return {"success": False, "error": "No bet found"}
        
        player = self.current_round.players[user_key]
        if player.cashed_out:
            return {"success": False, "error": "Already cashed out"}
        
        return await self._cashout_player(user_key, self.current_round.current_multiplier)
    
    async def _cashout_player(self, user_key: str, multiplier: Decimal) -> dict:
        """Process cashout for a player."""
        player = self.current_round.players[user_key]
        
        player.cashed_out = True
        player.cashout_multiplier = multiplier
        player.profit = player.bet_amount * multiplier - player.bet_amount
        payout = player.bet_amount * multiplier
        
        # Credit winnings via ledger
        try:
            from casino.services.ledger import LedgerService
            from casino.models import Currency, LedgerEventType
            async with await _get_db_session() as db:
                ledger = LedgerService(db)
                cur_enum = Currency(player.currency.lower())
                await ledger.credit(
                    user_id=player.user_id,
                    currency=cur_enum,
                    amount=payout,
                    event_type=LedgerEventType.BET_WON,
                    reference_type="crash_cashout",
                    reference_id=self.current_round.round_id,
                    metadata={"game": "crash", "multiplier": str(multiplier), "round_id": str(self.current_round.round_id)},
                )
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to credit crash cashout for {player.username}: {e}")
        
        # Broadcast cashout
        await self._broadcast({
            "type": "cashout",
            "username": player.username,
            "multiplier": str(multiplier),
            "profit": str(player.profit),
        })
        
        logger.info(f"Cashout: {player.username} @ {multiplier}x - Profit: {player.profit}")
        
        return {
            "success": True,
            "multiplier": str(multiplier),
            "profit": str(player.profit),
            "payout": str(player.bet_amount * multiplier),
        }
    
    async def _broadcast(self, message: dict):
        """Broadcast message to all crash game players."""
        await self.manager.broadcast_to_room(self.ROOM_NAME, message)
    
    def get_state(self) -> dict:
        """Get current game state."""
        if not self.current_round:
            return {"state": "offline"}
        
        return {
            "state": self.current_round.state.value,
            "round_id": str(self.current_round.round_id),
            "hash": self.current_round.hash,
            "multiplier": str(self.current_round.current_multiplier),
            "players": [
                {
                    "username": p.username,
                    "bet_amount": str(p.bet_amount),
                    "cashed_out": p.cashed_out,
                    "cashout_multiplier": str(p.cashout_multiplier) if p.cashed_out else None,
                }
                for p in self.current_round.players.values()
            ],
        }
    
    def get_history(self, limit: int = 20) -> List[dict]:
        """Get game history."""
        return self.history[:limit]
