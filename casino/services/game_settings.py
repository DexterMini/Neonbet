"""
Game Settings Service
====================

Service for managing and retrieving game settings including RTP and house edge.
"""

from decimal import Decimal
from typing import Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from casino.models import GameSettings, GameType


class GameSettingsService:
    """Service for game settings management"""
    
    # Default house edges (fallback if database is unavailable)
    DEFAULT_HOUSE_EDGES = {
        GameType.DICE: Decimal("0.03"),
        GameType.CRASH: Decimal("0.01"),
        GameType.PLINKO: Decimal("0.04"),
        GameType.MINES: Decimal("0.05"),
        GameType.LIMBO: Decimal("0.05"),
        GameType.WHEEL: Decimal("0.06"),
        GameType.BLACKJACK: Decimal("0.04"),
        GameType.ROULETTE: Decimal("0.027"),
        GameType.SLOTS: Decimal("0.05"),
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: Dict[str, Decimal] = {}
    
    async def get_house_edge(self, game_type: GameType) -> Decimal:
        """
        Get house edge for a game type.
        Returns database value if available, otherwise returns default.
        """
        # Check cache first
        cache_key = game_type.value
        if cache_key in self._cache:
            return self._cache[cache_key]
        
        try:
            result = await self.db.execute(
                select(GameSettings).where(GameSettings.game_type == game_type)
            )
            settings = result.scalar_one_or_none()
            
            if settings:
                house_edge = Decimal(str(settings.house_edge))
                self._cache[cache_key] = house_edge
                return house_edge
        except Exception:
            # If database query fails, use default
            pass
        
        # Return default
        default = self.DEFAULT_HOUSE_EDGES.get(game_type, Decimal("0.05"))
        self._cache[cache_key] = default
        return default
    
    async def get_rtp(self, game_type: GameType) -> Decimal:
        """Get Return to Player (RTP) percentage for a game type"""
        house_edge = await self.get_house_edge(game_type)
        return Decimal("1") - house_edge
    
    def clear_cache(self):
        """Clear the settings cache"""
        self._cache.clear()
