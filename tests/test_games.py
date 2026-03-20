"""
Game Engine Tests
=================

Unit tests for all game engines.
"""

import pytest
from decimal import Decimal
from dataclasses import dataclass

from casino.games.engines import (
    DiceGame,
    LimboGame,
    MinesGame,
    PlinkoGame,
    WheelGame,
    GameOutcome,
    get_game,
    GAMES,
)
from casino.services.provably_fair import GameResult


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def game_result_win():
    """Game result that should produce a win for most games"""
    return GameResult(
        raw_hash="a" * 64,  # High values
        raw_value=int("aaaaaaaa", 16),
        normalized=0.75,
        server_seed_hash="hash123",
        client_seed="client123",
        nonce=1
    )


@pytest.fixture
def game_result_lose():
    """Game result that should produce a loss for most games"""
    return GameResult(
        raw_hash="1" * 64,  # Low values
        raw_value=int("11111111", 16),
        normalized=0.25,
        server_seed_hash="hash123",
        client_seed="client123",
        nonce=1
    )


# ============================================================================
# Dice Game Tests
# ============================================================================

class TestDiceGame:
    """Tests for the Dice game engine"""
    
    def test_dice_game_exists(self):
        """Test dice game is in registry"""
        assert "dice" in GAMES
        assert get_game("dice") is not None
    
    def test_dice_validate_game_data_valid(self):
        """Test valid dice game data"""
        game = DiceGame()
        assert game.validate_game_data({"target": 50, "direction": "over"})
        assert game.validate_game_data({"target": 50, "direction": "under"})
        assert game.validate_game_data({"target": 25.5, "direction": "over"})
    
    def test_dice_validate_game_data_invalid(self):
        """Test invalid dice game data"""
        game = DiceGame()
        assert not game.validate_game_data({})
        assert not game.validate_game_data({"target": 50})
        assert not game.validate_game_data({"direction": "over"})
        assert not game.validate_game_data({"target": 50, "direction": "invalid"})
        assert not game.validate_game_data({"target": 99.5, "direction": "over"})
        assert not game.validate_game_data({"target": 0.5, "direction": "under"})
    
    def test_dice_win_chance_over(self):
        """Test win chance calculation for over"""
        game = DiceGame()
        # Target 50, over: win on 50.01-99.99 = 49.99%
        assert game.calculate_win_chance(Decimal("50"), "over") == Decimal("49.99")
        # Target 25, over: win on 25.01-99.99 = 74.99%
        assert game.calculate_win_chance(Decimal("25"), "over") == Decimal("74.99")
    
    def test_dice_win_chance_under(self):
        """Test win chance calculation for under"""
        game = DiceGame()
        # Target 50, under: win on 0-49.99 = 50%
        assert game.calculate_win_chance(Decimal("50"), "under") == Decimal("50")
    
    def test_dice_multiplier_calculation(self):
        """Test multiplier calculation"""
        game = DiceGame()
        # 50% win chance with 3% house edge = (97/50) = 1.94x
        multiplier = game.calculate_multiplier(Decimal("50"))
        assert Decimal("1.93") < multiplier < Decimal("1.95")
    
    def test_dice_win_over(self, game_result_win):
        """Test dice win when betting over"""
        game = DiceGame()
        # normalized=0.75 -> roll=75.00, target=50, over -> WIN
        result = game.calculate_result(
            game_result_win,
            Decimal("10"),
            {"target": 50, "direction": "over"}
        )
        assert result.outcome == GameOutcome.WIN
        assert result.payout > Decimal("10")
        assert result.result_data["roll"] == 75.0
    
    def test_dice_lose_over(self, game_result_lose):
        """Test dice loss when betting over"""
        game = DiceGame()
        # normalized=0.25 -> roll=25.00, target=50, over -> LOSE
        result = game.calculate_result(
            game_result_lose,
            Decimal("10"),
            {"target": 50, "direction": "over"}
        )
        assert result.outcome == GameOutcome.LOSE
        assert result.payout == Decimal("0")
        assert result.profit == Decimal("-10")
    
    def test_dice_bet_validation(self):
        """Test bet amount validation"""
        game = DiceGame()
        valid, msg = game.validate_bet(Decimal("5"))
        assert valid
        
        valid, msg = game.validate_bet(Decimal("0.01"))
        assert not valid  # Below minimum
        
        valid, msg = game.validate_bet(Decimal("50000"))
        assert not valid  # Above maximum


# ============================================================================
# Limbo Game Tests
# ============================================================================

class TestLimboGame:
    """Tests for the Limbo game engine"""
    
    def test_limbo_game_exists(self):
        """Test limbo game is in registry"""
        assert "limbo" in GAMES
        assert get_game("limbo") is not None
    
    def test_limbo_validate_game_data(self):
        """Test limbo game data validation"""
        game = LimboGame()
        assert game.validate_game_data({"target_multiplier": 2.0})
        assert game.validate_game_data({"target_multiplier": 1.01})
        assert game.validate_game_data({"target_multiplier": 1000})
        assert not game.validate_game_data({})
        assert not game.validate_game_data({"target_multiplier": 1.00})  # Too low
        assert not game.validate_game_data({"target_multiplier": 2000000})  # Too high
    
    def test_limbo_low_target_win(self):
        """Test limbo with low target should win more often"""
        game = LimboGame()
        result = game.calculate_result(
            GameResult(
                raw_hash="5" * 64,
                raw_value=int("55555555", 16),
                normalized=0.5,
                server_seed_hash="hash",
                client_seed="client",
                nonce=1
            ),
            Decimal("10"),
            {"target_multiplier": 1.5}
        )
        # With normalized=0.5, generated multiplier should be around 1.96x
        # Target 1.5x should win
        assert result.outcome == GameOutcome.WIN
        assert result.multiplier == Decimal("1.5")
        assert result.payout == Decimal("15")
    
    def test_limbo_high_target_lose(self):
        """Test limbo with high target and low roll"""
        game = LimboGame()
        result = game.calculate_result(
            GameResult(
                raw_hash="1" * 64,
                raw_value=int("11111111", 16),
                normalized=0.1,
                server_seed_hash="hash",
                client_seed="client",
                nonce=1
            ),
            Decimal("10"),
            {"target_multiplier": 10}
        )
        # Low normalized value = low multiplier, won't reach 10x
        assert result.outcome == GameOutcome.LOSE


# ============================================================================
# Mines Game Tests
# ============================================================================

class TestMinesGame:
    """Tests for the Mines game engine"""
    
    def test_mines_game_exists(self):
        """Test mines game is in registry"""
        assert "mines" in GAMES
        assert get_game("mines") is not None
    
    def test_mines_validate_game_data(self):
        """Test mines game data validation"""
        game = MinesGame()
        assert game.validate_game_data({"mine_count": 5})
        assert game.validate_game_data({"mine_count": 1})
        assert game.validate_game_data({"mine_count": 24})
        assert not game.validate_game_data({})
        assert not game.validate_game_data({"mine_count": 0})
        assert not game.validate_game_data({"mine_count": 25})
    
    def test_mines_generate_positions(self):
        """Test mine position generation is deterministic"""
        game = MinesGame()
        result = GameResult(
            raw_hash="abcd1234" * 8,
            raw_value=int("abcd1234", 16),
            normalized=0.5,
            server_seed_hash="hash",
            client_seed="client",
            nonce=1
        )
        positions1 = game.generate_mine_positions(result, 5)
        positions2 = game.generate_mine_positions(result, 5)
        assert positions1 == positions2
        assert len(positions1) == 5
        assert all(0 <= p < 25 for p in positions1)
    
    def test_mines_multiplier_increases(self):
        """Test multiplier increases with reveals"""
        game = MinesGame()
        m1 = game.calculate_multiplier_for_reveals(5, 1)
        m2 = game.calculate_multiplier_for_reveals(5, 5)
        m3 = game.calculate_multiplier_for_reveals(5, 10)
        assert m1 < m2 < m3
    
    def test_mines_more_mines_higher_multiplier(self):
        """Test more mines = higher multiplier per reveal"""
        game = MinesGame()
        m_few = game.calculate_multiplier_for_reveals(3, 5)
        m_many = game.calculate_multiplier_for_reveals(10, 5)
        assert m_few < m_many
    
    def test_mines_hit_mine_loses(self):
        """Test hitting a mine loses the bet"""
        game = MinesGame()
        result = GameResult(
            raw_hash="00" * 32,
            raw_value=0,
            normalized=0,
            server_seed_hash="hash",
            client_seed="client",
            nonce=1
        )
        mines = game.generate_mine_positions(result, 5)
        
        bet_result = game.calculate_result(
            result,
            Decimal("10"),
            {
                "mine_count": 5,
                "revealed_tiles": [mines[0]],  # Click on a mine
                "cashed_out": False
            }
        )
        assert bet_result.outcome == GameOutcome.LOSE


# ============================================================================
# Plinko Game Tests
# ============================================================================

class TestPlinkoGame:
    """Tests for the Plinko game engine"""
    
    def test_plinko_game_exists(self):
        """Test plinko game is in registry"""
        assert "plinko" in GAMES
        assert get_game("plinko") is not None
    
    def test_plinko_validate_game_data(self):
        """Test plinko game data validation"""
        game = PlinkoGame()
        assert game.validate_game_data({"rows": 16, "risk": "medium"})
        assert game.validate_game_data({"rows": 12, "risk": "low"})
        assert game.validate_game_data({"rows": 8, "risk": "high"})
        assert not game.validate_game_data({})
        assert not game.validate_game_data({"rows": 7, "risk": "medium"})  # Invalid rows
        assert not game.validate_game_data({"rows": 16, "risk": "extreme"})  # Invalid risk
    
    def test_plinko_path_deterministic(self):
        """Test path generation is deterministic"""
        game = PlinkoGame()
        result = GameResult(
            raw_hash="abcdef12" * 8,
            raw_value=int("abcdef12", 16),
            normalized=0.5,
            server_seed_hash="hash",
            client_seed="client",
            nonce=1
        )
        path1 = game.generate_path(result, 16)
        path2 = game.generate_path(result, 16)
        assert path1 == path2
        assert len(path1) == 16
        assert all(d in ["L", "R"] for d in path1)
    
    def test_plinko_result_has_multiplier(self):
        """Test plinko result includes multiplier"""
        game = PlinkoGame()
        result = game.calculate_result(
            GameResult(
                raw_hash="ff" * 32,  # All R
                raw_value=int("ffffffff", 16),
                normalized=0.5,
                server_seed_hash="hash",
                client_seed="client",
                nonce=1
            ),
            Decimal("10"),
            {"rows": 16, "risk": "high"}
        )
        assert result.multiplier > 0
        assert "path" in result.result_data
        assert "final_position" in result.result_data


# ============================================================================
# Wheel Game Tests
# ============================================================================

class TestWheelGame:
    """Tests for the Wheel game engine"""
    
    def test_wheel_game_exists(self):
        """Test wheel game is in registry"""
        assert "wheel" in GAMES
        assert get_game("wheel") is not None
    
    def test_wheel_validate_game_data(self):
        """Test wheel accepts empty game data"""
        game = WheelGame()
        assert game.validate_game_data({})
    
    def test_wheel_has_segments(self):
        """Test wheel has proper segment configuration"""
        game = WheelGame()
        assert len(game.wheel) == 50
        colors = set(s["color"] for s in game.wheel)
        assert "gray" in colors
        assert "gold" in colors
    
    def test_wheel_result_deterministic(self):
        """Test wheel result is deterministic"""
        game = WheelGame()
        result1 = game.calculate_result(
            GameResult(
                raw_hash="abcd" * 16,
                raw_value=int("abcdabcd", 16),
                normalized=0.5,
                server_seed_hash="hash",
                client_seed="client",
                nonce=1
            ),
            Decimal("10"),
            {}
        )
        result2 = game.calculate_result(
            GameResult(
                raw_hash="abcd" * 16,
                raw_value=int("abcdabcd", 16),
                normalized=0.5,
                server_seed_hash="hash",
                client_seed="client",
                nonce=1
            ),
            Decimal("10"),
            {}
        )
        assert result1.multiplier == result2.multiplier
        assert result1.result_data["color"] == result2.result_data["color"]


# ============================================================================
# Game Registry Tests
# ============================================================================

class TestGameRegistry:
    """Tests for game registry"""
    
    def test_all_games_registered(self):
        """Test all expected games are registered"""
        expected = ["dice", "limbo", "mines", "plinko", "wheel"]
        for game_type in expected:
            assert game_type in GAMES
            assert get_game(game_type) is not None
    
    def test_invalid_game_returns_none(self):
        """Test invalid game type returns None"""
        assert get_game("invalid") is None
        assert get_game("") is None
        assert get_game("DICE") is None  # Case sensitive
