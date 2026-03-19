"""Reset database schema - use only for initial deployment cleanup."""
import asyncio
import os

import asyncpg


async def reset():
    url = os.environ.get("DB_URL", "")
    # asyncpg needs plain postgresql:// scheme
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    url = url.replace("postgres://", "postgresql://")
    conn = await asyncpg.connect(url)
    await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    await conn.close()
    print("Database schema reset successfully")


if __name__ == "__main__":
    asyncio.run(reset())
