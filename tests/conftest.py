"""
Test Configuration
==================

Pytest fixtures and configuration.
"""

import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, UTC
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import redis.asyncio as redis

from casino.services.provably_fair import GameResult


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_redis():
    """Mock Redis client"""
    mock = AsyncMock()
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.incr.return_value = 1
    mock.expire.return_value = True
    mock.lpush.return_value = 1
    mock.lrange.return_value = []
    mock.sadd.return_value = 1
    mock.sismember.return_value = False
    mock.smembers.return_value = set()
    pipe = AsyncMock()
    pipe.incr.return_value = pipe
    pipe.expire.return_value = pipe
    pipe.execute.return_value = [1, True]
    mock.pipeline = MagicMock(return_value=pipe)
    return mock


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock()
    session.execute.return_value = MagicMock(scalar=MagicMock(return_value=None))
    session.commit.return_value = None
    session.rollback.return_value = None
    session.close.return_value = None
    return session


@pytest.fixture
def game_result_win():
    """Game result that should produce a win for most games"""
    return GameResult(
        raw_hash="a" * 64,
        normalized=0.75,
        server_seed_hash="hash123",
        client_seed="client123",
        nonce=1
    )


@pytest.fixture
def game_result_lose():
    """Game result that should produce a loss for most games"""
    return GameResult(
        raw_hash="1" * 64,
        normalized=0.25,
        server_seed_hash="hash123",
        client_seed="client123",
        nonce=1
    )
