"""
Provably Fair Tests
===================

Tests for the provably fair random number generation.
"""

import pytest
from decimal import Decimal
import hashlib
import hmac

from casino.services.provably_fair import ProvablyFairEngine, GameResult


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def known_seeds():
    """Known seeds for testing deterministic outcomes"""
    return {
        "server_seed": "server_secret_seed_12345",
        "client_seed": "client_public_seed_67890",
        "nonce": 1
    }


# ============================================================================
# Provably Fair Tests
# ============================================================================

class TestProvablyFair:
    """Tests for provably fair system"""
    
    def test_hash_is_deterministic(self, known_seeds):
        """Test same inputs produce same hash"""
        combined = f"{known_seeds['server_seed']}:{known_seeds['client_seed']}:{known_seeds['nonce']}"
        
        hash1 = hashlib.sha256(combined.encode()).hexdigest()
        hash2 = hashlib.sha256(combined.encode()).hexdigest()
        
        assert hash1 == hash2
        assert len(hash1) == 64
    
    def test_different_nonce_different_hash(self, known_seeds):
        """Test different nonce produces different hash"""
        combined1 = f"{known_seeds['server_seed']}:{known_seeds['client_seed']}:1"
        combined2 = f"{known_seeds['server_seed']}:{known_seeds['client_seed']}:2"
        
        hash1 = hashlib.sha256(combined1.encode()).hexdigest()
        hash2 = hashlib.sha256(combined2.encode()).hexdigest()
        
        assert hash1 != hash2
    
    def test_different_client_seed_different_hash(self, known_seeds):
        """Test different client seed produces different hash"""
        combined1 = f"{known_seeds['server_seed']}:client1:1"
        combined2 = f"{known_seeds['server_seed']}:client2:1"
        
        hash1 = hashlib.sha256(combined1.encode()).hexdigest()
        hash2 = hashlib.sha256(combined2.encode()).hexdigest()
        
        assert hash1 != hash2
    
    def test_normalized_value_range(self):
        """Test normalized value is always in [0, 1)"""
        for i in range(100):
            combined = f"server:client:{i}"
            raw_hash = hashlib.sha256(combined.encode()).hexdigest()
            normalized = int(raw_hash[:8], 16) / (16**8)
            
            assert 0 <= normalized < 1
    
    def test_server_seed_hash_verification(self, known_seeds):
        """Test server seed hash can be verified"""
        server_seed = known_seeds["server_seed"]
        seed_hash = hashlib.sha256(server_seed.encode()).hexdigest()
        
        # Later verification
        verify_hash = hashlib.sha256(server_seed.encode()).hexdigest()
        assert seed_hash == verify_hash
    
    def test_hmac_generation(self, known_seeds):
        """Test HMAC-SHA256 generation"""
        message = f"{known_seeds['client_seed']}:{known_seeds['nonce']}"
        
        hmac_result = hmac.new(
            known_seeds["server_seed"].encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        assert len(hmac_result) == 64
        
        # Verify deterministic
        hmac_result2 = hmac.new(
            known_seeds["server_seed"].encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        
        assert hmac_result == hmac_result2


class TestGameResult:
    """Tests for GameResult dataclass"""
    
    def test_game_result_creation(self):
        """Test GameResult can be created"""
        result = GameResult(
            raw_hash="a" * 64,
            raw_value=int("aaaaaaaa", 16),
            normalized=0.5,
            server_seed_hash="hash123",
            client_seed="client123",
            nonce=1
        )
        
        assert result.raw_hash == "a" * 64
        assert result.normalized == 0.5
        assert result.nonce == 1
    
    def test_game_result_normalized_to_dice(self):
        """Test converting normalized value to dice roll"""
        result = GameResult(
            raw_hash="8" * 64,
            raw_value=int("88888888", 16),
            normalized=0.5,
            server_seed_hash="hash",
            client_seed="client",
            nonce=1
        )
        
        # Dice roll is 0-99.99, so normalized * 100
        dice_roll = round(result.normalized * 100, 2)
        assert dice_roll == 50.0
    
    def test_distribution_fairness(self):
        """Test that hash distribution is roughly uniform"""
        results = []
        for i in range(1000):
            combined = f"server:client:{i}"
            raw_hash = hashlib.sha256(combined.encode()).hexdigest()
            normalized = int(raw_hash[:8], 16) / (16**8)
            results.append(normalized)
        
        # Check roughly uniform distribution
        avg = sum(results) / len(results)
        assert 0.45 < avg < 0.55  # Should be close to 0.5
        
        # Check we get values across the range
        below_half = sum(1 for r in results if r < 0.5)
        assert 400 < below_half < 600  # Roughly 50%
