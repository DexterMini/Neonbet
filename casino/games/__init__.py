"""
Game Engines Package
====================

All casino game implementations.
"""

from casino.games.engines import (
    BaseGame,
    BetResult,
    GameOutcome,
    DiceGame,
    LimboGame,
    MinesGame,
    PlinkoGame,
    WheelGame,
    KenoGame,
    BlackjackGame,
    FlipGame,
    HiLoGame,
    StairsGame,
    ChickenGame,
    CoinClimberGame,
    SnakeGame,
    SlotsGame,
    GAMES,
    get_game,
)

from casino.games.crash import (
    CrashEngine,
    CrashRound,
    CrashPlayer,
    CrashState,
)

__all__ = [
    # Base classes
    "BaseGame",
    "BetResult", 
    "GameOutcome",
    
    # Individual games
    "DiceGame",
    "LimboGame",
    "MinesGame",
    "PlinkoGame",
    "WheelGame",
    "KenoGame",
    "BlackjackGame",
    
    # Crash (multiplayer)
    "CrashEngine",
    "CrashRound",
    "CrashPlayer",
    "CrashState",
    
    # Registry
    "GAMES",
    "get_game",
]
