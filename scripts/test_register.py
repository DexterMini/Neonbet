"""Test registration endpoint logic directly"""
import asyncio
import os
os.environ["DB_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/casino"

from casino.config import get_settings, Settings
# Clear cached settings
get_settings.cache_clear()

from casino.models.session import engine, async_session_factory
from casino.models import User, UserBalance, UserSession, UserStatus, KYCLevel, Currency
from casino.api.routes.auth import hash_password, generate_session_token
from datetime import datetime, timedelta, UTC
from sqlalchemy import text
import hashlib

async def test_register():
    print("DB URL:", get_settings().database.url)
    
    # Test raw connection
    async with engine.begin() as conn:
        r = await conn.execute(text("SELECT 1"))
        print("DB ping:", r.scalar())
    
    # Test ORM insert
    async with async_session_factory() as db:
        try:
            password_hash, salt = hash_password("Test1234!")
            stored_hash = f"{salt}${password_hash}"
            
            user = User(
                email="test2@test.com",
                username="testuser2",
                password_hash=stored_hash,
                status=UserStatus.ACTIVE,
                kyc_level=KYCLevel.NONE,
            )
            db.add(user)
            await db.flush()
            print("User created with ID:", user.id)
            
            # Create balance
            for cur in Currency:
                db.add(UserBalance(user_id=user.id, currency=cur))
            
            # Create session
            raw_token = generate_session_token()
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            expires_at = datetime.now(UTC) + timedelta(days=7)
            
            db.add(UserSession(
                user_id=user.id,
                refresh_token_hash=token_hash,
                ip_address="127.0.0.1",
                user_agent="test",
                expires_at=expires_at,
            ))
            
            await db.commit()
            print("SUCCESS! User registered and committed.")
            print("Token:", raw_token)
            
        except Exception as e:
            print(f"ERROR: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            await db.rollback()

asyncio.run(test_register())
