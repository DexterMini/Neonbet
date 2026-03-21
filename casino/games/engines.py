"""
Game Engines
============

Individual game implementations using Provably Fair outcomes.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Optional, List
from enum import Enum

from casino.services.provably_fair import GameResult


class GameOutcome(str, Enum):
    WIN = "win"
    LOSE = "lose"
    PUSH = "push"  # Tie (bet returned)


@dataclass
class BetResult:
    """Result of a bet"""
    outcome: GameOutcome
    multiplier: Decimal
    payout: Decimal
    profit: Decimal
    result_data: Dict[str, Any]


class BaseGame(ABC):
    """Base class for all games"""
    
    game_type: str
    house_edge: Decimal = Decimal("0.03")  # 3% default
    min_bet: Decimal = Decimal("0.10")
    max_bet: Decimal = Decimal("10000")
    
    def set_house_edge(self, house_edge: Decimal) -> None:
        """Set house edge for this game instance"""
        self.house_edge = Decimal(str(house_edge))
    
    @abstractmethod
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        """Calculate game result from provably fair outcome"""
        pass
    
    @abstractmethod
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        """Validate game-specific input data"""
        pass
    
    def validate_bet(self, bet_amount: Decimal) -> tuple[bool, str]:
        """Validate bet amount"""
        if bet_amount < self.min_bet:
            return False, f"Minimum bet is {self.min_bet}"
        if bet_amount > self.max_bet:
            return False, f"Maximum bet is {self.max_bet}"
        return True, ""


class DiceGame(BaseGame):
    """
    Classic Dice Game
    
    Player picks a target and whether they're betting over or under.
    Win condition: Rolled number is over/under the target.
    
    Payout = (100 - house_edge%) / win_chance%
    """
    
    game_type = "dice"
    min_roll = Decimal("0.00")
    max_roll = Decimal("99.99")
    
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        target = game_data.get("target")
        direction = game_data.get("direction")  # "over" or "under"
        
        if target is None or direction is None:
            return False
        
        target = Decimal(str(target))
        
        if direction not in ["over", "under"]:
            return False
        
        # Valid target range (leaving room for win)
        if direction == "over" and target >= Decimal("99.00"):
            return False
        if direction == "under" and target <= Decimal("1.00"):
            return False
        
        return True
    
    def calculate_win_chance(self, target: Decimal, direction: str) -> Decimal:
        """Calculate win probability"""
        if direction == "over":
            # Win if roll > target
            # e.g., target=50 -> win on 50.01-99.99 = 49.99% chance
            return Decimal("99.99") - target
        else:
            # Win if roll < target
            # e.g., target=50 -> win on 0.00-49.99 = 50% chance
            return target
    
    def calculate_multiplier(self, win_chance: Decimal) -> Decimal:
        """Calculate payout multiplier for given win chance"""
        # Multiplier = (1 - house_edge) / (win_chance / 100)
        # e.g., 50% chance with 2% edge = 0.98 / 0.50 = 1.96x
        effective_rtp = Decimal("1") - self.house_edge
        multiplier = (effective_rtp * Decimal("100")) / win_chance
        return multiplier.quantize(Decimal("0.0001"))
    
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        target = Decimal(str(game_data["target"]))
        direction = game_data["direction"]
        
        # Roll is 0.00-99.99 based on normalized value
        roll = Decimal(str(round(game_result.normalized * 100, 2)))
        
        # Determine win
        if direction == "over":
            won = roll > target
        else:
            won = roll < target
        
        win_chance = self.calculate_win_chance(target, direction)
        multiplier = self.calculate_multiplier(win_chance)
        
        if won:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            outcome = GameOutcome.WIN
        else:
            payout = Decimal("0")
            profit = -bet_amount
            outcome = GameOutcome.LOSE
            multiplier = Decimal("0")
        
        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "roll": float(roll),
                "target": float(target),
                "direction": direction,
                "win_chance": float(win_chance)
            }
        )


class LimboGame(BaseGame):
    """
    Limbo Game
    
    Player picks a target multiplier.
    System generates a multiplier.
    Win condition: Generated multiplier >= target multiplier.
    """
    
    game_type = "limbo"
    min_multiplier = Decimal("1.01")
    max_multiplier = Decimal("1000000")
    
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        target = game_data.get("target_multiplier")
        
        if target is None:
            return False
        
        target = Decimal(str(target))
        
        if target < self.min_multiplier or target > self.max_multiplier:
            return False
        
        return True
    
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        target = Decimal(str(game_data["target_multiplier"]))
        
        # Generate multiplier using limbo formula
        normalized = game_result.normalized
        
        house_edge_f = float(self.house_edge)
        
        # House edge: small probability of instant 1.00x (always lose)
        if normalized < house_edge_f:
            generated = Decimal("1.00")
        else:
            # Map [house_edge, 1) → [0, 1) then invert
            mapped = (normalized - house_edge_f) / (1.0 - house_edge_f)
            if mapped >= 0.999999:
                generated = Decimal("1000000")
            else:
                generated = Decimal(str(round(1.0 / (1.0 - mapped), 2)))
            generated = max(Decimal("1.00"), generated)
        
        won = generated >= target
        
        if won:
            payout = bet_amount * target
            profit = payout - bet_amount
            outcome = GameOutcome.WIN
            multiplier = target
        else:
            payout = Decimal("0")
            profit = -bet_amount
            outcome = GameOutcome.LOSE
            multiplier = Decimal("0")
        
        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "generated_multiplier": float(generated),
                "target_multiplier": float(target)
            }
        )


class MinesGame(BaseGame):
    """
    Mines Game
    
    Grid with hidden mines. Player reveals tiles to increase multiplier.
    Cash out anytime before hitting a mine.
    """
    
    game_type = "mines"
    grid_size = 25  # 5x5
    min_mines = 1
    max_mines = 24
    
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        mine_count = game_data.get("mine_count") or game_data.get("mines")
        
        if mine_count is None:
            return False
        
        if not (self.min_mines <= mine_count <= self.max_mines):
            return False
        
        return True
    
    def generate_mine_positions(
        self, 
        game_result: GameResult, 
        mine_count: int
    ) -> List[int]:
        """Generate mine positions using cursor-based provably fair system"""
        positions = list(range(self.grid_size))
        floats = game_result.get_float_sequence(self.grid_size - 1)
        
        # Fisher-Yates shuffle using cursor floats
        for idx, i in enumerate(range(self.grid_size - 1, 0, -1)):
            j = int(floats[idx] * (i + 1)) % (i + 1)
            positions[i], positions[j] = positions[j], positions[i]
        
        return sorted(positions[:mine_count])
    
    def calculate_multiplier_for_reveals(
        self, 
        mine_count: int, 
        reveals: int
    ) -> Decimal:
        """
        Calculate multiplier for N reveals with M mines.
        
        Based on combinatorics:
        Multiplier = (1 - house_edge) / P(surviving N reveals)
        P(survive) = C(safe, N) / C(total, N)
        """
        if reveals == 0:
            return Decimal("1")
        
        safe_tiles = self.grid_size - mine_count
        
        # Calculate probability of surviving N reveals
        prob = Decimal("1")
        for i in range(reveals):
            prob *= Decimal(safe_tiles - i) / Decimal(self.grid_size - i)
        
        # Apply house edge
        effective_rtp = Decimal("1") - self.house_edge
        
        if prob <= 0:
            return Decimal("0")
        
        multiplier = effective_rtp / prob
        return multiplier.quantize(Decimal("0.01"))
    
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        mine_count = game_data.get("mine_count") or game_data.get("mines")
        revealed_tiles = game_data.get("revealed_tiles", [])
        cashed_out = game_data.get("cashed_out", False)
        
        mine_positions = self.generate_mine_positions(game_result, mine_count)
        
        # Check if any revealed tile was a mine
        hit_mine = any(tile in mine_positions for tile in revealed_tiles)
        
        if hit_mine:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={
                    "mine_positions": mine_positions,
                    "revealed_tiles": revealed_tiles,
                    "hit_mine": True
                }
            )
        
        # Calculate multiplier for successful reveals
        multiplier = self.calculate_multiplier_for_reveals(
            mine_count, 
            len(revealed_tiles)
        )
        
        if cashed_out:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            outcome = GameOutcome.WIN
        else:
            # Still in progress
            payout = Decimal("0")
            profit = Decimal("0")
            outcome = GameOutcome.PUSH
        
        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "mine_positions": mine_positions if cashed_out or hit_mine else [],
                "revealed_tiles": revealed_tiles,
                "current_multiplier": float(multiplier),
                "next_multiplier": float(self.calculate_multiplier_for_reveals(
                    mine_count, len(revealed_tiles) + 1
                ))
            }
        )


class PlinkoGame(BaseGame):
    """
    Plinko Game
    
    Ball drops through pegs, bouncing left or right.
    Final position determines multiplier.
    """
    
    game_type = "plinko"
    available_rows = [8, 9, 10, 11, 12, 13, 14, 15, 16]
    risk_levels = ["low", "medium", "high"]
    
    # Multipliers for each risk level and row count
    # All tables have N+1 elements for N rows (positions 0..N)
    # RTP ≈ 96% for all configurations — must match frontend display exactly
    MULTIPLIERS = {
        16: {
            "low": [15.5, 8.7, 1.94, 1.36, 1.36, 1.16, 1.07, 0.97, 0.48, 0.97, 1.07, 1.16, 1.36, 1.36, 1.94, 8.7, 15.5],
            "medium": [107, 39.8, 9.7, 4.8, 2.9, 1.46, 0.97, 0.48, 0.29, 0.48, 0.97, 1.46, 2.9, 4.8, 9.7, 39.8, 107],
            "high": [970, 126.1, 25.2, 8.7, 3.9, 1.94, 0.19, 0.19, 0.19, 0.19, 0.19, 1.94, 3.9, 8.7, 25.2, 126.1, 970]
        },
        15: {
            "low": [14.5, 7.8, 2.9, 1.94, 1.46, 1.07, 0.97, 0.68, 0.68, 0.97, 1.07, 1.46, 1.94, 2.9, 7.8, 14.5],
            "medium": [85.4, 17.5, 10.7, 4.8, 2.9, 1.26, 0.48, 0.29, 0.29, 0.48, 1.26, 2.9, 4.8, 10.7, 17.5, 85.4],
            "high": [601.4, 80.5, 26.2, 7.8, 2.9, 0.48, 0.19, 0.19, 0.19, 0.19, 0.48, 2.9, 7.8, 26.2, 80.5, 601.4]
        },
        14: {
            "low": [6.9, 3.9, 1.84, 1.36, 1.26, 1.07, 0.97, 0.48, 0.97, 1.07, 1.26, 1.36, 1.84, 3.9, 6.9],
            "medium": [56.3, 14.5, 6.8, 3.9, 1.84, 0.97, 0.48, 0.19, 0.48, 0.97, 1.84, 3.9, 6.8, 14.5, 56.3],
            "high": [407.4, 54.3, 17.5, 4.8, 1.84, 0.29, 0.19, 0.19, 0.19, 0.29, 1.84, 4.8, 17.5, 54.3, 407.4]
        },
        13: {
            "low": [7.8, 3.9, 2.9, 1.84, 1.16, 0.87, 0.68, 0.68, 0.87, 1.16, 1.84, 2.9, 3.9, 7.8],
            "medium": [41.7, 12.6, 5.8, 2.9, 1.26, 0.68, 0.39, 0.39, 0.68, 1.26, 2.9, 5.8, 12.6, 41.7],
            "high": [252.2, 35.9, 10.7, 3.9, 0.97, 0.19, 0.19, 0.19, 0.19, 0.97, 3.9, 10.7, 35.9, 252.2]
        },
        12: {
            "low": [9.7, 2.9, 1.55, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 1.55, 2.9, 9.7],
            "medium": [32, 10.7, 3.9, 1.94, 1.07, 0.58, 0.29, 0.58, 1.07, 1.94, 3.9, 10.7, 32],
            "high": [165, 23.3, 7.8, 1.94, 0.68, 0.19, 0.19, 0.19, 0.68, 1.94, 7.8, 23.3, 165]
        },
        11: {
            "low": [8.1, 2.9, 1.84, 1.26, 0.97, 0.68, 0.68, 0.97, 1.26, 1.84, 2.9, 8.1],
            "medium": [23.3, 5.8, 2.9, 1.75, 0.68, 0.48, 0.48, 0.68, 1.75, 2.9, 5.8, 23.3],
            "high": [116.4, 13.6, 5, 1.36, 0.39, 0.19, 0.19, 0.39, 1.36, 5, 13.6, 116.4]
        },
        10: {
            "low": [8.6, 2.9, 1.36, 1.07, 0.97, 0.48, 0.97, 1.07, 1.36, 2.9, 8.6],
            "medium": [21.3, 4.8, 1.94, 1.36, 0.58, 0.39, 0.58, 1.36, 1.94, 4.8, 21.3],
            "high": [73.8, 9.7, 2.9, 0.87, 0.29, 0.19, 0.29, 0.87, 2.9, 9.7, 73.8]
        },
        9: {
            "low": [5.4, 1.9, 1.55, 0.97, 0.68, 0.68, 0.97, 1.55, 1.9, 5.4],
            "medium": [17.5, 3.9, 1.65, 0.87, 0.48, 0.48, 0.87, 1.65, 3.9, 17.5],
            "high": [41.7, 6.8, 1.94, 0.58, 0.19, 0.19, 0.58, 1.94, 6.8, 41.7]
        },
        8: {
            "low": [5.4, 2, 1.07, 0.97, 0.48, 0.97, 1.07, 2, 5.4],
            "medium": [12.6, 2.9, 1.26, 0.68, 0.39, 0.68, 1.26, 2.9, 12.6],
            "high": [28.1, 3.9, 1.46, 0.29, 0.19, 0.29, 1.46, 3.9, 28.1]
        }
    }
    
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        rows = game_data.get("rows")
        risk = game_data.get("risk")
        
        if rows not in self.available_rows:
            return False
        if risk not in self.risk_levels:
            return False
        
        return True
    
    def generate_path(self, game_result: GameResult, rows: int) -> List[str]:
        """Generate ball path (L/R for each row) using cursor system"""
        floats = game_result.get_float_sequence(rows)
        return ["R" if f >= 0.5 else "L" for f in floats]
    
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        rows = game_data["rows"]
        risk = game_data["risk"]
        
        path = self.generate_path(game_result, rows)
        
        # Calculate final position (count of R moves)
        final_position = path.count("R")
        
        # Get multiplier from table
        multipliers = self.MULTIPLIERS[rows][risk]
        multiplier = Decimal(str(multipliers[final_position]))
        
        payout = bet_amount * multiplier
        profit = payout - bet_amount
        
        if profit > 0:
            outcome = GameOutcome.WIN
        elif profit < 0:
            outcome = GameOutcome.LOSE
        else:
            outcome = GameOutcome.PUSH
        
        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "path": path,
                "final_position": final_position,
                "rows": rows,
                "risk": risk
            }
        )


class WheelGame(BaseGame):
    """
    Fortune Wheel Game
    
    Wheel with different colored segments and multipliers.
    """
    
    game_type = "wheel"
    
    # Wheel configuration (50 segments)
    # RTP = (25*0.2 + 15*0.5 + 7*2 + 2*5 + 1*12) / 50 = 0.97 (97%)
    WHEEL_CONFIG = {
        "segments": 50,
        "colors": {
            "gray": {"count": 25, "multiplier": 0.2},
            "blue": {"count": 15, "multiplier": 0.5},
            "green": {"count": 7, "multiplier": 2},
            "purple": {"count": 2, "multiplier": 5},
            "gold": {"count": 1, "multiplier": 12}
        }
    }
    
    def __init__(self):
        # Build wheel segments
        self.wheel = []
        for color, config in self.WHEEL_CONFIG["colors"].items():
            for _ in range(config["count"]):
                self.wheel.append({
                    "color": color,
                    "multiplier": config["multiplier"]
                })
    
    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        # Wheel has no player choices
        return True
    
    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any]
    ) -> BetResult:
        # Select segment based on normalized value
        segment_index = int(game_result.normalized * len(self.wheel)) % len(self.wheel)
        segment = self.wheel[segment_index]
        
        multiplier = Decimal(str(segment["multiplier"]))
        payout = bet_amount * multiplier
        profit = payout - bet_amount
        
        if profit > 0:
            outcome = GameOutcome.WIN
        elif profit < 0:
            outcome = GameOutcome.LOSE
        else:
            outcome = GameOutcome.PUSH
        
        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "segment_index": segment_index,
                "color": segment["color"],
                "multiplier": float(multiplier)
            }
        )


class KenoGame(BaseGame):
    """
    Keno Game

    Player picks 1-10 numbers from 1-40.
    System draws 10 numbers.
    Payout based on how many picks match the draw.
    """

    game_type = "keno"
    house_edge = Decimal("0.02")

    TOTAL_NUMBERS = 40
    DRAW_COUNT = 10
    MAX_PICKS = 10

    # Payout multipliers: PAYOUTS[risk][num_picks][hits]
    PAYOUTS: Dict[str, Dict[int, List[float]]] = {
        "low": {
            1: [0, 2.85],
            2: [0, 1.4, 5.1],
            3: [0, 1.1, 1.4, 10],
            4: [0, 0.5, 1.5, 3, 15],
            5: [0, 0.5, 1, 2, 6, 20],
            6: [0, 0, 1, 1.5, 3, 10, 25],
            7: [0, 0, 0.5, 1.5, 3, 5, 15, 40],
            8: [0, 0, 0.5, 1, 2, 4, 8, 25, 50],
            9: [0, 0, 0, 1, 1.5, 3, 5, 15, 35, 75],
            10: [0, 0, 0, 0.5, 1.5, 2, 4, 8, 25, 50, 100],
        },
        "classic": {
            1: [0, 3.68],
            2: [0, 1.6, 8],
            3: [0, 1.2, 1.8, 25],
            4: [0, 0, 2, 5, 50],
            5: [0, 0, 1.5, 3, 12, 90],
            6: [0, 0, 1, 2, 5, 20, 150],
            7: [0, 0, 0.5, 1.5, 4, 10, 50, 250],
            8: [0, 0, 0, 1, 3, 6, 20, 80, 400],
            9: [0, 0, 0, 0.5, 2, 4, 10, 40, 120, 600],
            10: [0, 0, 0, 0, 1.5, 3, 8, 20, 60, 200, 1000],
        },
        "medium": {
            1: [0, 4.5],
            2: [0, 1.8, 12],
            3: [0, 0.8, 3, 45],
            4: [0, 0, 2.5, 10, 100],
            5: [0, 0, 1.5, 5, 25, 200],
            6: [0, 0, 0, 3, 10, 50, 400],
            7: [0, 0, 0, 1.5, 6, 20, 120, 700],
            8: [0, 0, 0, 1, 4, 12, 50, 200, 1200],
            9: [0, 0, 0, 0, 3, 8, 25, 100, 400, 2000],
            10: [0, 0, 0, 0, 2, 5, 15, 50, 200, 800, 3500],
        },
        "high": {
            1: [0, 5.85],
            2: [0, 2, 18],
            3: [0, 0, 5, 80],
            4: [0, 0, 3, 20, 200],
            5: [0, 0, 1.5, 10, 80, 500],
            6: [0, 0, 0, 5, 30, 200, 1000],
            7: [0, 0, 0, 2, 15, 80, 400, 2000],
            8: [0, 0, 0, 1, 10, 40, 200, 800, 4000],
            9: [0, 0, 0, 0, 5, 20, 100, 500, 2000, 8000],
            10: [0, 0, 0, 0, 3, 10, 50, 250, 1000, 5000, 15000],
        },
    }

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        picks = game_data.get("picks")
        risk = game_data.get("risk", "classic")
        if not isinstance(picks, list):
            return False
        if len(picks) < 1 or len(picks) > self.MAX_PICKS:
            return False
        if any(not isinstance(n, int) or n < 1 or n > self.TOTAL_NUMBERS for n in picks):
            return False
        if len(set(picks)) != len(picks):
            return False
        if risk not in self.PAYOUTS:
            return False
        return True

    def _draw_numbers(self, game_result: GameResult) -> List[int]:
        """Draw DRAW_COUNT unique numbers from 1..TOTAL_NUMBERS using cursor system."""
        pool = list(range(1, self.TOTAL_NUMBERS + 1))
        floats = game_result.get_float_sequence(self.DRAW_COUNT)
        drawn: List[int] = []
        for i in range(self.DRAW_COUNT):
            idx = int(floats[i] * len(pool)) % len(pool)
            drawn.append(pool.pop(idx))
        return sorted(drawn)

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        picks: List[int] = game_data["picks"]
        risk: str = game_data.get("risk", "classic")

        drawn = self._draw_numbers(game_result)
        hits = len(set(picks) & set(drawn))

        payout_table = self.PAYOUTS[risk].get(len(picks), [0])
        mult = payout_table[hits] if hits < len(payout_table) else 0
        multiplier = Decimal(str(mult))
        payout = bet_amount * multiplier
        profit = payout - bet_amount

        if profit > 0:
            outcome = GameOutcome.WIN
        elif profit == 0 and mult > 0:
            outcome = GameOutcome.PUSH
        else:
            outcome = GameOutcome.LOSE

        return BetResult(
            outcome=outcome,
            multiplier=multiplier,
            payout=payout,
            profit=profit,
            result_data={
                "drawn": drawn,
                "picks": sorted(picks),
                "hits": hits,
                "multiplier": float(multiplier),
            },
        )


class BlackjackGame(BaseGame):
    """
    Twenty-One Game

    Player draws N cards (2-7) from a shuffled deck.
    If total is 16-21, wins with a multiplier from the payout table.
    If total < 16 or > 21, loses.
    Uses provably fair hash to shuffle the deck.
    """

    game_type = "twentyone"
    house_edge = Decimal("0.005")  # ~0.5%

    RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
    SUITS = ["♠", "♥", "♦", "♣"]

    # Payout multiplier tables by num_cards and hand total
    MULTIPLIER_TABLES: Dict[int, Dict[int, float]] = {
        2: {16: 1.5, 17: 1.7, 18: 2.1, 19: 2.5, 20: 2.3, 21: 3.8},
        3: {16: 1.4, 17: 1.6, 18: 1.9, 19: 2.2, 20: 2.1, 21: 3.5},
        4: {16: 3.0, 17: 3.4, 18: 4.1, 19: 4.8, 20: 4.5, 21: 7.5},
        5: {16: 10.0, 17: 11.5, 18: 13.5, 19: 16.1, 20: 15.0, 21: 25.1},
        6: {16: 47.0, 17: 54.0, 18: 63.3, 19: 75.1, 20: 70.4, 21: 117.3},
        7: {16: 281.1, 17: 323.3, 18: 379.4, 19: 449.7, 20: 421.6, 21: 702.7},
    }

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        num_cards = game_data.get("num_cards", 2)
        if not isinstance(num_cards, int) or num_cards < 2 or num_cards > 7:
            return False
        return True

    @staticmethod
    def _card_value(rank: str) -> int:
        if rank in ("J", "Q", "K"):
            return 10
        if rank == "A":
            return 11
        return int(rank)

    @classmethod
    def _hand_value(cls, hand: List[Dict[str, str]]) -> int:
        total = sum(cls._card_value(c["rank"]) for c in hand)
        aces = sum(1 for c in hand if c["rank"] == "A")
        while total > 21 and aces:
            total -= 10
            aces -= 1
        return total

    def _build_deck(self, game_result: GameResult) -> List[Dict[str, str]]:
        """Build and shuffle a 52-card deck using cursor-based provably fair system."""
        deck = [{"rank": r, "suit": s} for s in self.SUITS for r in self.RANKS]
        floats = game_result.get_float_sequence(len(deck) - 1)
        for idx, i in enumerate(range(len(deck) - 1, 0, -1)):
            j = int(floats[idx] * (i + 1)) % (i + 1)
            deck[i], deck[j] = deck[j], deck[i]
        return deck

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        num_cards = int(game_data.get("num_cards", 2))
        deck = self._build_deck(game_result)
        hand = deck[:num_cards]
        total = self._hand_value(hand)

        table = self.MULTIPLIER_TABLES.get(num_cards, self.MULTIPLIER_TABLES[2])
        mult_value = table.get(total, 0)
        won = 16 <= total <= 21 and mult_value > 0
        bust = total > 21

        if won:
            multiplier = Decimal(str(mult_value))
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={
                    "cards": hand,
                    "total": total,
                    "num_cards": num_cards,
                    "multiplier": mult_value,
                },
            )

        return BetResult(
            outcome=GameOutcome.LOSE,
            multiplier=Decimal("0"),
            payout=Decimal("0"),
            profit=-bet_amount,
            result_data={
                "cards": hand,
                "total": total,
                "num_cards": num_cards,
                "bust": bust,
            },
        )


class FlipGame(BaseGame):
    """
    Coin Flip Game

    Player picks heads or tails. Fair coin flip with house edge.
    """

    game_type = "flip"
    house_edge = Decimal("0.03")

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        choice = game_data.get("choice")
        return choice in ("heads", "tails")

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        choice = game_data["choice"]
        # Use normalized value: < 0.5 = heads, >= 0.5 = tails
        result = "heads" if game_result.normalized < 0.5 else "tails"
        won = result == choice

        effective_rtp = Decimal("1") - self.house_edge
        multiplier = effective_rtp * Decimal("2")  # ~1.94x

        if won:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"result": result, "choice": choice},
            )
        return BetResult(
            outcome=GameOutcome.LOSE,
            multiplier=Decimal("0"),
            payout=Decimal("0"),
            profit=-bet_amount,
            result_data={"result": result, "choice": choice},
        )


class HiLoGame(BaseGame):
    """
    Hi-Lo Card Game

    Player guesses whether the next card is higher, lower, or same.
    Card values: 1 (Ace) to 13 (King).
    """

    game_type = "hilo"
    house_edge = Decimal("0.04")

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        guess = game_data.get("guess")
        current_value = game_data.get("current_value")
        if guess not in ("higher", "lower", "same"):
            return False
        if not isinstance(current_value, (int, float)) or not (1 <= current_value <= 13):
            return False
        return True

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        guess = game_data["guess"]
        current_value = int(game_data["current_value"])

        # Generate next card 1-13
        next_value = int(game_result.normalized * 13) + 1
        next_value = min(13, max(1, next_value))

        if guess == "higher":
            won = next_value > current_value
            # Probability of higher
            higher_count = 13 - current_value
            win_prob = Decimal(str(higher_count)) / Decimal("13")
        elif guess == "lower":
            won = next_value < current_value
            lower_count = current_value - 1
            win_prob = Decimal(str(lower_count)) / Decimal("13")
        else:  # same
            won = next_value == current_value
            win_prob = Decimal("1") / Decimal("13")

        if win_prob <= 0:
            win_prob = Decimal("1") / Decimal("13")

        effective_rtp = Decimal("1") - self.house_edge
        multiplier = (effective_rtp / win_prob).quantize(Decimal("0.01"))

        if won:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"card_value": next_value, "current_value": current_value, "guess": guess},
            )
        return BetResult(
            outcome=GameOutcome.LOSE,
            multiplier=Decimal("0"),
            payout=Decimal("0"),
            profit=-bet_amount,
            result_data={"card_value": next_value, "current_value": current_value, "guess": guess},
        )


class StairsGame(BaseGame):
    """
    Stairs Game

    Player climbs rows, choosing a column each step.
    One column per row is a trap. Survive = multiplier grows.
    Cash out anytime.
    Difficulty sets number of columns (easy=4, medium=3, hard=2).
    """

    game_type = "stairs"
    house_edge = Decimal("0.04")

    COLUMNS = {"easy": 4, "medium": 3, "hard": 2}

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        difficulty = game_data.get("difficulty", "medium")
        if difficulty not in self.COLUMNS:
            return False
        row = game_data.get("row")
        col = game_data.get("col")
        if not isinstance(row, int) or row < 0:
            return False
        cols = self.COLUMNS[difficulty]
        if not isinstance(col, int) or col < 0 or col >= cols:
            return False
        return True

    def _get_trap_columns(self, game_result: GameResult, num_rows: int, num_cols: int) -> List[int]:
        """Generate trap column for each row using cursor system."""
        floats = game_result.get_float_sequence(num_rows)
        return [int(f * num_cols) % num_cols for f in floats]

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        difficulty = game_data.get("difficulty", "medium")
        num_cols = self.COLUMNS[difficulty]
        row = game_data["row"]
        col = game_data["col"]
        cashed_out = game_data.get("cashed_out", False)

        traps = self._get_trap_columns(game_result, row + 1, num_cols)
        hit_trap = traps[row] == col

        # Multiplier: each safe step multiplies by cols/(cols-1) * (1-edge)
        safe_ratio = Decimal(str(num_cols)) / Decimal(str(num_cols - 1))
        effective_rtp = Decimal("1") - self.house_edge
        step_multiplier = safe_ratio * effective_rtp

        if hit_trap:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={"trap_col": traps[row], "row": row, "col": col, "hit": True},
            )

        multiplier = step_multiplier ** (row + 1)
        multiplier = multiplier.quantize(Decimal("0.01"))

        if cashed_out:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"trap_col": traps[row], "row": row, "col": col, "hit": False, "multiplier": float(multiplier)},
            )

        return BetResult(
            outcome=GameOutcome.PUSH,
            multiplier=multiplier,
            payout=Decimal("0"),
            profit=Decimal("0"),
            result_data={"trap_col": traps[row], "row": row, "col": col, "hit": False, "multiplier": float(multiplier)},
        )


class ChickenGame(BaseGame):
    """
    Chicken Road Game

    Player crosses lanes. Each lane has a car in one position.
    Survive each crossing to increase multiplier. Cash out anytime.
    Lanes = number of positions (2-4).
    """

    game_type = "chicken"
    house_edge = Decimal("0.04")

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        lanes = game_data.get("lanes", 3)
        row = game_data.get("row")
        col = game_data.get("col")
        if not isinstance(lanes, int) or lanes < 2 or lanes > 4:
            return False
        if not isinstance(row, int) or row < 0:
            return False
        if not isinstance(col, int) or col < 0 or col >= lanes:
            return False
        return True

    def _get_car_positions(self, game_result: GameResult, num_rows: int, lanes: int) -> List[int]:
        """Generate car positions for each row using cursor system."""
        floats = game_result.get_float_sequence(num_rows)
        return [int(f * lanes) % lanes for f in floats]

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        lanes = game_data.get("lanes", 3)
        row = game_data["row"]
        col = game_data["col"]
        cashed_out = game_data.get("cashed_out", False)

        car_positions = self._get_car_positions(game_result, row + 1, lanes)
        hit_car = car_positions[row] == col

        safe_ratio = Decimal(str(lanes)) / Decimal(str(lanes - 1))
        effective_rtp = Decimal("1") - self.house_edge
        step_multiplier = safe_ratio * effective_rtp

        if hit_car:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={"car_position": car_positions[row], "row": row, "col": col, "hit": True},
            )

        multiplier = (step_multiplier ** (row + 1)).quantize(Decimal("0.01"))

        if cashed_out:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"car_position": car_positions[row], "row": row, "col": col, "hit": False, "multiplier": float(multiplier)},
            )

        return BetResult(
            outcome=GameOutcome.PUSH,
            multiplier=multiplier,
            payout=Decimal("0"),
            profit=Decimal("0"),
            result_data={"car_position": car_positions[row], "row": row, "col": col, "hit": False, "multiplier": float(multiplier)},
        )


class CoinClimberGame(BaseGame):
    """
    Coin Climber Game

    Player climbs levels, choosing a column each step.
    One column per level is correct. Wrong = lose. Cash out anytime.
    Cols = difficulty (2-4).
    """

    game_type = "coinclimber"
    house_edge = Decimal("0.04")

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        cols = game_data.get("cols", 3)
        level = game_data.get("level")
        choice = game_data.get("choice")
        if not isinstance(cols, int) or cols < 2 or cols > 4:
            return False
        if not isinstance(level, int) or level < 0:
            return False
        if not isinstance(choice, int) or choice < 0 or choice >= cols:
            return False
        return True

    def _get_correct_positions(self, game_result: GameResult, num_levels: int, cols: int) -> List[int]:
        """Generate correct positions for each level using cursor system."""
        floats = game_result.get_float_sequence(num_levels)
        return [int(f * cols) % cols for f in floats]

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        cols = game_data.get("cols", 3)
        level = game_data["level"]
        choice = game_data["choice"]
        cashed_out = game_data.get("cashed_out", False)

        correct_positions = self._get_correct_positions(game_result, level + 1, cols)
        wrong = correct_positions[level] != choice

        safe_ratio = Decimal(str(cols))
        effective_rtp = Decimal("1") - self.house_edge
        step_multiplier = safe_ratio * effective_rtp

        if wrong:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={"correct_position": correct_positions[level], "level": level, "choice": choice, "hit": True},
            )

        multiplier = (step_multiplier ** (level + 1)).quantize(Decimal("0.01"))

        if cashed_out:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"correct_position": correct_positions[level], "level": level, "choice": choice, "hit": False, "multiplier": float(multiplier)},
            )

        return BetResult(
            outcome=GameOutcome.PUSH,
            multiplier=multiplier,
            payout=Decimal("0"),
            profit=Decimal("0"),
            result_data={"correct_position": correct_positions[level], "level": level, "choice": choice, "hit": False, "multiplier": float(multiplier)},
        )


class SnakeGame(BaseGame):
    """
    Snake Game

    Provably fair: pre-generates a sequence of gem values.
    Player navigates snake to collect gems. Each gem has a random multiplier.
    The total multiplier is the sum of collected gems.
    Player cashes out with accumulated multiplier.
    """

    game_type = "snake"
    house_edge = Decimal("0.04")

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        gems_collected = game_data.get("gems_collected", 0)
        if not isinstance(gems_collected, int) or gems_collected < 0:
            return False
        return True

    def _generate_gem_values(self, game_result: GameResult, count: int = 50) -> List[float]:
        """Generate a sequence of gem multiplier values using cursor system."""
        floats = game_result.get_float_sequence(count)
        # Value 0.1x to 3.0x per gem
        return [round(0.1 + f * 2.9, 2) for f in floats]

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        gems_collected = game_data.get("gems_collected", 0)
        cashed_out = game_data.get("cashed_out", False)

        gem_values = self._generate_gem_values(game_result)
        effective_rtp = Decimal("1") - self.house_edge

        # Total multiplier = sum of first N gems * RTP factor
        if gems_collected == 0:
            multiplier = Decimal("0")
        else:
            total = sum(Decimal(str(v)) for v in gem_values[:gems_collected])
            multiplier = (total * effective_rtp).quantize(Decimal("0.01"))

        if cashed_out and gems_collected > 0:
            payout = bet_amount * multiplier
            profit = payout - bet_amount
            outcome = GameOutcome.WIN if profit > 0 else GameOutcome.LOSE
            return BetResult(
                outcome=outcome,
                multiplier=multiplier,
                payout=payout,
                profit=profit,
                result_data={"gem_values": gem_values[:gems_collected], "multiplier": float(multiplier)},
            )

        # Death (no cashout, game over)
        if not cashed_out and gems_collected > 0:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={"gem_values": gem_values[:gems_collected], "died": True},
            )

        return BetResult(
            outcome=GameOutcome.LOSE,
            multiplier=Decimal("0"),
            payout=Decimal("0"),
            profit=-bet_amount,
            result_data={"gem_values": [], "died": True},
        )


class SlotsGame(BaseGame):
    """
    Slot Machine Game

    5 reels, 4 rows. 10 symbols with equal probability.
    Wild substitutes. Scatter triggers bonus.
    Matching 3+ symbols on a payline pays out.
    Payout = bet * symbol_mult / 10 per winning line.
    """

    game_type = "slots"
    house_edge = Decimal("0.05")

    # Matches the frontend symbol set exactly
    SYMBOLS = ["wild", "scatter", "zeus", "crown", "ring", "chalice", "hourglass", "sapphire", "emerald", "ruby"]

    # Payouts per symbol for 3, 4, 5 consecutive matches (before /10 divisor)
    SYMBOL_PAYOUTS: Dict[str, Dict[int, float]] = {
        "wild":      {3: 50,  4: 250, 5: 1000},
        "scatter":   {3: 5,   4: 20,  5: 100},
        "zeus":      {3: 50,  4: 150, 5: 500},
        "crown":     {3: 10,  4: 100, 5: 200},
        "ring":      {3: 8,   4: 40,  5: 150},
        "chalice":   {3: 5,   4: 30,  5: 100},
        "hourglass": {3: 3,   4: 15,  5: 60},
        "sapphire":  {3: 2,   4: 8,   5: 30},
        "emerald":   {3: 2,   4: 8,   5: 30},
        "ruby":      {3: 1,   4: 5,   5: 20},
    }

    # 20 paylines across 5 reels (row indices per reel)
    PAYLINES = [
        [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],
        [0,1,2,1,0],[3,2,1,2,3],
        [0,1,2,3,3],[3,2,1,0,0],
        [0,2,0,2,0],[3,1,3,1,3],
        [1,0,1,0,1],[2,3,2,3,2],
        [0,0,1,2,2],[3,3,2,1,1],
        [1,0,0,0,1],[2,3,3,3,2],
        [0,1,1,2,2],[3,2,2,1,1],
        [1,1,0,1,1],[2,2,3,2,2],
    ]

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        return True

    def _generate_grid(self, game_result: GameResult) -> List[List[str]]:
        """Generate 5 reels x 4 rows grid of symbol ids using cursor system."""
        num_symbols = len(self.SYMBOLS)
        floats = game_result.get_float_sequence(20)  # 5 reels × 4 rows
        grid: List[List[str]] = []
        for reel in range(5):
            column: List[str] = []
            for row in range(4):
                idx = reel * 4 + row
                val = int(floats[idx] * num_symbols) % num_symbols
                column.append(self.SYMBOLS[val])
            grid.append(column)
        return grid

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        grid = self._generate_grid(game_result)

        total_pay = Decimal("0")
        winning_lines: List[Dict] = []
        win_positions: List[List[int]] = []

        # Count scatters
        scatter_count = 0
        for reel in range(5):
            for row in range(4):
                if grid[reel][row] == "scatter":
                    scatter_count += 1

        for line_idx, payline in enumerate(self.PAYLINES):
            line_syms = [grid[reel][payline[reel]] for reel in range(5)]

            # Determine first non-wild symbol
            first = line_syms[0]
            count = 1
            for i in range(1, 5):
                cur = line_syms[i]
                if cur == first or cur == "wild" or first == "wild":
                    count += 1
                    # If first was wild, adopt the next non-wild symbol
                    if first == "wild" and cur != "wild":
                        first = cur
                else:
                    break

            if count >= 3:
                pay_sym = first if first != "wild" else "wild"
                sym_payouts = self.SYMBOL_PAYOUTS.get(pay_sym, {})
                mult = sym_payouts.get(count, 0)
                if mult > 0:
                    line_pay = bet_amount * Decimal(str(mult)) / Decimal("10")
                    total_pay += line_pay
                    winning_lines.append({
                        "line": line_idx,
                        "symbol": pay_sym,
                        "count": count,
                        "multiplier": mult,
                    })
                    for i in range(count):
                        win_positions.append([payline[i], i])  # [row, reel]

        # Scatter bonus
        if scatter_count >= 3:
            scatter_pay = bet_amount * Decimal(str(scatter_count)) * Decimal("3")
            total_pay += scatter_pay

        total_multiplier = (total_pay / bet_amount).quantize(Decimal("0.01")) if bet_amount > 0 else Decimal("0")
        profit = total_pay - bet_amount

        if profit > 0:
            outcome = GameOutcome.WIN
        elif total_multiplier > 0:
            outcome = GameOutcome.PUSH
        else:
            outcome = GameOutcome.LOSE

        # Return grid as [row][reel] for frontend compatibility
        grid_flat = [[grid[reel][row] for reel in range(5)] for row in range(4)]

        return BetResult(
            outcome=outcome,
            multiplier=total_multiplier,
            payout=total_pay,
            profit=profit,
            result_data={
                "grid": grid_flat,
                "winning_lines": winning_lines,
                "multiplier": float(total_multiplier),
                "scatter_count": scatter_count,
            },
        )


# Game registry
GAMES: Dict[str, BaseGame] = {
    "dice": DiceGame(),
    "limbo": LimboGame(),
    "mines": MinesGame(),
    "plinko": PlinkoGame(),
    "wheel": WheelGame(),
    "keno": KenoGame(),
    "twentyone": BlackjackGame(),
    "flip": FlipGame(),
    "hilo": HiLoGame(),
    "stairs": StairsGame(),
    "chicken": ChickenGame(),
    "coinclimber": CoinClimberGame(),
    "snake": SnakeGame(),
    "slots": SlotsGame(),
}


def get_game(game_type: str) -> Optional[BaseGame]:
    """Get game engine by type"""
    return GAMES.get(game_type)
