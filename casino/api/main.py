"""
Casino API Main Application
===========================

FastAPI application with all routes and middleware.
"""

from contextlib import asynccontextmanager
from datetime import datetime, UTC
import logging

import redis.asyncio as aioredis
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from casino.config import get_settings
from casino.api.routes import auth_router, bets_router, wallet_router, admin_router, payments_router
from casino.api.routes.websocket import router as ws_router, start_crash_game, stop_crash_game
from casino.api.middleware import IdempotencyMiddleware
from casino.models.session import init_db, close_db

settings = get_settings()


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ========================
# Lifespan Events
# ========================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    
    # Startup
    logger.info("🎰 Casino API starting up...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug: {settings.debug}")
    
    # Start crash game WebSocket manager
    await start_crash_game()
    logger.info("🎮 Crash game started")
    
    # Initialize database connection pool
    try:
        await init_db()
        logger.info("🗄️  Database connected")
    except Exception as e:
        logger.warning(f"⚠️  Database not available: {e}")
    
    # Initialize Redis
    redis_client = None
    try:
        redis_client = aioredis.from_url(
            settings.redis.url,
            encoding="utf-8",
            decode_responses=True,
        )
        await redis_client.ping()
        app.state.redis = redis_client
        logger.info("🔴 Redis connected")
    except Exception as e:
        logger.warning(f"⚠️  Redis not available: {e} — idempotency disabled")
        app.state.redis = None
    
    yield
    
    # Shutdown
    logger.info("🎰 Casino API shutting down...")
    
    # Stop crash game
    await stop_crash_game()
    logger.info("🎮 Crash game stopped")
    
    # Close database connections
    await close_db()
    logger.info("🗄️  Database disconnected")
    
    # Close Redis
    if redis_client:
        await redis_client.close()
        logger.info("🔴 Redis disconnected")


# ========================
# Application Factory
# ========================

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    
    app = FastAPI(
        title="Crypto Casino API",
        description="""
        ## 🎰 Provably Fair Crypto Casino
        
        A fully transparent, cryptographically verifiable casino platform.
        
        ### Features
        - **Provably Fair**: Every bet outcome is verifiable using HMAC-SHA256
        - **Multi-Currency**: Support for BTC, ETH, USDT, USDC, SOL, LTC
        - **Event-Sourced Ledger**: Complete audit trail of all transactions
        - **Real-time Risk Engine**: Fraud detection and prevention
        
        ### Games
        - 🎲 Dice
        - 📈 Crash
        - 💎 Limbo
        - 💣 Mines
        - 🎯 Plinko
        - 🎡 Wheel
        
        ### Authentication
        All authenticated endpoints require `Authorization: Bearer <token>` header.
        
        ### Idempotency
        Bet and withdrawal endpoints require `X-Idempotency-Key` header.
        Same key within 24h returns cached response (prevents double-spending).
        """,
        version="0.1.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan
    )
    
    # ========================
    # CORS Middleware
    # ========================
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # ========================
    # Custom Middleware
    # ========================
    
    # Idempotency middleware — uses app.state.redis (set in lifespan).
    # Gracefully degrades if Redis is not available.
    app.add_middleware(IdempotencyMiddleware)
    
    # ========================
    # Exception Handlers
    # ========================
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail
                },
                "timestamp": datetime.now(UTC).isoformat()
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.exception(f"Unhandled exception: {exc}")
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": 500,
                    "message": "Internal server error" if not settings.debug else str(exc)
                },
                "timestamp": datetime.now(UTC).isoformat()
            }
        )
    
    # ========================
    # Routes
    # ========================
    
    # Health check
    @app.get("/health", tags=["System"])
    async def health_check():
        """Health check endpoint for monitoring"""
        return {
            "status": "healthy",
            "timestamp": datetime.now(UTC).isoformat(),
            "version": "0.1.0"
        }
    
    # API version
    @app.get("/", tags=["System"])
    async def root():
        """API information"""
        return {
            "name": "Crypto Casino API",
            "version": "0.1.0",
            "documentation": "/docs" if settings.debug else "Disabled in production"
        }
    
    # Include routers
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(bets_router, prefix="/api/v1")
    app.include_router(wallet_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(payments_router, prefix="/api/v1")
    app.include_router(ws_router)  # WebSocket routes
    
    return app


# Create app instance
app = create_app()


# ========================
# Development Server
# ========================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "casino.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )
