"""Quick DB connectivity test"""
import asyncio
from casino.models.session import engine
from sqlalchemy import text

async def test():
    async with engine.begin() as conn:
        r = await conn.execute(text("SELECT 1"))
        print("DB connected:", r.scalar())
        r = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema='public' ORDER BY table_name"
        ))
        for row in r:
            print(" ", row[0])

asyncio.run(test())
