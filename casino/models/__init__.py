# Models package
from .database import (
    Base,
    User, UserStatus, KYCLevel,
    UserBalance, UserSession,
    LedgerEvent, LedgerEventType,
    Currency, GameType, BetStatus,
    ServerSeed, ClientSeed,
    Bet, Deposit, Withdrawal,
    AdminAction, SystemAlert, GameSettings
)

KYC_LEVEL_TO_INT = {
    KYCLevel.NONE: 0,
    KYCLevel.TIER_1: 1,
    KYCLevel.TIER_2: 2,
    KYCLevel.TIER_3: 3,
}


def kyc_level_to_int(level: KYCLevel | str | None) -> int:
    """Map KYCLevel enum (or value) to an integer for API responses."""
    if level is None:
        return 0
    if isinstance(level, KYCLevel):
        return KYC_LEVEL_TO_INT.get(level, 0)
    # fallback for string values
    for k, v in KYC_LEVEL_TO_INT.items():
        if k.value == level:
            return v
    return 0

__all__ = [
    "Base",
    "User", "UserStatus", "KYCLevel",
    "UserBalance", "UserSession",
    "LedgerEvent", "LedgerEventType",
    "Currency", "GameType", "BetStatus",
    "ServerSeed", "ClientSeed",
    "Bet", "Deposit", "Withdrawal",
    "AdminAction", "SystemAlert", "GameSettings",
    "KYC_LEVEL_TO_INT", "kyc_level_to_int",
]
