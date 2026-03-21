import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect(
        "postgresql://postgres:NtaOuOnnabJuaTQOOnuCwBReWtsWBvKz@autorack.proxy.rlwy.net:26225/railway"
    )
    ver = await conn.fetchval("SELECT version_num FROM alembic_version")
    print(f"Current migration: {ver}")
    tables = await conn.fetch(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
    )
    print(f"Tables: {[t['tablename'] for t in tables]}")
    await conn.close()

asyncio.run(check())
