"""
Shared FastAPI Dependencies
============================

Reusable dependency functions injected into route handlers.
"""

from datetime import datetime, UTC
from typing import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from casino.models.session import async_session_factory
from casino.models import User, UserSession


# ---------------------------------------------------------------------------
# Database session
# ---------------------------------------------------------------------------

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async DB session, auto-closed after the request."""
    async with async_session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Current user (from session token)
# ---------------------------------------------------------------------------

async def get_current_user(
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve the current authenticated user from the Bearer session token.

    The session token is the raw token stored in the `user_sessions` table
    (hashed via SHA-256 for storage).  We hash the incoming token and look
    up the matching row.
    """
    import hashlib

    # Extract token
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
        )
    token = authorization[7:]  # strip "Bearer "

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # Lookup active, non-expired session
    result = await db.execute(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(UTC),
        )
    )
    session_row = result.scalar_one_or_none()

    if session_row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # Load user
    user_result = await db.execute(
        select(User).where(User.id == session_row.user_id)
    )
    user = user_result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


# ---------------------------------------------------------------------------
# Current admin user
# ---------------------------------------------------------------------------

async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Ensure the current user has admin privileges."""
    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access denied",
        )
    return user
