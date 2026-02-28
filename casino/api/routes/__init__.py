"""
API Routes Package
==================

All FastAPI router endpoints.
"""

from casino.api.routes.auth import router as auth_router
from casino.api.routes.bets import router as bets_router
from casino.api.routes.wallet import router as wallet_router
from casino.api.routes.admin import router as admin_router

__all__ = [
    "auth_router",
    "bets_router", 
    "wallet_router",
    "admin_router",
]
