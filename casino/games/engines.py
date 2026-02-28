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
    house_edge: Decimal = Decimal("0.02")  # 2% default
    min_bet: Decimal = Decimal("0.10")
    max_bet: Decimal = Decimal("10000")
    
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
        
        # Apply house edge to generation
        effective_rtp = 1 - float(self.house_edge)
        
        # Avoid division by zero
        if normalized >= effective_rtp:
            normalized = effective_rtp - 0.0001
        
        # Multiplier formula: 1 / (1 - normalized)
        generated = Decimal(str(round(effective_rtp / (1 - normalized), 2)))
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
        mine_count = game_data.get("mine_count")
        
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
        """Generate mine positions using provably fair hash"""
        positions = list(range(self.grid_size))
        hash_full = game_result.raw_hash
        
        # Fisher-Yates shuffle using hash
        for i in range(self.grid_size - 1, 0, -1):
            hash_segment = hash_full[(i % 32) * 2: (i % 32) * 2 + 2]
            j = int(hash_segment, 16) % (i + 1)
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
        mine_count = game_data["mine_count"]
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
    available_rows = [8, 12, 16]
    risk_levels = ["low", "medium", "high"]
    
    # Multipliers for each risk level and row count
    MULTIPLIERS = {
        16: {
            "low": [5.6, 2.1, 1.1, 1, 0.5, 1, 0.3, 0.5, 0.3, 0.5, 0.3, 1, 0.5, 1, 1.1, 2.1, 5.6],
            "medium": [13, 3, 1.3, 0.7, 0.4, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.4, 0.7, 1.3, 3, 13],
            "high": [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110]
        },
        12: {
            "low": [3.2, 1.6, 1.2, 1, 0.7, 0.5, 0.5, 0.7, 1, 1.2, 1.6, 3.2],
            "medium": [8.1, 3, 1.4, 0.9, 0.4, 0.2, 0.2, 0.4, 0.9, 1.4, 3, 8.1],
            "high": [43, 13, 6, 2.5, 1, 0.4, 0.4, 1, 2.5, 6, 13, 43]
        },
        8: {
            "low": [2.1, 1.3, 1, 0.6, 0.6, 1, 1.3, 2.1],
            "medium": [4.1, 1.6, 0.9, 0.4, 0.4, 0.9, 1.6, 4.1],
            "high": [14, 3.6, 1.4, 0.4, 0.4, 1.4, 3.6, 14]
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
        """Generate ball path (L/R for each row)"""
        path = []
        hash_full = game_result.raw_hash
        
        for i in range(rows):
            byte_value = int(hash_full[i*2:(i+1)*2], 16)
            direction = "R" if byte_value >= 128 else "L"
            path.append(direction)
        
        return path
    
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
    WHEEL_CONFIG = {
        "segments": 50,
        "colors": {
            "gray": {"count": 25, "multiplier": 1.2},
            "blue": {"count": 15, "multiplier": 2},
            "green": {"count": 7, "multiplier": 5},
            "purple": {"count": 2, "multiplier": 25},
            "gold": {"count": 1, "multiplier": 50}
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

    def _draw_numbers(self, hash_full: str) -> List[int]:
        """Draw DRAW_COUNT unique numbers from 1..TOTAL_NUMBERS using the hash."""
        pool = list(range(1, self.TOTAL_NUMBERS + 1))
        drawn: List[int] = []
        for i in range(self.DRAW_COUNT):
            # Use 4-hex-char segments for wider range
            seg = hash_full[(i * 4) % len(hash_full): (i * 4 + 4) % len(hash_full)]
            if len(seg) < 4:
                seg = hash_full[:4]
            idx = int(seg, 16) % len(pool)
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

        drawn = self._draw_numbers(game_result.raw_hash)
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
    Blackjack (Twenty-One) Game

    Single-deck, player vs dealer.
    Uses provably fair hash to shuffle the deck.
    Standard rules: dealer stands on 17, blackjack pays 3:2,
    double-down on any first two cards, split not supported in v1.
    """

    game_type = "twentyone"
    house_edge = Decimal("0.005")  # ~0.5%

    RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
    SUITS = ["♠", "♥", "♦", "♣"]

    def validate_game_data(self, game_data: Dict[str, Any]) -> bool:
        action = game_data.get("action", "deal")
        return action in ("deal",)

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

    def _build_deck(self, hash_full: str) -> List[Dict[str, str]]:
        """Build and shuffle a 52-card deck using the provably fair hash."""
        deck = [{"rank": r, "suit": s} for s in self.SUITS for r in self.RANKS]
        # Fisher-Yates shuffle seeded by hash
        for i in range(len(deck) - 1, 0, -1):
            seg = hash_full[(i % 32) * 2: (i % 32) * 2 + 2]
            j = int(seg, 16) % (i + 1)
            deck[i], deck[j] = deck[j], deck[i]
        return deck

    def calculate_result(
        self,
        game_result: GameResult,
        bet_amount: Decimal,
        game_data: Dict[str, Any],
    ) -> BetResult:
        deck = self._build_deck(game_result.raw_hash)
        idx = 0

        def draw() -> Dict[str, str]:
            nonlocal idx
            card = deck[idx]
            idx += 1
            return card

        # Initial deal: player-dealer-player-dealer
        player_hand = [draw(), draw()]
        dealer_hand = [draw(), draw()]

        # Swap second draw order for proper alternation
        player_hand = [deck[0], deck[2]]
        dealer_hand = [deck[1], deck[3]]
        idx = 4

        player_total = self._hand_value(player_hand)
        dealer_total = self._hand_value(dealer_hand)

        # Check naturals
        player_bj = player_total == 21 and len(player_hand) == 2
        dealer_bj = dealer_total == 21 and len(dealer_hand) == 2

        if player_bj and dealer_bj:
            return BetResult(
                outcome=GameOutcome.PUSH,
                multiplier=Decimal("1"),
                payout=bet_amount,
                profit=Decimal("0"),
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": 21,
                    "dealer_total": 21,
                    "blackjack": True,
                },
            )
        if player_bj:
            payout = bet_amount * Decimal("2.5")
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=Decimal("2.5"),
                payout=payout,
                profit=payout - bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": 21,
                    "dealer_total": dealer_total,
                    "blackjack": True,
                },
            )
        if dealer_bj:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": 21,
                    "blackjack": True,
                },
            )

        # Simple automated strategy: stand on 17+, hit below 17
        while self._hand_value(player_hand) < 17:
            player_hand.append(draw())

        player_total = self._hand_value(player_hand)
        if player_total > 21:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": dealer_total,
                    "bust": "player",
                },
            )

        # Dealer plays: hit until 17+
        while self._hand_value(dealer_hand) < 17:
            dealer_hand.append(draw())

        dealer_total = self._hand_value(dealer_hand)

        if dealer_total > 21:
            payout = bet_amount * Decimal("2")
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=Decimal("2"),
                payout=payout,
                profit=payout - bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": dealer_total,
                    "bust": "dealer",
                },
            )

        if player_total > dealer_total:
            payout = bet_amount * Decimal("2")
            return BetResult(
                outcome=GameOutcome.WIN,
                multiplier=Decimal("2"),
                payout=payout,
                profit=payout - bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": dealer_total,
                },
            )
        elif player_total == dealer_total:
            return BetResult(
                outcome=GameOutcome.PUSH,
                multiplier=Decimal("1"),
                payout=bet_amount,
                profit=Decimal("0"),
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": dealer_total,
                },
            )
        else:
            return BetResult(
                outcome=GameOutcome.LOSE,
                multiplier=Decimal("0"),
                payout=Decimal("0"),
                profit=-bet_amount,
                result_data={
                    "player_hand": player_hand,
                    "dealer_hand": dealer_hand,
                    "player_total": player_total,
                    "dealer_total": dealer_total,
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
}


def get_game(game_type: str) -> Optional[BaseGame]:
    """Get game engine by type"""
    return GAMES.get(game_type)
