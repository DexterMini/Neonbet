"""
Idempotency Middleware
======================

Ensures API calls are processed exactly once.
Prevents double-spending and duplicate transactions.
"""

import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Callable, Any
from functools import wraps

import redis.asyncio as redis
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from casino.config import get_settings


class IdempotencyStore:
    """
    Redis-backed idempotency key storage.
    
    Stores:
    - Request hash -> Response for completed requests
    - Request hash -> "processing" for in-flight requests
    """
    
    def __init__(self, redis_client: redis.Redis, ttl: int = 86400):
        self.redis = redis_client
        self.ttl = ttl  # 24 hours default
        self.prefix = "idem:"
    
    def _key(self, idempotency_key: str) -> str:
        return f"{self.prefix}{idempotency_key}"
    
    async def get(self, idempotency_key: str) -> Optional[dict]:
        """Get cached response for idempotency key"""
        data = await self.redis.get(self._key(idempotency_key))
        if data:
            return json.loads(data)
        return None
    
    async def set_processing(self, idempotency_key: str) -> bool:
        """
        Mark request as processing.
        
        Returns False if already processing (concurrent duplicate).
        Uses SET NX (set if not exists) for atomicity.
        """
        result = await self.redis.set(
            self._key(idempotency_key),
            json.dumps({"status": "processing", "started_at": datetime.utcnow().isoformat()}),
            nx=True,  # Only set if not exists
            ex=60  # Short TTL for processing state
        )
        return result is not None
    
    async def set_complete(
        self, 
        idempotency_key: str, 
        response_data: dict,
        status_code: int
    ) -> None:
        """Store completed response"""
        await self.redis.set(
            self._key(idempotency_key),
            json.dumps({
                "status": "complete",
                "response": response_data,
                "status_code": status_code,
                "completed_at": datetime.utcnow().isoformat()
            }),
            ex=self.ttl
        )
    
    async def delete(self, idempotency_key: str) -> None:
        """Delete idempotency key (for cleanup on error)"""
        await self.redis.delete(self._key(idempotency_key))


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware for idempotency.
    
    Checks X-Idempotency-Key header on mutating requests.
    Returns cached response for duplicate requests.
    
    Accepts either a direct redis_client or falls back to
    ``request.app.state.redis`` so it can be registered before
    the lifespan opens the Redis connection.
    """
    
    IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    IDEMPOTENT_PATHS = {
        "/api/v1/bets",
        "/api/v1/wallet/withdraw",
        "/api/v1/wallet/deposit",
    }
    
    def __init__(self, app, redis_client: redis.Redis | None = None):
        super().__init__(app)
        self._redis = redis_client
    
    def _get_store(self, request: Request) -> IdempotencyStore | None:
        """Resolve a live Redis client (direct or via app.state)."""
        client = self._redis or getattr(request.app.state, "redis", None)
        if client is None:
            return None
        return IdempotencyStore(client)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only process idempotent paths
        if request.method not in self.IDEMPOTENT_METHODS:
            return await call_next(request)
        
        # Check if path requires idempotency
        path = request.url.path
        requires_idempotency = any(
            path.startswith(p) for p in self.IDEMPOTENT_PATHS
        )
        
        if not requires_idempotency:
            return await call_next(request)
        
        # Get idempotency key from header
        idempotency_key = request.headers.get("X-Idempotency-Key")
        
        if not idempotency_key:
            raise HTTPException(
                status_code=400,
                detail="X-Idempotency-Key header required for this endpoint"
            )
        
        # Validate key format (should be UUID-like)
        if len(idempotency_key) < 16 or len(idempotency_key) > 64:
            raise HTTPException(
                status_code=400,
                detail="Invalid idempotency key format"
            )
        
        # Resolve Redis store — if unavailable, skip idempotency
        store = self._get_store(request)
        if store is None:
            return await call_next(request)
        
        # Check for existing response
        cached = await store.get(idempotency_key)
        
        if cached:
            if cached.get("status") == "processing":
                # Concurrent duplicate request
                raise HTTPException(
                    status_code=409,
                    detail="Request already in progress"
                )
            
            if cached.get("status") == "complete":
                # Return cached response
                return Response(
                    content=json.dumps(cached["response"]),
                    status_code=cached["status_code"],
                    media_type="application/json",
                    headers={"X-Idempotency-Replayed": "true"}
                )
        
        # Mark as processing
        acquired = await store.set_processing(idempotency_key)
        if not acquired:
            raise HTTPException(
                status_code=409,
                detail="Request already in progress"
            )
        
        try:
            # Process request
            response = await call_next(request)
            
            # Cache successful response
            if response.status_code < 500:
                # Read response body
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk
                
                try:
                    response_data = json.loads(body)
                except json.JSONDecodeError:
                    response_data = {"raw": body.decode()}
                
                await store.set_complete(
                    idempotency_key,
                    response_data,
                    response.status_code
                )
                
                # Return new response with body
                return Response(
                    content=body,
                    status_code=response.status_code,
                    media_type=response.media_type,
                    headers=dict(response.headers)
                )
            
            # Don't cache server errors - allow retry
            await store.delete(idempotency_key)
            return response
            
        except Exception as e:
            # Clean up on error
            await store.delete(idempotency_key)
            raise


def idempotent(key_param: str = "idempotency_key"):
    """
    Decorator for idempotent service methods.
    
    Usage:
        @idempotent("transaction_id")
        async def process_transaction(self, transaction_id: str, ...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get idempotency key from kwargs
            idem_key = kwargs.get(key_param)
            
            if not idem_key:
                # No idempotency key - just run function
                return await func(*args, **kwargs)
            
            # Get redis client from first arg (self) if available
            self = args[0] if args else None
            redis_client = getattr(self, 'redis', None)
            
            if not redis_client:
                # No redis available - just run function
                return await func(*args, **kwargs)
            
            store = IdempotencyStore(redis_client)
            
            # Check cache
            cached = await store.get(idem_key)
            if cached and cached.get("status") == "complete":
                return cached["response"]
            
            # Mark processing
            acquired = await store.set_processing(idem_key)
            if not acquired:
                raise Exception("Duplicate request in progress")
            
            try:
                result = await func(*args, **kwargs)
                await store.set_complete(idem_key, result, 200)
                return result
            except Exception:
                await store.delete(idem_key)
                raise
        
        return wrapper
    return decorator
