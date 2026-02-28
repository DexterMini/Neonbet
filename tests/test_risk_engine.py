"""
Risk Engine Tests
=================

Tests for fraud detection and velocity limiting.
"""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta, UTC
from unittest.mock import AsyncMock

from casino.services.risk_engine import (
    RiskEngine,
    RiskLevel,
    RiskAction,
    AlertType,
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def risk_engine(mock_redis):
    """Create risk engine with mock Redis"""
    return RiskEngine(mock_redis)


@pytest.fixture
def low_risk_context():
    """Context for a low-risk user"""
    return {
        "account_age_days": 365,
        "kyc_level": 2,
        "total_deposited": 10000,
        "total_withdrawn": 3000,
        "win_rate": 0.48,
        "expected_win_rate": 0.49,
        "avg_bet": 50,
        "max_bet": 200,
        "ip_changes_24h": 1,
        "device_changes_24h": 0,
        "unique_hours_played_24h": 5,
    }


@pytest.fixture
def high_risk_context():
    """Context for a high-risk user"""
    return {
        "account_age_days": 0,  # Brand new
        "kyc_level": 0,  # No KYC
        "total_deposited": 100,
        "total_withdrawn": 90,  # Almost everything
        "win_rate": 0.65,  # Abnormally high
        "expected_win_rate": 0.49,
        "avg_bet": 10,
        "max_bet": 1000,  # Huge variance
        "ip_changes_24h": 10,
        "device_changes_24h": 5,
        "unique_hours_played_24h": 22,  # Almost 24/7
    }


# ============================================================================
# Risk Score Tests
# ============================================================================

class TestRiskScoring:
    """Tests for risk score calculation"""
    
    @pytest.mark.asyncio
    async def test_low_risk_user(self, risk_engine, low_risk_context):
        """Test low-risk user gets low score"""
        score = await risk_engine.calculate_risk_score("user123", low_risk_context)
        
        assert score.level == RiskLevel.LOW
        assert score.score < 25
    
    @pytest.mark.asyncio
    async def test_high_risk_user(self, risk_engine, high_risk_context):
        """Test high-risk user gets high score"""
        score = await risk_engine.calculate_risk_score("user123", high_risk_context)
        
        assert score.level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        assert score.score >= 50
    
    @pytest.mark.asyncio
    async def test_new_account_penalty(self, risk_engine, low_risk_context):
        """Test new accounts get risk penalty"""
        low_risk_context["account_age_days"] = 0
        score = await risk_engine.calculate_risk_score("user123", low_risk_context)
        
        assert "new_account" in score.factors
        assert score.factors["new_account"] == 30
    
    @pytest.mark.asyncio
    async def test_no_kyc_penalty(self, risk_engine, low_risk_context):
        """Test no KYC gets risk penalty"""
        low_risk_context["kyc_level"] = 0
        score = await risk_engine.calculate_risk_score("user123", low_risk_context)
        
        assert "no_kyc" in score.factors
    
    @pytest.mark.asyncio
    async def test_abnormal_win_rate_detected(self, risk_engine, low_risk_context):
        """Test abnormal win rate is flagged"""
        low_risk_context["win_rate"] = 0.70
        low_risk_context["expected_win_rate"] = 0.49
        score = await risk_engine.calculate_risk_score("user123", low_risk_context)
        
        assert "abnormal_win_rate" in score.factors


# ============================================================================
# Velocity Limit Tests
# ============================================================================

class TestVelocityLimits:
    """Tests for velocity limiting"""
    
    @pytest.mark.asyncio
    async def test_velocity_allows_normal_usage(self, risk_engine):
        """Test normal usage is allowed"""
        allowed, action = await risk_engine.check_velocity("user123", "bets_per_minute")
        assert allowed
        assert action is None
    
    @pytest.mark.asyncio
    async def test_velocity_increments(self, risk_engine, mock_redis):
        """Test velocity counter increments"""
        await risk_engine.increment_velocity("user123", "bets_per_minute")
        
        # Check Redis was called
        mock_redis.pipeline.assert_called()
    
    @pytest.mark.asyncio
    async def test_velocity_breach_blocks(self, risk_engine, mock_redis):
        """Test exceeding velocity limit triggers action"""
        # Mock exceeded count
        mock_redis.get.return_value = b"100"  # Exceeds limit
        
        allowed, action = await risk_engine.check_velocity("user123", "bets_per_minute")
        
        assert not allowed
        assert action == RiskAction.DELAY


# ============================================================================
# Withdrawal Risk Tests
# ============================================================================

class TestWithdrawalRisk:
    """Tests for withdrawal risk assessment"""
    
    @pytest.mark.asyncio
    async def test_normal_withdrawal_allowed(self, risk_engine):
        """Test normal withdrawal is allowed"""
        context = {
            "total_deposited": 10000,
            "total_withdrawn": 2000,
            "account_age_days": 90,
            "kyc_level": 2,
            "minutes_since_last_deposit": 1440  # 24 hours
        }
        
        action, reason = await risk_engine.assess_withdrawal_risk(
            "user123",
            Decimal("500"),
            context
        )
        
        assert action == RiskAction.ALLOW
    
    @pytest.mark.asyncio
    async def test_no_kyc_blocks_large_withdrawal(self, risk_engine):
        """Test large withdrawal blocked without KYC"""
        context = {
            "total_deposited": 10000,
            "total_withdrawn": 0,
            "account_age_days": 30,
            "kyc_level": 0,  # No KYC
            "minutes_since_last_deposit": 1440
        }
        
        action, reason = await risk_engine.assess_withdrawal_risk(
            "user123",
            Decimal("1000"),  # Over $500 limit
            context
        )
        
        assert action == RiskAction.BLOCK
        assert "KYC required" in reason
    
    @pytest.mark.asyncio
    async def test_rapid_deposit_withdraw_delayed(self, risk_engine):
        """Test rapid deposit-withdraw pattern is delayed"""
        context = {
            "total_deposited": 1000,
            "total_withdrawn": 0,
            "account_age_days": 30,
            "kyc_level": 2,
            "minutes_since_last_deposit": 10  # Just deposited
        }
        
        action, reason = await risk_engine.assess_withdrawal_risk(
            "user123",
            Decimal("900"),  # 90% of deposit
            context
        )
        
        assert action == RiskAction.DELAY


# ============================================================================
# Bet Risk Tests
# ============================================================================

class TestBetRisk:
    """Tests for bet risk assessment"""
    
    @pytest.mark.asyncio
    async def test_normal_bet_allowed(self, risk_engine):
        """Test normal bet is allowed"""
        context = {
            "max_single_win": 1000000,
            "user_avg_bet": 50
        }
        
        action, reason = await risk_engine.assess_bet_risk(
            "user123",
            Decimal("50"),
            "dice",
            Decimal("100"),  # Potential win
            context
        )
        
        assert action == RiskAction.ALLOW
    
    @pytest.mark.asyncio
    async def test_exceeds_max_win_blocked(self, risk_engine):
        """Test bet exceeding max win is blocked"""
        context = {
            "max_single_win": 1000,
            "user_avg_bet": 50
        }
        
        action, reason = await risk_engine.assess_bet_risk(
            "user123",
            Decimal("100"),
            "limbo",
            Decimal("5000"),  # Over max
            context
        )
        
        assert action == RiskAction.BLOCK


# ============================================================================
# Device Fingerprint Tests
# ============================================================================

class TestDeviceFingerprint:
    """Tests for device fingerprinting"""
    
    def test_fingerprint_generation(self, risk_engine):
        """Test fingerprint is generated deterministically"""
        device_data = {
            "user_agent": "Mozilla/5.0",
            "screen_resolution": "1920x1080",
            "timezone": "UTC",
            "language": "en-US"
        }
        
        fp1 = risk_engine.generate_device_fingerprint(device_data)
        fp2 = risk_engine.generate_device_fingerprint(device_data)
        
        assert fp1 == fp2
        assert len(fp1) == 32
    
    def test_different_devices_different_fingerprint(self, risk_engine):
        """Test different devices get different fingerprints"""
        fp1 = risk_engine.generate_device_fingerprint({
            "user_agent": "Chrome",
            "screen_resolution": "1920x1080"
        })
        fp2 = risk_engine.generate_device_fingerprint({
            "user_agent": "Firefox",
            "screen_resolution": "1920x1080"
        })
        
        assert fp1 != fp2
    
    @pytest.mark.asyncio
    async def test_new_fingerprint_clean(self, risk_engine, mock_redis):
        """Test new fingerprint is clean"""
        mock_redis.get.return_value = None
        
        is_clean, linked = await risk_engine.check_device_fingerprint(
            "user123",
            "new_fingerprint_hash"
        )
        
        assert is_clean
        assert linked is None
    
    @pytest.mark.asyncio
    async def test_linked_fingerprint_flagged(self, risk_engine, mock_redis):
        """Test fingerprint linked to another user is flagged"""
        mock_redis.get.return_value = b"other_user"
        
        is_clean, linked = await risk_engine.check_device_fingerprint(
            "user123",
            "existing_fingerprint"
        )
        
        assert not is_clean
        assert linked == "other_user"
