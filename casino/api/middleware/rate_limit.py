"""
Rate Limiter Middleware
======================

Simple in-memory rate limiter for auth endpoints.
Uses a sliding window counter per IP address.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import Request, HTTPException, status


class RateLimiter:
    """In-memory sliding-window rate limiter."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _cleanup(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    def check(self, key: str) -> bool:
        """Return True if the request is allowed, False if rate-limited."""
        now = time.monotonic()
        with self._lock:
            self._cleanup(key, now)
            if len(self._requests[key]) >= self.max_requests:
                return False
            self._requests[key].append(now)
            return True

    def remaining(self, key: str) -> int:
        now = time.monotonic()
        with self._lock:
            self._cleanup(key, now)
            return max(0, self.max_requests - len(self._requests[key]))


# Global rate limiters
auth_limiter = RateLimiter(max_requests=10, window_seconds=60)       # 10 req/min for login/register
password_limiter = RateLimiter(max_requests=5, window_seconds=300)    # 5 req/5min for password ops


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def rate_limit_auth(request: Request) -> None:
    """Dependency – raises 429 if auth rate limit exceeded."""
    ip = _get_client_ip(request)
    if not auth_limiter.check(f"auth:{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )


async def rate_limit_password(request: Request) -> None:
    """Dependency – raises 429 if password-reset rate limit exceeded."""
    ip = _get_client_ip(request)
    if not password_limiter.check(f"pwd:{ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
        )
