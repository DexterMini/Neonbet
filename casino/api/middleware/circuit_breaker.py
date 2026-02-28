"""
Circuit Breaker Pattern
=======================

Prevents cascading failures by "opening" circuit when
a service experiences too many failures.
"""

import asyncio
import time
from enum import Enum
from typing import Callable, Any, Optional
from dataclasses import dataclass, field
from functools import wraps


class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Blocking all requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitStats:
    """Statistics for circuit breaker"""
    failures: int = 0
    successes: int = 0
    last_failure_time: float = 0
    last_success_time: float = 0
    consecutive_failures: int = 0
    consecutive_successes: int = 0


class CircuitOpenError(Exception):
    """Raised when circuit is open"""
    def __init__(self, service_name: str, retry_after: float):
        self.service_name = service_name
        self.retry_after = retry_after
        super().__init__(f"Circuit open for {service_name}. Retry after {retry_after:.1f}s")


class CircuitBreaker:
    """
    Circuit breaker implementation.
    
    States:
    - CLOSED: Normal operation, tracking failures
    - OPEN: Service is failing, reject all requests immediately
    - HALF_OPEN: Testing if service recovered
    
    Transitions:
    - CLOSED -> OPEN: After failure_threshold consecutive failures
    - OPEN -> HALF_OPEN: After recovery_timeout seconds
    - HALF_OPEN -> CLOSED: After success_threshold successes
    - HALF_OPEN -> OPEN: On any failure
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.success_threshold = success_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        
        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._half_open_calls = 0
        self._lock = asyncio.Lock()
    
    @property
    def state(self) -> CircuitState:
        return self._state
    
    @property
    def stats(self) -> CircuitStats:
        return self._stats
    
    def _should_attempt(self) -> bool:
        """Check if we should attempt a call"""
        if self._state == CircuitState.CLOSED:
            return True
        
        if self._state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if time.time() - self._stats.last_failure_time >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                return True
            return False
        
        if self._state == CircuitState.HALF_OPEN:
            # Allow limited calls in half-open state
            return self._half_open_calls < self.half_open_max_calls
        
        return False
    
    async def _record_success(self) -> None:
        """Record a successful call"""
        async with self._lock:
            self._stats.successes += 1
            self._stats.last_success_time = time.time()
            self._stats.consecutive_successes += 1
            self._stats.consecutive_failures = 0
            
            if self._state == CircuitState.HALF_OPEN:
                if self._stats.consecutive_successes >= self.success_threshold:
                    # Service recovered - close circuit
                    self._state = CircuitState.CLOSED
                    self._stats.consecutive_successes = 0
    
    async def _record_failure(self, error: Exception) -> None:
        """Record a failed call"""
        async with self._lock:
            self._stats.failures += 1
            self._stats.last_failure_time = time.time()
            self._stats.consecutive_failures += 1
            self._stats.consecutive_successes = 0
            
            if self._state == CircuitState.HALF_OPEN:
                # Any failure in half-open -> back to open
                self._state = CircuitState.OPEN
                self._half_open_calls = 0
            
            elif self._state == CircuitState.CLOSED:
                if self._stats.consecutive_failures >= self.failure_threshold:
                    # Too many failures - open circuit
                    self._state = CircuitState.OPEN
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute a function through the circuit breaker.
        
        Raises CircuitOpenError if circuit is open.
        """
        if not self._should_attempt():
            retry_after = self.recovery_timeout - (time.time() - self._stats.last_failure_time)
            raise CircuitOpenError(self.name, max(0, retry_after))
        
        if self._state == CircuitState.HALF_OPEN:
            self._half_open_calls += 1
        
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self._record_success()
            return result
            
        except Exception as e:
            await self._record_failure(e)
            raise
    
    def reset(self) -> None:
        """Manually reset the circuit breaker"""
        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._half_open_calls = 0


class CircuitBreakerRegistry:
    """
    Registry of circuit breakers for different services.
    """
    
    _breakers: dict[str, CircuitBreaker] = {}
    
    @classmethod
    def get(
        cls,
        name: str,
        failure_threshold: int = 5,
        success_threshold: int = 3,
        recovery_timeout: float = 30.0
    ) -> CircuitBreaker:
        """Get or create a circuit breaker"""
        if name not in cls._breakers:
            cls._breakers[name] = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                success_threshold=success_threshold,
                recovery_timeout=recovery_timeout
            )
        return cls._breakers[name]
    
    @classmethod
    def get_all_stats(cls) -> dict[str, dict]:
        """Get stats for all circuit breakers"""
        return {
            name: {
                "state": breaker.state.value,
                "failures": breaker.stats.failures,
                "successes": breaker.stats.successes,
                "consecutive_failures": breaker.stats.consecutive_failures
            }
            for name, breaker in cls._breakers.items()
        }


def circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0
):
    """
    Decorator to wrap a function with circuit breaker.
    
    Usage:
        @circuit_breaker("wallet_service", failure_threshold=3)
        async def call_wallet_api(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        breaker = CircuitBreakerRegistry.get(
            name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout
        )
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)
        
        # Attach breaker for inspection
        wrapper.circuit_breaker = breaker
        
        return wrapper
    return decorator
