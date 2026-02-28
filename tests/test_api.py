"""
API Endpoint Tests
==================

Tests for FastAPI endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from decimal import Decimal

from casino.api.main import app


# ============================================================================
# Test Client
# ============================================================================

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


# ============================================================================
# Health Check Tests
# ============================================================================

class TestHealthEndpoints:
    """Tests for health check endpoints"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
    
    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data


# ============================================================================
# Auth Endpoint Tests
# ============================================================================

class TestAuthEndpoints:
    """Tests for authentication endpoints"""
    
    def test_register_success(self, client):
        """Test successful registration"""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "SecurePass123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "session_token" in data
        assert data["user"]["username"] == "testuser"
    
    def test_register_invalid_email(self, client):
        """Test registration with invalid email"""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "invalid-email",
            "password": "SecurePass123"
        })
        
        assert response.status_code == 422  # Validation error
    
    def test_register_weak_password(self, client):
        """Test registration with weak password"""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "weak"  # Too short, no uppercase/number
        })
        
        assert response.status_code == 422
    
    def test_login_success(self, client):
        """Test successful login"""
        response = client.post("/api/v1/auth/login", json={
            "username_or_email": "testuser",
            "password": "SecurePass123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "session_token" in data


# ============================================================================
# Betting Endpoint Tests
# ============================================================================

class TestBettingEndpoints:
    """Tests for betting endpoints"""
    
    def test_place_bet_requires_auth(self, client):
        """Test placing bet requires authorization"""
        response = client.post("/api/v1/bets/place", json={
            "game_type": "dice",
            "bet_amount": 10,
            "game_data": {"target": 50, "direction": "over"}
        })
        
        assert response.status_code == 422  # Missing auth header
    
    def test_place_bet_requires_idempotency(self, client):
        """Test placing bet requires idempotency key"""
        response = client.post(
            "/api/v1/bets/place",
            json={
                "game_type": "dice",
                "bet_amount": 10,
                "game_data": {"target": 50, "direction": "over"}
            },
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 422  # Missing idempotency key
    
    def test_place_bet_success(self, client):
        """Test successful bet placement"""
        response = client.post(
            "/api/v1/bets/place",
            json={
                "game_type": "dice",
                "bet_amount": 10,
                "game_data": {"target": 50, "direction": "over"}
            },
            headers={
                "Authorization": "Bearer test_token",
                "X-Idempotency-Key": "unique-key-123"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bet_id" in data
        assert data["game_type"] == "dice"
        assert data["outcome"] in ["win", "lose"]
        assert "server_seed_hash" in data
    
    def test_place_bet_invalid_game(self, client):
        """Test bet with invalid game type"""
        response = client.post(
            "/api/v1/bets/place",
            json={
                "game_type": "invalid_game",
                "bet_amount": 10,
                "game_data": {}
            },
            headers={
                "Authorization": "Bearer test_token",
                "X-Idempotency-Key": "unique-key-456"
            }
        )
        
        assert response.status_code == 422
    
    def test_verify_bet(self, client):
        """Test bet verification endpoint"""
        response = client.post("/api/v1/bets/verify", json={
            "server_seed": "test_server_seed",
            "client_seed": "test_client_seed",
            "nonce": 1,
            "game_type": "dice",
            "game_data": {"target": 50, "direction": "over"}
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["verified"] == True
        assert "server_seed_hash" in data
        assert "result_data" in data
    
    def test_get_bet_history(self, client):
        """Test getting bet history"""
        response = client.get(
            "/api/v1/bets/history",
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "bets" in data
        assert "total" in data


# ============================================================================
# Wallet Endpoint Tests
# ============================================================================

class TestWalletEndpoints:
    """Tests for wallet endpoints"""
    
    def test_get_balances(self, client):
        """Test getting all balances"""
        response = client.get(
            "/api/v1/wallet/balances",
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "balances" in data
        assert "total_usd" in data
    
    def test_get_specific_balance(self, client):
        """Test getting specific currency balance"""
        response = client.get(
            "/api/v1/wallet/balance/BTC",
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "BTC"
        assert "available" in data
        assert "locked" in data
    
    def test_get_invalid_currency(self, client):
        """Test getting balance for invalid currency"""
        response = client.get(
            "/api/v1/wallet/balance/INVALID",
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 400
    
    def test_get_deposit_address(self, client):
        """Test getting deposit address"""
        response = client.get(
            "/api/v1/wallet/deposit/address/BTC",
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "BTC"
        assert "address" in data
        assert "network" in data
        assert "confirmations_required" in data
    
    def test_withdraw_requires_idempotency(self, client):
        """Test withdrawal requires idempotency key"""
        response = client.post(
            "/api/v1/wallet/withdraw",
            json={
                "currency": "BTC",
                "amount": 0.01,
                "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
            },
            headers={"Authorization": "Bearer test_token"}
        )
        
        assert response.status_code == 422


# ============================================================================
# Admin Endpoint Tests
# ============================================================================

class TestAdminEndpoints:
    """Tests for admin endpoints"""
    
    def test_system_stats(self, client):
        """Test getting system stats"""
        response = client.get(
            "/api/v1/admin/stats/overview",
            headers={"Authorization": "Bearer admin_token"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "active_users_24h" in data
        assert "total_bets_24h" in data
        assert "gross_gaming_revenue_24h" in data
