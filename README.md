# 🎰 Crypto Casino Platform

A fully transparent, provably fair crypto casino platform built with Python and FastAPI.

## 🚀 Features

### Games
- 🎲 **Dice** - Classic over/under dice game
- 📈 **Crash** - Multiplayer crash with real-time multiplier
- 💎 **Limbo** - Target multiplier game
- 💣 **Mines** - Grid-based mine avoidance
- 🎯 **Plinko** - Ball drop through pegs
- 🎡 **Wheel** - Fortune wheel with colored segments

### Core Technology
- **Provably Fair 2.0** - HMAC-SHA256 verifiable outcomes
- **Event-Sourced Ledger** - Complete audit trail with checksum chains
- **Multi-Currency Support** - BTC, ETH, USDT, USDC, SOL, LTC
- **Real-time Risk Engine** - Fraud detection and velocity limits
- **VIP System** - 7-tier rakeback and rewards

### Security
- **Idempotency Middleware** - Prevents double-spending
- **Circuit Breaker Pattern** - Prevents cascading failures
- **Rate Limiting** - Velocity-based protection
- **Device Fingerprinting** - Multi-account detection

## 📁 Project Structure

```
casino/
├── __init__.py
├── config.py              # Configuration management
├── api/
│   ├── __init__.py
│   ├── main.py            # FastAPI application
│   ├── routes/
│   │   ├── auth.py        # Authentication endpoints
│   │   ├── bets.py        # Betting endpoints
│   │   ├── wallet.py      # Wallet/deposit/withdraw
│   │   └── admin.py       # Admin panel endpoints
│   └── middleware/
│       ├── idempotency.py # Idempotency handling
│       └── circuit_breaker.py
├── games/
│   ├── __init__.py
│   ├── engines.py         # Dice, Limbo, Mines, Plinko, Wheel
│   └── crash.py           # Multiplayer crash game
├── models/
│   ├── __init__.py
│   └── database.py        # SQLAlchemy models
└── services/
    ├── __init__.py
    ├── ledger.py          # Event-sourced ledger
    ├── provably_fair.py   # Provably fair engine
    ├── risk_engine.py     # Fraud detection
    └── vip_system.py      # VIP/rakeback system
```

## 🛠️ Installation

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Setup

```bash
# Clone repository
git clone <repo-url>
cd casino

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
alembic upgrade head

# Start development server
uvicorn casino.api.main:app --reload
```

## 🔧 Configuration

Environment variables (`.env`):

```env
# Application
APP_ENV=development
APP_DEBUG=true
APP_SECRET_KEY=your-secret-key-min-32-chars

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=casino
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Wallet Settings
WALLET_HOT_LIMIT=100000
WALLET_MAX_SINGLE_WIN=1000000
```

## 🎮 API Documentation

When running in development mode, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Register new user |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/bets/place` | POST | Place a bet |
| `/api/v1/bets/verify` | POST | Verify bet fairness |
| `/api/v1/wallet/balances` | GET | Get all balances |
| `/api/v1/wallet/deposit/address/{currency}` | GET | Get deposit address |
| `/api/v1/wallet/withdraw` | POST | Request withdrawal |

## 🔐 Provably Fair System

Every bet uses HMAC-SHA256 for verifiable randomness:

```
hash = HMAC-SHA256(server_seed, client_seed:nonce)
result = convert_to_game_outcome(hash)
```

**Verification Process:**
1. Before bet: Server shows SHA256(server_seed) commitment
2. User provides client_seed (or uses default)
3. After bet: Combined hash generates result
4. After seed rotation: Server seed revealed
5. Anyone can verify: hash inputs → same result

## 💰 VIP System

| Level | Min Wagered/Month | Rakeback |
|-------|-------------------|----------|
| Bronze | $0 | 5% |
| Silver | $5,000 | 10% |
| Gold | $25,000 | 15% |
| Platinum | $100,000 | 20% |
| Diamond | $500,000 | 25% |
| VIP | $2,000,000 | 30% |
| SVIP | $10,000,000 | 35% |

## 🧪 Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=casino --cov-report=html

# Run specific test file
pytest tests/test_games.py -v
```

## 📊 Monte Carlo Analysis

Based on stress testing (10,000 simulations per scenario):

| Initial Capital | Risk of Ruin | Status |
|-----------------|--------------|--------|
| $500,000 | 20.30% | ❌ Too risky |
| $1,500,000 | 2.70% | ⚠️ Marginal |
| $3,000,000 | ~0.1% | ✅ Recommended |
| $5,000,000 | 0.00% | ✅ Very safe |

**Recommended starting capital: $3M+ for < 0.1% risk of ruin**

## 📝 License

Proprietary - All rights reserved

## 🤝 Contributing

This is a private project. Contact the team lead for contribution guidelines.
