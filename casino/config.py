"""
Casino Configuration
====================
Central configuration management using Pydantic Settings
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
from functools import lru_cache


class DatabaseSettings(BaseSettings):
    """Database configuration"""
    url: str = Field(default="postgresql+asyncpg://localhost:5432/casino")
    pool_size: int = Field(default=20)
    max_overflow: int = Field(default=10)
    echo: bool = Field(default=False)
    
    class Config:
        env_prefix = "DB_"


class RedisSettings(BaseSettings):
    """Redis configuration for caching and idempotency"""
    url: str = Field(default="redis://localhost:6379/0")
    idempotency_ttl: int = Field(default=86400)  # 24 hours
    session_ttl: int = Field(default=3600)  # 1 hour
    
    class Config:
        env_prefix = "REDIS_"


class WalletSettings(BaseSettings):
    """Wallet tier configuration"""
    hot_wallet_max_percent: float = Field(default=0.05)  # 5% of total
    warm_wallet_percent: float = Field(default=0.03)  # 3% of total
    cold_storage_percent: float = Field(default=0.92)  # 92% of total
    
    hot_wallet_single_withdrawal_limit: float = Field(default=10000)
    daily_withdrawal_limit: float = Field(default=100000)
    
    low_watermark_multiplier: float = Field(default=0.20)  # 20% of daily avg
    high_watermark_multiplier: float = Field(default=0.05)  # 5% of bankroll
    
    class Config:
        env_prefix = "WALLET_"


class GameSettings(BaseSettings):
    """Game engine configuration"""
    house_edge: float = Field(default=0.02)  # 2%
    max_win_multiplier: float = Field(default=100000)  # 100,000x
    max_bet: float = Field(default=10000)
    min_bet: float = Field(default=0.10)
    
    # Provably Fair settings
    server_seed_batch_size: int = Field(default=1000)
    seed_reveal_delay_rounds: int = Field(default=1)
    
    class Config:
        env_prefix = "GAME_"


class RiskSettings(BaseSettings):
    """Risk engine configuration"""
    velocity_window_seconds: int = Field(default=600)  # 10 minutes
    velocity_max_transactions: int = Field(default=100)
    
    amount_spike_multiplier: float = Field(default=10.0)
    geo_anomaly_enabled: bool = Field(default=True)
    
    risk_threshold_low: float = Field(default=0.3)
    risk_threshold_medium: float = Field(default=0.6)
    risk_threshold_high: float = Field(default=0.8)
    risk_threshold_critical: float = Field(default=0.95)
    
    auto_freeze_on_critical: bool = Field(default=True)
    
    class Config:
        env_prefix = "RISK_"


class VIPSettings(BaseSettings):
    """VIP and retention configuration"""
    rakeback_base_percent: float = Field(default=0.05)  # 5% base
    rakeback_max_percent: float = Field(default=0.15)  # 15% max
    
    lossback_percent: float = Field(default=0.10)  # 10%
    lossback_max_usd: float = Field(default=500)
    
    class Config:
        env_prefix = "VIP_"


class SecuritySettings(BaseSettings):
    """Security configuration"""
    jwt_secret: str = Field(default="CHANGE_ME_IN_PRODUCTION")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=30)
    refresh_token_expire_days: int = Field(default=7)
    
    bcrypt_rounds: int = Field(default=12)
    
    require_2fa_for_withdrawal: bool = Field(default=True)
    require_2fa_for_large_bets: bool = Field(default=True)
    large_bet_threshold: float = Field(default=1000)
    
    class Config:
        env_prefix = "SECURITY_"


class Settings(BaseSettings):
    """Main application settings"""
    app_name: str = Field(default="CryptoCasino")
    debug: bool = Field(default=False)
    environment: str = Field(default="development")
    
    # API settings
    api_prefix: str = Field(default="/api/v1")
    allowed_origins: List[str] = Field(default=["http://localhost:3000"])
    
    # Sub-settings
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    wallet: WalletSettings = Field(default_factory=WalletSettings)
    game: GameSettings = Field(default_factory=GameSettings)
    risk: RiskSettings = Field(default_factory=RiskSettings)
    vip: VIPSettings = Field(default_factory=VIPSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
