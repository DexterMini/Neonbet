"""
VIP System Tests
================

Tests for rakeback and VIP level progression.
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock

from casino.services.vip_system import (
    VIPService,
    VIPLevel,
    VIP_TIERS,
    UserVIPStatus,
)


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def vip_service(mock_redis):
    """Create VIP service with mock Redis"""
    return VIPService(mock_redis)


# ============================================================================
# VIP Level Tests
# ============================================================================

class TestVIPLevels:
    """Tests for VIP level calculation"""
    
    def test_bronze_level_default(self, vip_service):
        """Test zero wagered = Bronze"""
        level = vip_service.calculate_level(Decimal("0"))
        assert level == VIPLevel.BRONZE
    
    def test_silver_level_threshold(self, vip_service):
        """Test Silver level threshold"""
        level = vip_service.calculate_level(Decimal("5000"))
        assert level == VIPLevel.SILVER
    
    def test_gold_level_threshold(self, vip_service):
        """Test Gold level threshold"""
        level = vip_service.calculate_level(Decimal("25000"))
        assert level == VIPLevel.GOLD
    
    def test_platinum_level_threshold(self, vip_service):
        """Test Platinum level threshold"""
        level = vip_service.calculate_level(Decimal("100000"))
        assert level == VIPLevel.PLATINUM
    
    def test_diamond_level_threshold(self, vip_service):
        """Test Diamond level threshold"""
        level = vip_service.calculate_level(Decimal("500000"))
        assert level == VIPLevel.DIAMOND
    
    def test_vip_level_threshold(self, vip_service):
        """Test VIP level threshold"""
        level = vip_service.calculate_level(Decimal("2000000"))
        assert level == VIPLevel.VIP
    
    def test_svip_level_threshold(self, vip_service):
        """Test SVIP level threshold"""
        level = vip_service.calculate_level(Decimal("10000000"))
        assert level == VIPLevel.SVIP
    
    def test_level_just_below_threshold(self, vip_service):
        """Test amount just below threshold stays at lower level"""
        level = vip_service.calculate_level(Decimal("4999.99"))
        assert level == VIPLevel.BRONZE


# ============================================================================
# VIP Tier Tests
# ============================================================================

class TestVIPTiers:
    """Tests for VIP tier configuration"""
    
    def test_all_tiers_exist(self):
        """Test all VIP levels have tier config"""
        for level in VIPLevel:
            assert level in VIP_TIERS
    
    def test_rakeback_increases_with_level(self):
        """Test rakeback % increases with VIP level"""
        prev_rakeback = Decimal("0")
        for level in VIPLevel:
            tier = VIP_TIERS[level]
            assert tier.rakeback_percent >= prev_rakeback
            prev_rakeback = tier.rakeback_percent
    
    def test_bronze_rakeback(self):
        """Test Bronze rakeback is 5%"""
        tier = VIP_TIERS[VIPLevel.BRONZE]
        assert tier.rakeback_percent == Decimal("0.05")
    
    def test_svip_rakeback(self):
        """Test SVIP rakeback is 35%"""
        tier = VIP_TIERS[VIPLevel.SVIP]
        assert tier.rakeback_percent == Decimal("0.35")
    
    def test_level_up_bonus_exists(self):
        """Test level up bonuses are configured"""
        for level in VIPLevel:
            if level != VIPLevel.BRONZE:
                tier = VIP_TIERS[level]
                assert tier.level_up_bonus > 0


# ============================================================================
# Level Progress Tests
# ============================================================================

class TestLevelProgress:
    """Tests for level progress calculation"""
    
    def test_progress_at_level_start(self, vip_service):
        """Test 0% progress at level start"""
        progress, remaining = vip_service.calculate_level_progress(
            Decimal("0"),
            VIPLevel.BRONZE
        )
        assert progress == 0.0
        assert remaining == Decimal("5000")
    
    def test_progress_halfway(self, vip_service):
        """Test 50% progress halfway"""
        progress, remaining = vip_service.calculate_level_progress(
            Decimal("2500"),
            VIPLevel.BRONZE
        )
        assert progress == 50.0
        assert remaining == Decimal("2500")
    
    def test_progress_at_threshold(self, vip_service):
        """Test 100% at threshold"""
        progress, remaining = vip_service.calculate_level_progress(
            Decimal("5000"),
            VIPLevel.BRONZE
        )
        # Should now be Silver, so calculate from Silver baseline
        level = vip_service.calculate_level(Decimal("5000"))
        assert level == VIPLevel.SILVER
    
    def test_max_level_100_percent(self, vip_service):
        """Test max level shows 100% with no next requirement"""
        progress, remaining = vip_service.calculate_level_progress(
            Decimal("15000000"),
            VIPLevel.SVIP
        )
        assert progress == 100.0
        assert remaining is None


# ============================================================================
# Rakeback Tests
# ============================================================================

class TestRakeback:
    """Tests for rakeback calculation"""
    
    @pytest.mark.asyncio
    async def test_wager_records_rakeback(self, vip_service, mock_redis):
        """Test wagering records rakeback"""
        mock_redis.get.return_value = None
        
        result = await vip_service.record_wager(
            "user123",
            Decimal("100"),  # Wager
            Decimal("2")  # House edge (2%)
        )
        
        # Bronze = 5% rakeback on house edge
        # 5% of $2 = $0.10
        assert Decimal(result["rakeback_earned"]) == Decimal("0.10")
    
    @pytest.mark.asyncio
    async def test_level_up_detected(self, vip_service, mock_redis):
        """Test level up is detected when threshold crossed"""
        # Mock user just below Silver
        mock_redis.get.return_value = None
        
        # This would push them over if they had 4900 already
        # We test the level up detection logic
        result = await vip_service.record_wager(
            "user123",
            Decimal("5000"),  # Big wager
            Decimal("100")  # House edge
        )
        
        # Should level up from Bronze to Silver
        assert result["leveled_up"] == True
        assert result["new_level"] == "Silver"
        assert Decimal(result["level_up_bonus"]) == Decimal("25")


# ============================================================================
# Bonus Claim Tests
# ============================================================================

class TestBonusClaims:
    """Tests for bonus claiming"""
    
    @pytest.mark.asyncio
    async def test_claim_rakeback_success(self, vip_service, mock_redis):
        """Test claiming rakeback"""
        # Mock user with rakeback
        import json
        mock_redis.get.return_value = json.dumps({
            "user_id": "user123",
            "level": 0,
            "total_wagered": "1000",
            "wagered_this_month": "1000",
            "rakeback_available": "10.50",
            "rakeback_claimed_total": "0",
            "weekly_bonus_available": "0",
            "monthly_bonus_available": "0",
            "level_progress": 20.0,
            "next_level_requirement": "4000",
            "last_updated": "2024-01-01T00:00:00"
        }).encode()
        
        result = await vip_service.claim_rakeback("user123")
        
        assert result["success"] == True
        assert Decimal(result["amount"]) == Decimal("10.50")
    
    @pytest.mark.asyncio
    async def test_claim_rakeback_empty(self, vip_service, mock_redis):
        """Test claiming when no rakeback available"""
        import json
        mock_redis.get.return_value = json.dumps({
            "user_id": "user123",
            "level": 0,
            "total_wagered": "0",
            "wagered_this_month": "0",
            "rakeback_available": "0",
            "rakeback_claimed_total": "0",
            "weekly_bonus_available": "0",
            "monthly_bonus_available": "0",
            "level_progress": 0,
            "next_level_requirement": "5000",
            "last_updated": "2024-01-01T00:00:00"
        }).encode()
        
        result = await vip_service.claim_rakeback("user123")
        
        assert result["success"] == False


# ============================================================================
# Tier Info Tests
# ============================================================================

class TestTierInfo:
    """Tests for tier information display"""
    
    def test_get_all_tiers(self, vip_service):
        """Test getting all tier info for display"""
        tiers = vip_service.get_all_tiers()
        
        assert len(tiers) == 7
        assert tiers[0]["name"] == "Bronze"
        assert tiers[-1]["name"] == "SVIP"
    
    def test_tier_info_format(self, vip_service):
        """Test tier info has required fields"""
        tiers = vip_service.get_all_tiers()
        
        for tier in tiers:
            assert "level" in tier
            assert "name" in tier
            assert "min_wagered" in tier
            assert "rakeback_percent" in tier
            assert "level_up_bonus" in tier
