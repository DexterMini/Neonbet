"""
Crash Game Engine
=================

Multiplier increases until it "crashes".
Players must cash out before the crash.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, UTC
from decimal import Decimal
from typing import Dict, List, Optional, Set
from enum import Enum
import hmac
import hashlib
import uuid

from casino.services.provably_fair import ProvablyFairEngine


class CrashState(str, Enum):
    WAITING = "waiting"      # Accepting bets
    RUNNING = "running"      # Multiplier increasing
    CRASHED = "crashed"      # Round ended


@dataclass
class CrashPlayer:
    """Player in a crash round"""
    user_id: str
    bet_amount: Decimal
    auto_cashout: Optional[Decimal] = None
    cashed_out_at: Optional[Decimal] = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class CrashRound:
    """Single crash game round"""
    round_id: str
    server_seed: str
    server_seed_hash: str
    crash_point: Decimal
    state: CrashState
    players: Dict[str, CrashPlayer]
    current_multiplier: Decimal = Decimal("1.00")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class CrashEngine:
    """
    Crash Game Engine
    
    - Multiplier starts at 1.00x and increases exponentially
    - Players bet during "waiting" phase
    - Once "running", multiplier increases until crash point
    - Players must cash out before crash to win
    """
    
    house_edge: Decimal = Decimal("0.01")  # 1% house edge
    min_crash: Decimal = Decimal("1.01")
    max_crash: Decimal = Decimal("1000000")
    tick_rate: float = 0.1  # Multiplier update rate in seconds
    growth_rate: float = 0.08  # Exponential growth rate
    
    def __init__(self, provably_fair: ProvablyFairEngine):
        self.pf_engine = provably_fair
        self.current_round: Optional[CrashRound] = None
        self.round_history: List[CrashRound] = []
        self._callbacks: Dict[str, List] = {
            "multiplier_update": [],
            "player_cashout": [],
            "round_start": [],
            "round_crash": [],
        }
    
    def set_house_edge(self, house_edge: Decimal) -> None:
        """Set house edge for this game engine"""
        self.house_edge = Decimal(str(house_edge))
    
    def generate_crash_point(self, server_seed: str, round_id: str) -> Decimal:
        """
        Generate crash point using provably fair method.
        
        Uses exponential distribution with house edge.
        Formula: crash = 0.98 / (1 - random) where random is [0, 0.97]
        
        This creates a geometric distribution where:
        - P(crash <= 1.01x) ≈ 3% (instant crash)
        - P(crash <= 2x) ≈ 51%
        - P(crash <= 10x) ≈ 90%
        - P(crash >= 100x) ≈ 1%
        """
        combined = f"{server_seed}:{round_id}"
        hash_result = hmac.new(
            server_seed.encode(),
            combined.encode(),
            hashlib.sha256
        ).hexdigest()
        
        # Use first 52 bits (13 hex chars) for high precision
        raw_value = int(hash_result[:13], 16)
        max_value = 16**13
        
        # Normalize to [0, 1)
        normalized = raw_value / max_value
        
        # Apply house edge - 3% instant crash (house always wins)
        if normalized < float(self.house_edge):
            return Decimal("1.00")  # Instant crash
        
        # Adjust for house edge and compute crash point
        adjusted = (normalized - float(self.house_edge)) / (1 - float(self.house_edge))
        
        # Exponential distribution: crash = 1 / (1 - adjusted)
        # Capped at max_crash
        if adjusted >= 0.999999:
            crash = self.max_crash
        else:
            crash = Decimal(str(round(1 / (1 - adjusted), 2)))
        
        return max(self.min_crash, min(crash, self.max_crash))
    
    async def start_new_round(self) -> CrashRound:
        """Initialize a new crash round"""
        round_id = str(uuid.uuid4())
        
        # Generate server seed
        server_seed = hashlib.sha256(f"{round_id}:{datetime.now(UTC).timestamp()}".encode()).hexdigest()
        server_seed_hash = hashlib.sha256(server_seed.encode()).hexdigest()
        
        # Pre-determine crash point (hidden until round ends)
        crash_point = self.generate_crash_point(server_seed, round_id)
        
        self.current_round = CrashRound(
            round_id=round_id,
            server_seed=server_seed,
            server_seed_hash=server_seed_hash,
            crash_point=crash_point,
            state=CrashState.WAITING,
            players={}
        )
        
        return self.current_round
    
    def place_bet(
        self,
        user_id: str,
        bet_amount: Decimal,
        auto_cashout: Optional[Decimal] = None
    ) -> bool:
        """Place a bet in the current round (only during WAITING phase)"""
        if not self.current_round:
            return False
        
        if self.current_round.state != CrashState.WAITING:
            return False
        
        if user_id in self.current_round.players:
            return False  # Already bet this round
        
        if auto_cashout and auto_cashout < self.min_crash:
            return False
        
        self.current_round.players[user_id] = CrashPlayer(
            user_id=user_id,
            bet_amount=bet_amount,
            auto_cashout=auto_cashout
        )
        
        return True
    
    def cashout(self, user_id: str) -> Optional[Decimal]:
        """
        Cash out a player at current multiplier.
        Returns payout amount or None if failed.
        """
        if not self.current_round:
            return None
        
        if self.current_round.state != CrashState.RUNNING:
            return None
        
        player = self.current_round.players.get(user_id)
        if not player or player.cashed_out_at:
            return None  # Not in game or already cashed out
        
        player.cashed_out_at = self.current_round.current_multiplier
        payout = player.bet_amount * player.cashed_out_at
        
        # Trigger callback
        self._emit("player_cashout", {
            "user_id": user_id,
            "multiplier": player.cashed_out_at,
            "payout": payout
        })
        
        return payout
    
    async def run_round(self):
        """
        Execute the crash round.
        Multiplier increases until crash point is reached.
        """
        if not self.current_round:
            return
        
        self.current_round.state = CrashState.RUNNING
        self.current_round.start_time = datetime.now(UTC)
        
        self._emit("round_start", {
            "round_id": self.current_round.round_id,
            "server_seed_hash": self.current_round.server_seed_hash
        })
        
        elapsed = 0.0
        
        while self.current_round.current_multiplier < self.current_round.crash_point:
            await asyncio.sleep(self.tick_rate)
            elapsed += self.tick_rate
            
            # Exponential growth: m(t) = e^(r*t)
            import math
            new_multiplier = Decimal(str(round(math.exp(self.growth_rate * elapsed), 2)))
            self.current_round.current_multiplier = new_multiplier
            
            # Check auto cashouts
            for player in self.current_round.players.values():
                if (
                    player.auto_cashout and 
                    not player.cashed_out_at and 
                    new_multiplier >= player.auto_cashout
                ):
                    self.cashout(player.user_id)
            
            # Emit multiplier update
            self._emit("multiplier_update", {
                "multiplier": float(new_multiplier)
            })
            
            # Check if we've exceeded crash point
            if new_multiplier >= self.current_round.crash_point:
                break
        
        # Round crashed
        self.current_round.state = CrashState.CRASHED
        self.current_round.end_time = datetime.now(UTC)
        
        self._emit("round_crash", {
            "round_id": self.current_round.round_id,
            "crash_point": float(self.current_round.crash_point),
            "server_seed": self.current_round.server_seed
        })
        
        # Archive round
        self.round_history.append(self.current_round)
        if len(self.round_history) > 100:
            self.round_history.pop(0)
    
    def get_round_results(self) -> Dict:
        """Get results for current/last round"""
        if not self.current_round:
            return {}
        
        results = {
            "round_id": self.current_round.round_id,
            "crash_point": float(self.current_round.crash_point),
            "state": self.current_round.state.value,
            "players": []
        }
        
        for player in self.current_round.players.values():
            payout = Decimal("0")
            profit = -player.bet_amount
            
            if player.cashed_out_at:
                payout = player.bet_amount * player.cashed_out_at
                profit = payout - player.bet_amount
            
            results["players"].append({
                "user_id": player.user_id,
                "bet_amount": float(player.bet_amount),
                "cashed_out_at": float(player.cashed_out_at) if player.cashed_out_at else None,
                "payout": float(payout),
                "profit": float(profit)
            })
        
        # Only reveal seed after crash
        if self.current_round.state == CrashState.CRASHED:
            results["server_seed"] = self.current_round.server_seed
            results["server_seed_hash"] = self.current_round.server_seed_hash
        else:
            results["server_seed_hash"] = self.current_round.server_seed_hash
        
        return results
    
    def verify_crash_point(
        self, 
        server_seed: str, 
        round_id: str, 
        claimed_crash: Decimal
    ) -> bool:
        """Verify a crash point was fairly generated"""
        calculated = self.generate_crash_point(server_seed, round_id)
        return calculated == claimed_crash
    
    def on(self, event: str, callback):
        """Register event callback"""
        if event in self._callbacks:
            self._callbacks[event].append(callback)
    
    def _emit(self, event: str, data: Dict):
        """Emit event to callbacks"""
        for callback in self._callbacks.get(event, []):
            try:
                callback(data)
            except Exception:
                pass
    
    def get_history(self, limit: int = 20) -> List[Dict]:
        """Get recent crash history"""
        history = []
        for round in reversed(self.round_history[-limit:]):
            history.append({
                "round_id": round.round_id,
                "crash_point": float(round.crash_point),
                "timestamp": round.end_time.isoformat() if round.end_time else None
            })
        return history
