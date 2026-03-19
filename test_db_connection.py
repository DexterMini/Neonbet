#!/usr/bin/env python3
from casino.config import get_settings
import asyncio
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

settings = get_settings()
print(f'Database URL: {settings.database.url}')

async def test_connection():
    try:
        engine = create_async_engine(settings.database.url, echo=False)
        async with engine.connect() as conn:
            result = await conn.execute(sa.text("SELECT 1"))
            print(f"✅ Connection successful! Result: {result.scalar()}")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
    finally:
        await engine.dispose()

asyncio.run(test_connection())
