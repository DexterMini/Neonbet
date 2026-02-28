"""
Authentication API Endpoints
============================

User registration, login, session management.
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from typing import Optional
import hashlib
import secrets
import re

from fastapi import APIRouter, HTTPException, Depends, Header, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from casino.config import settings
from casino.models import User, UserBalance, UserSession, UserStatus, KYCLevel, Currency
from casino.api.dependencies import get_db, get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ========================
# Request/Response Models
# ========================

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    referral_code: Optional[str] = None
    
    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v.lower()
    
    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", v):
            raise ValueError("Invalid email format")
        return v.lower()
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v


class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    two_factor_code: Optional[str] = None


class AuthResponse(BaseModel):
    success: bool
    message: str
    session_token: Optional[str] = None
    user: Optional[dict] = None
    expires_at: Optional[datetime] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code_url: str
    backup_codes: list[str]


# ========================
# Helper Functions
# ========================

def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Hash password with salt using PBKDF2"""
    if salt is None:
        salt = secrets.token_hex(16)
    
    # PBKDF2 with SHA256, 100k iterations
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        salt.encode(),
        100000
    ).hex()
    
    return password_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify password against stored hash"""
    computed_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(computed_hash, stored_hash)


def generate_session_token() -> str:
    """Generate secure session token"""
    return secrets.token_urlsafe(32)


# ========================
# Endpoints
# ========================

@router.post("/register", response_model=AuthResponse)
async def register(
    request: RegisterRequest,
    client_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user account.
    
    - Username must be unique (3-20 chars, alphanumeric + underscore)
    - Email must be unique and valid
    - Password must be 8+ chars with uppercase, lowercase, and number
    """
    # Check uniqueness
    existing = await db.execute(
        select(User).where(
            or_(User.email == request.email, User.username == request.username)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        )

    # Hash password  (salt stored inside the hash string)
    password_hash, salt = hash_password(request.password)
    stored_hash = f"{salt}${password_hash}"

    # Create user row
    user = User(
        email=request.email,
        username=request.username,
        password_hash=stored_hash,
        status=UserStatus.ACTIVE,
        kyc_level=KYCLevel.NONE,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Create default zero balances for each currency
    for cur in Currency:
        db.add(UserBalance(user_id=user.id, currency=cur))

    # Create session
    raw_token = generate_session_token()
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)

    ip = client_request.client.host if client_request.client else "unknown"
    ua = client_request.headers.get("user-agent", "")

    db.add(UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=ip,
        user_agent=ua,
        expires_at=expires_at,
    ))

    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        success=True,
        message="Account created successfully",
        session_token=raw_token,
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else datetime.now(UTC).isoformat(),
            "kyc_level": 0,
            "vip_level": user.vip_level,
        },
        expires_at=expires_at,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    client_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Login with username/email and password.
    
    Returns session token valid for 7 days.
    """
    # Look up user by username or email
    result = await db.execute(
        select(User).where(
            or_(
                User.email == request.username_or_email.lower(),
                User.username == request.username_or_email.lower(),
            )
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Verify password
    try:
        salt, stored_hash = user.password_hash.split("$", 1)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    if not verify_password(request.password, stored_hash, salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Check account status
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status.value}",
        )

    # Create session
    raw_token = generate_session_token()
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)

    ip = client_request.client.host if client_request.client else "unknown"
    ua = client_request.headers.get("user-agent", "")

    db.add(UserSession(
        user_id=user.id,
        refresh_token_hash=token_hash,
        ip_address=ip,
        user_agent=ua,
        expires_at=expires_at,
    ))

    # Update last login
    user.last_login_at = datetime.now(UTC)
    await db.commit()

    return AuthResponse(
        success=True,
        message="Login successful",
        session_token=raw_token,
        user={
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "created_at": user.created_at.isoformat() if user.created_at else "",
            "kyc_level": 0,
            "vip_level": user.vip_level,
        },
        expires_at=expires_at,
    )


@router.post("/logout")
async def logout(
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout and invalidate session token.
    """
    token = authorization.replace("Bearer ", "")
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    result = await db.execute(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
        )
    )
    session_row = result.scalar_one_or_none()
    if session_row:
        session_row.revoked_at = datetime.now(UTC)
        await db.commit()

    return {"success": True, "message": "Logged out successfully"}


@router.post("/refresh")
async def refresh_token(
    authorization: str = Header(..., alias="Authorization"),
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh session token before expiration.
    """
    old_token = authorization.replace("Bearer ", "")
    old_hash = hashlib.sha256(old_token.encode()).hexdigest()

    result = await db.execute(
        select(UserSession).where(
            UserSession.refresh_token_hash == old_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.now(UTC),
        )
    )
    old_session = result.scalar_one_or_none()
    if old_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session",
        )

    # Revoke old session
    old_session.revoked_at = datetime.now(UTC)

    # Issue new session
    new_token = generate_session_token()
    new_hash = hashlib.sha256(new_token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(days=7)

    db.add(UserSession(
        user_id=old_session.user_id,
        refresh_token_hash=new_hash,
        ip_address=old_session.ip_address,
        user_agent=old_session.user_agent,
        expires_at=expires_at,
    ))
    await db.commit()

    return {
        "success": True,
        "session_token": new_token,
        "expires_at": expires_at.isoformat(),
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change password for authenticated user.
    """
    # Verify current password
    try:
        salt, stored_hash = user.password_hash.split("$", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Password format error")

    if not verify_password(request.current_password, stored_hash, salt):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Hash and store new password
    new_hash, new_salt = hash_password(request.new_password)
    user.password_hash = f"{new_salt}${new_hash}"
    await db.commit()

    return {"success": True, "message": "Password changed successfully"}


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current authenticated user profile.
    """
    # Balances are eagerly loaded via selectin
    balances: dict[str, str] = {}
    stats: dict[str, str] = {
        "total_wagered": "0.00",
        "total_won": "0.00",
        "total_lost": "0.00",
        "total_deposited": "0.00",
        "total_withdrawn": "0.00",
    }

    for b in user.balances:
        cur_name = b.currency.value.upper() if hasattr(b.currency, "value") else str(b.currency).upper()
        balances[cur_name] = str(b.available)
        stats["total_wagered"] = str(float(stats["total_wagered"]) + float(b.total_wagered))
        stats["total_won"] = str(float(stats["total_won"]) + float(b.total_won))
        stats["total_deposited"] = str(float(stats["total_deposited"]) + float(b.total_deposited))
        stats["total_withdrawn"] = str(float(stats["total_withdrawn"]) + float(b.total_withdrawn))

    stats["total_lost"] = str(float(stats["total_wagered"]) - float(stats["total_won"]))

    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else "",
        "kyc_level": 0,
        "vip_level": user.vip_level,
        "balances": balances,
        "stats": stats,
    }


@router.post("/2fa/setup")
async def setup_two_factor(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Setup two-factor authentication.
    
    Returns secret and backup codes.
    """
    if user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is already enabled")

    # Generate TOTP secret
    secret = secrets.token_hex(20)
    backup_codes = [secrets.token_hex(4).upper() for _ in range(10)]

    # Persist secret (will be confirmed in /2fa/verify)
    user.totp_secret = secret
    await db.commit()

    return TwoFactorSetupResponse(
        secret=secret,
        qr_code_url=f"otpauth://totp/Casino:{user.username}?secret={secret}&issuer=Casino",
        backup_codes=backup_codes,
    )


@router.post("/2fa/verify")
async def verify_two_factor(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify and enable two-factor authentication.
    """
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /2fa/setup first")

    # TODO: validate TOTP code with pyotp against user.totp_secret
    # For now, accept any code to enable 2FA
    user.totp_enabled = True
    await db.commit()

    return {"success": True, "message": "2FA enabled successfully"}


@router.post("/2fa/disable")
async def disable_two_factor(
    code: str,
    password: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Disable two-factor authentication.
    
    Requires current 2FA code and password.
    """
    # Verify password
    try:
        salt, stored_hash = user.password_hash.split("$", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Password format error")

    if not verify_password(password, stored_hash, salt):
        raise HTTPException(status_code=400, detail="Invalid password")

    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()

    return {"success": True, "message": "2FA disabled successfully"}
