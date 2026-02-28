"""Test the FastAPI app directly with TestClient-like approach"""
import asyncio
import os
os.environ["DB_URL"] = "postgresql+asyncpg://postgres:postgres@localhost:5432/casino"

# Clear lru_cache before importing anything
from casino.config import get_settings
get_settings.cache_clear()

from httpx import AsyncClient, ASGITransport
from casino.api.main import app

async def test():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test register
        resp = await client.post("/api/v1/auth/register", json={
            "email": "httptest@test.com",
            "username": "httptest",
            "password": "Test1234!"
        })
        print(f"Register: {resp.status_code}")
        print(resp.json())
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("session_token")
            
            # Test login
            resp2 = await client.post("/api/v1/auth/login", json={
                "username_or_email": "httptest",
                "password": "Test1234!"
            })
            print(f"\nLogin: {resp2.status_code}")
            print(resp2.json())

asyncio.run(test())
