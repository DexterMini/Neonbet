"""
WebSocket module for real-time game communication.
"""

from .manager import ConnectionManager
from .crash_game import CrashGameManager

__all__ = ["ConnectionManager", "CrashGameManager"]
