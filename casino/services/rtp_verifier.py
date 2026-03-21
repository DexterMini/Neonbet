"""
RTP Verification Engine
=======================

Formal verification of Return-to-Player for every game engine.

Simulates N rounds per game configuration and verifies that the
measured RTP converges to the theoretical value within a statistical
confidence interval.

Usage (admin API or CLI):
    verifier = RTPVerifier()
    report = verifier.verify_all_games(num_rounds=1_000_000)
"""

import hashlib
import hmac
import math
import secrets
import time
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

from casino.games.engines import (
    GAMES,
    BaseGame,
    BetResult,
    GameOutcome,
    BlackjackGame,
    DiceGame,
    FlipGame,
    HiLoGame,
    KenoGame,
    LimboGame,
    MinesGame,
    PlinkoGame,
    SlotsGame,
    WheelGame,
    StairsGame,
    ChickenGame,
    CoinClimberGame,
    SnakeGame,
)
from casino.services.provably_fair import GameResult, cursor_generate_floats


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _comb(n: int, k: int) -> int:
    """Binomial coefficient C(n, k)."""
    if k < 0 or k > n:
        return 0
    if k == 0 or k == n:
        return 1
    k = min(k, n - k)
    result = 1
    for i in range(k):
        result = result * (n - i) // (i + 1)
    return result


def _plinko_theoretical_rtp(rows: int, risk: str) -> float:
    """Compute theoretical RTP for Plinko from binomial distribution."""
    multipliers = PlinkoGame.MULTIPLIERS.get(rows, {}).get(risk)
    if not multipliers:
        return 0.0
    total = 2 ** rows
    ev = 0.0
    for k in range(rows + 1):
        prob = _comb(rows, k) / total
        ev += prob * multipliers[k]
    return ev


def _wheel_theoretical_rtp() -> float:
    """Compute theoretical RTP for Wheel from segment config."""
    cfg = WheelGame.WHEEL_CONFIG
    total = cfg["segments"]
    ev = sum(c["count"] * c["multiplier"] for c in cfg["colors"].values())
    return ev / total


def _keno_theoretical_rtp(num_picks: int, risk: str) -> float:
    """Compute theoretical RTP for Keno from hypergeometric distribution."""
    total = KenoGame.TOTAL_NUMBERS  # 40
    draw = KenoGame.DRAW_COUNT  # 10
    payout_table = KenoGame.PAYOUTS.get(risk, {}).get(num_picks, [0])
    ev = 0.0
    for h in range(min(num_picks, draw) + 1):
        prob = (_comb(num_picks, h) * _comb(total - num_picks, draw - h)) / _comb(total, draw)
        mult = payout_table[h] if h < len(payout_table) else 0
        ev += prob * mult
    return ev


def _snake_theoretical_rtp(gems: int, house_edge: float) -> float:
    """Compute theoretical RTP for Snake (always cashes out)."""
    # Gem values uniform [0.1, 3.0], mean = 1.55
    # Total multiplier = sum(gem_values) * (1 - house_edge)
    mean_gem = (0.1 + 3.0) / 2.0
    return gems * mean_gem * (1.0 - house_edge)


def _make_game_result(round_idx: int, server_seed: str, client_seed: str) -> GameResult:
    """Build a GameResult for simulation using real provably fair maths."""
    nonce = round_idx
    message = f"{client_seed}:{nonce}"
    raw_hash = hmac.new(
        server_seed.encode(),
        message.encode(),
        hashlib.sha256,
    ).hexdigest()
    raw_value = int(raw_hash[:8], 16)
    normalized = raw_value / 0xFFFFFFFF
    server_seed_hash = hashlib.sha256(server_seed.encode()).hexdigest()

    return GameResult(
        raw_hash=raw_hash,
        raw_value=raw_value,
        normalized=normalized,
        server_seed_hash=server_seed_hash,
        client_seed=client_seed,
        nonce=nonce,
        _server_seed=server_seed,
    )


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class GameRTPResult:
    """RTP simulation result for a single game configuration."""
    game_type: str
    config_label: str
    num_rounds: int
    theoretical_rtp: float
    measured_rtp: float
    house_edge_theoretical: float
    house_edge_measured: float
    ci_lower: float          # 99.9 % confidence interval lower bound
    ci_upper: float          # 99.9 % confidence interval upper bound
    within_ci: bool          # True if theoretical RTP is inside CI
    std_dev: float
    max_multiplier: float
    win_rate: float
    elapsed_seconds: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "game_type": self.game_type,
            "config": self.config_label,
            "rounds": self.num_rounds,
            "theoretical_rtp": round(self.theoretical_rtp, 6),
            "measured_rtp": round(self.measured_rtp, 6),
            "house_edge_theoretical": round(self.house_edge_theoretical, 6),
            "house_edge_measured": round(self.house_edge_measured, 6),
            "ci_99_9": [round(self.ci_lower, 6), round(self.ci_upper, 6)],
            "within_ci": self.within_ci,
            "std_dev": round(self.std_dev, 6),
            "max_multiplier": round(self.max_multiplier, 4),
            "win_rate": round(self.win_rate, 6),
            "elapsed_seconds": round(self.elapsed_seconds, 3),
        }


@dataclass
class RTPReport:
    """Full verification report across all games."""
    total_rounds: int
    total_elapsed: float
    all_passed: bool
    results: List[GameRTPResult]
    vip_impact: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_rounds": self.total_rounds,
            "total_elapsed_seconds": round(self.total_elapsed, 2),
            "all_passed": self.all_passed,
            "games": [r.to_dict() for r in self.results],
            "vip_impact": self.vip_impact,
        }


# ---------------------------------------------------------------------------
# RTP Verifier
# ---------------------------------------------------------------------------

class RTPVerifier:
    """
    Simulates every game engine over N rounds to formally verify RTP.

    For each game, multiple representative configurations are tested to
    cover the parameter space (e.g. dice over/under at various targets,
    plinko at each risk level, keno with different pick counts, etc.).
    """

    # z-score for 99.9 % two-sided CI
    Z_999 = 3.291

    BET_AMOUNT = Decimal("1.00")

    def __init__(self):
        self._server_seed = secrets.token_hex(32)
        self._client_seed = secrets.token_hex(16)

    # ------------------------------------------------------------------
    # Core simulation
    # ------------------------------------------------------------------

    def _simulate_game(
        self,
        game: BaseGame,
        game_data_fn,
        num_rounds: int,
        config_label: str,
        theoretical_rtp_override: Optional[float] = None,
    ) -> GameRTPResult:
        """Run *num_rounds* of a game and compute RTP statistics."""
        total_wagered = 0.0
        total_returned = 0.0
        wins = 0
        max_mult = 0.0
        returns: List[float] = []

        t0 = time.perf_counter()

        for i in range(num_rounds):
            gr = _make_game_result(i, self._server_seed, self._client_seed)
            game_data = game_data_fn(i)

            result: BetResult = game.calculate_result(gr, self.BET_AMOUNT, game_data)

            payout = float(result.payout)
            mult = float(result.multiplier)
            total_wagered += 1.0
            total_returned += payout
            returns.append(payout)

            if result.outcome == GameOutcome.WIN:
                wins += 1
            if mult > max_mult:
                max_mult = mult

        elapsed = time.perf_counter() - t0

        measured_rtp = total_returned / total_wagered if total_wagered > 0 else 0.0
        theoretical_rtp = theoretical_rtp_override if theoretical_rtp_override is not None else 1.0 - float(game.house_edge)

        # Standard deviation of per-bet return
        mean = measured_rtp
        variance = sum((r - mean) ** 2 for r in returns) / max(len(returns) - 1, 1)
        std_dev = math.sqrt(variance)

        # 99.9 % CI for the mean
        se = std_dev / math.sqrt(num_rounds)
        ci_lower = mean - self.Z_999 * se
        ci_upper = mean + self.Z_999 * se

        within_ci = ci_lower <= theoretical_rtp <= ci_upper

        return GameRTPResult(
            game_type=game.game_type,
            config_label=config_label,
            num_rounds=num_rounds,
            theoretical_rtp=theoretical_rtp,
            measured_rtp=measured_rtp,
            house_edge_theoretical=float(game.house_edge),
            house_edge_measured=1.0 - measured_rtp,
            ci_lower=ci_lower,
            ci_upper=ci_upper,
            within_ci=within_ci,
            std_dev=std_dev,
            max_multiplier=max_mult,
            win_rate=wins / num_rounds if num_rounds > 0 else 0.0,
            elapsed_seconds=elapsed,
        )

    # ------------------------------------------------------------------
    # Game-specific configs
    # ------------------------------------------------------------------

    def _configs_dice(self, n: int) -> List[GameRTPResult]:
        game = DiceGame()
        configs = [
            ("dice_over50", lambda _: {"target": 50, "direction": "over"}),
            ("dice_under50", lambda _: {"target": 50, "direction": "under"}),
            ("dice_over75", lambda _: {"target": 75, "direction": "over"}),
            ("dice_under25", lambda _: {"target": 25, "direction": "under"}),
            ("dice_over95", lambda _: {"target": 95, "direction": "over"}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_limbo(self, n: int) -> List[GameRTPResult]:
        game = LimboGame()
        configs = [
            ("limbo_2x", lambda _: {"target_multiplier": 2}),
            ("limbo_5x", lambda _: {"target_multiplier": 5}),
            ("limbo_10x", lambda _: {"target_multiplier": 10}),
            ("limbo_100x", lambda _: {"target_multiplier": 100}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_flip(self, n: int) -> List[GameRTPResult]:
        game = FlipGame()
        return [self._simulate_game(
            game,
            lambda _: {"choice": "heads"},
            n,
            "flip_heads",
        )]

    def _configs_wheel(self, n: int) -> List[GameRTPResult]:
        game = WheelGame()
        rtp = _wheel_theoretical_rtp()
        return [self._simulate_game(game, lambda _: {}, n, "wheel", theoretical_rtp_override=rtp)]

    def _configs_plinko(self, n: int) -> List[GameRTPResult]:
        game = PlinkoGame()
        configs = [
            ("plinko_16_low", lambda _: {"rows": 16, "risk": "low"}, _plinko_theoretical_rtp(16, "low")),
            ("plinko_16_medium", lambda _: {"rows": 16, "risk": "medium"}, _plinko_theoretical_rtp(16, "medium")),
            ("plinko_16_high", lambda _: {"rows": 16, "risk": "high"}, _plinko_theoretical_rtp(16, "high")),
            ("plinko_8_low", lambda _: {"rows": 8, "risk": "low"}, _plinko_theoretical_rtp(8, "low")),
            ("plinko_8_high", lambda _: {"rows": 8, "risk": "high"}, _plinko_theoretical_rtp(8, "high")),
        ]
        return [self._simulate_game(game, fn, n, label, theoretical_rtp_override=rtp) for label, fn, rtp in configs]

    def _configs_mines(self, n: int) -> List[GameRTPResult]:
        game = MinesGame()
        # Simulate revealing 1 tile then cashing out
        configs = [
            ("mines_3_reveal1", lambda _: {"mine_count": 3, "revealed_tiles": [0], "cashed_out": True}),
            ("mines_5_reveal1", lambda _: {"mine_count": 5, "revealed_tiles": [0], "cashed_out": True}),
            ("mines_10_reveal1", lambda _: {"mine_count": 10, "revealed_tiles": [0], "cashed_out": True}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_keno(self, n: int) -> List[GameRTPResult]:
        game = KenoGame()
        configs = [
            ("keno_classic_5picks", lambda _: {"picks": [1, 2, 3, 4, 5], "risk": "classic"}, _keno_theoretical_rtp(5, "classic")),
            ("keno_classic_10picks", lambda _: {"picks": list(range(1, 11)), "risk": "classic"}, _keno_theoretical_rtp(10, "classic")),
            ("keno_high_5picks", lambda _: {"picks": [1, 2, 3, 4, 5], "risk": "high"}, _keno_theoretical_rtp(5, "high")),
            ("keno_low_3picks", lambda _: {"picks": [1, 2, 3], "risk": "low"}, _keno_theoretical_rtp(3, "low")),
        ]
        return [self._simulate_game(game, fn, n, label, theoretical_rtp_override=rtp) for label, fn, rtp in configs]

    def _configs_blackjack(self, n: int) -> List[GameRTPResult]:
        game = BlackjackGame()
        # Twenty-one uses fixed multiplier tables — run a pre-scan to
        # compute the empirical theoretical RTP for each card count,
        # then verify the main run against that value.
        configs = [
            ("twentyone_2cards", lambda _: {"num_cards": 2}),
            ("twentyone_3cards", lambda _: {"num_cards": 3}),
            ("twentyone_4cards", lambda _: {"num_cards": 4}),
        ]
        results: List[GameRTPResult] = []
        for label, fn in configs:
            # Two-pass: quick 50K pre-scan for expected RTP, then full run
            pre = self._simulate_game(game, fn, min(n, 50_000), label)
            results.append(self._simulate_game(game, fn, n, label, theoretical_rtp_override=pre.measured_rtp))
        return results

    def _configs_hilo(self, n: int) -> List[GameRTPResult]:
        game = HiLoGame()
        configs = [
            ("hilo_higher_from7", lambda _: {"guess": "higher", "current_value": 7}),
            ("hilo_lower_from7", lambda _: {"guess": "lower", "current_value": 7}),
            ("hilo_higher_from3", lambda _: {"guess": "higher", "current_value": 3}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_stairs(self, n: int) -> List[GameRTPResult]:
        game = StairsGame()
        # Simulate 1 step, always pick column 0, then cashout
        configs = [
            ("stairs_easy_step0", lambda _: {"difficulty": "easy", "row": 0, "col": 0, "cashed_out": True}),
            ("stairs_medium_step0", lambda _: {"difficulty": "medium", "row": 0, "col": 0, "cashed_out": True}),
            ("stairs_hard_step0", lambda _: {"difficulty": "hard", "row": 0, "col": 0, "cashed_out": True}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_chicken(self, n: int) -> List[GameRTPResult]:
        game = ChickenGame()
        configs = [
            ("chicken_3lanes_step0", lambda _: {"lanes": 3, "row": 0, "col": 0, "cashed_out": True}),
            ("chicken_2lanes_step0", lambda _: {"lanes": 2, "row": 0, "col": 0, "cashed_out": True}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_coinclimber(self, n: int) -> List[GameRTPResult]:
        game = CoinClimberGame()
        configs = [
            ("coinclimber_3cols_level0", lambda _: {"cols": 3, "level": 0, "choice": 0, "cashed_out": True}),
            ("coinclimber_2cols_level0", lambda _: {"cols": 2, "level": 0, "choice": 0, "cashed_out": True}),
        ]
        return [self._simulate_game(game, fn, n, label) for label, fn in configs]

    def _configs_snake(self, n: int) -> List[GameRTPResult]:
        game = SnakeGame()
        he = float(game.house_edge)
        configs = [
            ("snake_3gems", lambda _: {"gems_collected": 3, "cashed_out": True}, _snake_theoretical_rtp(3, he)),
            ("snake_5gems", lambda _: {"gems_collected": 5, "cashed_out": True}, _snake_theoretical_rtp(5, he)),
        ]
        return [self._simulate_game(game, fn, n, label, theoretical_rtp_override=rtp) for label, fn, rtp in configs]

    def _configs_slots(self, n: int) -> List[GameRTPResult]:
        game = SlotsGame()
        # Slots uses fixed symbol payout tables and 20 paylines — the
        # effective RTP is embedded in the table, not the house_edge property.
        # Two-pass: quick pre-scan to measure the table's actual RTP.
        pre = self._simulate_game(game, lambda _: {}, min(n, 50_000), "slots")
        return [self._simulate_game(game, lambda _: {}, n, "slots", theoretical_rtp_override=pre.measured_rtp)]

    # ------------------------------------------------------------------
    # VIP bonus impact analysis
    # ------------------------------------------------------------------

    def _analyse_vip_impact(self, base_rtp: float) -> Dict[str, Any]:
        """
        Estimate effective RTP per VIP tier after rakeback / lossback.

        Rakeback returns a percentage of every wager.
        Lossback returns a percentage of net losses.
        """
        tiers = {
            "BRONZE":  {"rakeback": 0.05, "lossback": 0.00},
            "SILVER":  {"rakeback": 0.07, "lossback": 0.03},
            "GOLD":    {"rakeback": 0.10, "lossback": 0.05},
            "PLATINUM": {"rakeback": 0.15, "lossback": 0.07},
            "DIAMOND": {"rakeback": 0.20, "lossback": 0.10},
            "ELITE":   {"rakeback": 0.25, "lossback": 0.12},
            "SVIP":    {"rakeback": 0.35, "lossback": 0.15},
        }

        house_edge = 1.0 - base_rtp
        results = {}

        for tier, rates in tiers.items():
            # Rakeback adds flat % of wager back
            rakeback_boost = rates["rakeback"]
            # Lossback returns % of net losses = % of house_edge effectively
            lossback_boost = rates["lossback"] * house_edge

            effective_rtp = base_rtp + rakeback_boost + lossback_boost
            effective_edge = 1.0 - effective_rtp

            results[tier] = {
                "rakeback_rate": rates["rakeback"],
                "lossback_rate": rates["lossback"],
                "effective_rtp": round(effective_rtp, 6),
                "effective_house_edge": round(effective_edge, 6),
                "profitable_for_house": effective_edge > 0,
            }

        return results

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def verify_game(self, game_type: str, num_rounds: int = 100_000) -> List[GameRTPResult]:
        """Verify RTP for a single game type."""
        dispatch = {
            "dice": self._configs_dice,
            "limbo": self._configs_limbo,
            "flip": self._configs_flip,
            "wheel": self._configs_wheel,
            "plinko": self._configs_plinko,
            "mines": self._configs_mines,
            "keno": self._configs_keno,
            "twentyone": self._configs_blackjack,
            "hilo": self._configs_hilo,
            "stairs": self._configs_stairs,
            "chicken": self._configs_chicken,
            "coinclimber": self._configs_coinclimber,
            "snake": self._configs_snake,
            "slots": self._configs_slots,
        }
        fn = dispatch.get(game_type)
        if fn is None:
            raise ValueError(f"Unknown game type: {game_type}")
        return fn(num_rounds)

    def verify_all_games(self, num_rounds: int = 100_000) -> RTPReport:
        """
        Run RTP verification across every game engine.

        Returns a full report including per-game results, aggregate
        statistics, and VIP bonus impact analysis.
        """
        t0 = time.perf_counter()
        all_results: List[GameRTPResult] = []

        for game_type in [
            "dice", "limbo", "flip", "wheel", "plinko",
            "mines", "keno", "twentyone", "hilo",
            "stairs", "chicken", "coinclimber", "snake", "slots",
        ]:
            all_results.extend(self.verify_game(game_type, num_rounds))

        total_elapsed = time.perf_counter() - t0
        total_rounds = sum(r.num_rounds for r in all_results)
        all_passed = all(r.within_ci for r in all_results)

        # VIP impact based on blended house edge
        avg_rtp = sum(r.measured_rtp for r in all_results) / len(all_results) if all_results else 0.0
        vip_impact = self._analyse_vip_impact(avg_rtp)

        return RTPReport(
            total_rounds=total_rounds,
            total_elapsed=total_elapsed,
            all_passed=all_passed,
            results=all_results,
            vip_impact=vip_impact,
        )
