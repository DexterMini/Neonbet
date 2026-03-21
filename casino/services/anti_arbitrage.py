"""
Anti-Arbitrage Engine
=====================

Prevents currency exchange arbitrage by:
- Fetching median prices from multiple sources
- Blocking transactions when platform price deviates too far from market
- Rate-limiting currency conversions
- Detecting rapid deposit→convert→withdraw patterns
"""

import logging
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

import redis.asyncio as aioredis
import httpx

from casino.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class PriceQuote:
    """A single price quote from an exchange."""
    source: str
    currency: str
    price_usd: Decimal
    timestamp: float


class InsufficientPriceDataError(Exception):
    """Not enough price sources responded."""
    pass


class PriceDeviationError(Exception):
    """Platform price deviates too far from market consensus."""
    def __init__(self, deviation: Decimal, threshold: Decimal, currency: str):
        self.deviation = deviation
        self.threshold = threshold
        self.currency = currency
        super().__init__(
            f"{currency} price deviation {deviation:.4%} exceeds threshold {threshold:.4%}"
        )


class AntiArbitrageEngine:
    """
    Guards against arbitrage by comparing platform prices to market consensus.

    Usage::

        engine = AntiArbitrageEngine(redis_client)
        ok, reason = await engine.validate_transaction("BTC", platform_price)
        if not ok:
            raise HTTPException(400, reason)
    """

    # External price-feed URLs (public, no auth required)
    PRICE_SOURCES = {
        "coingecko": "https://api.coingecko.com/api/v3/simple/price?ids={cg_id}&vs_currencies=usd",
        "binance": "https://api.binance.com/api/v3/ticker/price?symbol={symbol}USDT",
    }

    # Map our currency codes to exchange identifiers
    CG_IDS = {
        "BTC": "bitcoin",
        "ETH": "ethereum",
        "SOL": "solana",
        "LTC": "litecoin",
    }

    BINANCE_SYMBOLS = {
        "BTC": "BTC",
        "ETH": "ETH",
        "SOL": "SOL",
        "LTC": "LTC",
    }

    # Stablecoins are pegged to $1
    STABLECOINS = {"USDT", "USDC"}

    # Thresholds
    MAX_DEVIATION = Decimal("0.005")        # 0.5%
    BLOCK_DURATION_SECONDS = 300            # 5-minute block on deviation
    PRICE_CACHE_TTL = 30                    # Re-use prices for 30s
    CONVERSION_RATE_LIMIT = 10              # Max conversions per user per hour
    RAPID_CYCLE_WINDOW = 3600               # 1 hour
    RAPID_CYCLE_THRESHOLD = 3               # deposit→convert→withdraw 3 times

    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    # ------------------------------------------------------------------
    # Price feeds
    # ------------------------------------------------------------------

    async def _fetch_coingecko(self, currency: str) -> Optional[Decimal]:
        cg_id = self.CG_IDS.get(currency)
        if not cg_id:
            return None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                url = self.PRICE_SOURCES["coingecko"].format(cg_id=cg_id)
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return Decimal(str(data[cg_id]["usd"]))
        except Exception as exc:
            logger.warning(f"CoinGecko price fetch failed for {currency}: {exc}")
            return None

    async def _fetch_binance(self, currency: str) -> Optional[Decimal]:
        symbol = self.BINANCE_SYMBOLS.get(currency)
        if not symbol:
            return None
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                url = self.PRICE_SOURCES["binance"].format(symbol=symbol)
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return Decimal(data["price"])
        except Exception as exc:
            logger.warning(f"Binance price fetch failed for {currency}: {exc}")
            return None

    async def get_market_price(self, currency: str) -> Decimal:
        """
        Get fair-market USD price using median of multiple sources.

        Results are cached in Redis for ``PRICE_CACHE_TTL`` seconds.
        """
        if currency in self.STABLECOINS:
            return Decimal("1.00")

        # Check cache
        cache_key = f"arb:price:{currency}"
        cached = await self.redis.get(cache_key)
        if cached:
            return Decimal(cached)

        prices: List[Decimal] = []
        for fetcher in [self._fetch_coingecko, self._fetch_binance]:
            p = await fetcher(currency)
            if p is not None and p > 0:
                prices.append(p)

        if len(prices) == 0:
            raise InsufficientPriceDataError(
                f"No price sources available for {currency}"
            )

        # Median
        prices.sort()
        mid = len(prices) // 2
        median = prices[mid] if len(prices) % 2 == 1 else (prices[mid - 1] + prices[mid]) / 2

        # Cache
        await self.redis.set(cache_key, str(median), ex=self.PRICE_CACHE_TTL)
        return median

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    async def validate_transaction(
        self,
        currency: str,
        platform_price: Decimal,
    ) -> Tuple[bool, str]:
        """
        Check that ``platform_price`` is within ``MAX_DEVIATION`` of market.

        Returns ``(allowed, reason)``.
        """
        if currency in self.STABLECOINS:
            return True, "OK"

        # Check if currency is temporarily blocked
        block_key = f"arb:blocked:{currency}"
        if await self.redis.exists(block_key):
            return False, f"{currency} conversions temporarily paused due to price deviation"

        try:
            market = await self.get_market_price(currency)
        except InsufficientPriceDataError:
            # Fail-open for non-stablecoins if no price data (logged)
            logger.warning(f"No market price for {currency} — allowing transaction (fail-open)")
            return True, "OK"

        deviation = abs(platform_price - market) / market
        if deviation > self.MAX_DEVIATION:
            # Block this currency temporarily
            await self.redis.set(block_key, str(deviation), ex=self.BLOCK_DURATION_SECONDS)
            logger.warning(
                f"ARBITRAGE BLOCK: {currency} platform={platform_price} market={market} "
                f"deviation={deviation:.4%} > threshold={self.MAX_DEVIATION:.4%}"
            )
            return False, (
                f"{currency} price deviation ({deviation:.2%}) exceeds safe threshold. "
                "Transaction blocked — try again in a few minutes."
            )

        return True, "OK"

    # ------------------------------------------------------------------
    # Rate limiting (conversions)
    # ------------------------------------------------------------------

    async def check_conversion_rate_limit(self, user_id: str) -> Tuple[bool, str]:
        """Enforce per-user conversion rate limit."""
        key = f"arb:convert_count:{user_id}"
        count = int(await self.redis.get(key) or 0)
        if count >= self.CONVERSION_RATE_LIMIT:
            return False, f"Conversion limit reached ({self.CONVERSION_RATE_LIMIT}/hour)"
        return True, "OK"

    async def record_conversion(self, user_id: str) -> None:
        key = f"arb:convert_count:{user_id}"
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, 3600)
        await pipe.execute()

    # ------------------------------------------------------------------
    # Rapid-cycle detection
    # ------------------------------------------------------------------

    async def record_activity(self, user_id: str, activity: str) -> None:
        """
        Track deposit / convert / withdraw activities.

        ``activity`` should be one of ``"deposit"``, ``"convert"``, ``"withdraw"``.
        """
        key = f"arb:activity:{user_id}"
        now = time.time()
        pipe = self.redis.pipeline()
        pipe.zadd(key, {f"{activity}:{now}": now})
        # Trim entries older than window
        pipe.zremrangebyscore(key, 0, now - self.RAPID_CYCLE_WINDOW)
        pipe.expire(key, self.RAPID_CYCLE_WINDOW * 2)
        await pipe.execute()

    async def detect_rapid_cycling(self, user_id: str) -> Tuple[bool, str]:
        """
        Detect deposit → convert → withdraw cycling within the window.

        Returns ``(is_suspicious, reason)``.
        """
        key = f"arb:activity:{user_id}"
        entries = await self.redis.zrangebyscore(
            key,
            time.time() - self.RAPID_CYCLE_WINDOW,
            "+inf",
        )
        if not entries:
            return False, "OK"

        # Parse activities in order
        activities = [e.split(":")[0] for e in entries]

        # Look for deposit→convert→withdraw sequences
        cycles = 0
        i = 0
        while i < len(activities) - 2:
            if (
                activities[i] == "deposit"
                and activities[i + 1] == "convert"
                and activities[i + 2] == "withdraw"
            ):
                cycles += 1
                i += 3
            else:
                i += 1

        if cycles >= self.RAPID_CYCLE_THRESHOLD:
            return True, (
                f"Suspicious deposit→convert→withdraw pattern detected "
                f"({cycles} cycles in {self.RAPID_CYCLE_WINDOW}s)"
            )

        return False, "OK"

    # ------------------------------------------------------------------
    # Full pre-transaction check
    # ------------------------------------------------------------------

    async def pre_conversion_check(
        self,
        user_id: str,
        from_currency: str,
        to_currency: str,
        platform_rate: Decimal,
    ) -> Tuple[bool, str]:
        """
        Run all anti-arbitrage checks before allowing a currency conversion.
        """
        # 1. Rate limit
        ok, reason = await self.check_conversion_rate_limit(user_id)
        if not ok:
            return False, reason

        # 2. Price deviation for non-stablecoins
        for cur in [from_currency, to_currency]:
            if cur not in self.STABLECOINS:
                try:
                    market = await self.get_market_price(cur)
                except InsufficientPriceDataError:
                    continue
                ok, reason = await self.validate_transaction(cur, market)
                if not ok:
                    return False, reason

        # 3. Rapid cycling
        suspicious, reason = await self.detect_rapid_cycling(user_id)
        if suspicious:
            return False, reason

        return True, "OK"
