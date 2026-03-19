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
    # Drop all custom enum types and the schema
    enums = await conn.fetch(
        "SELECT typname FROM pg_type WHERE typtype = 'e' AND typnamespace = "
        "(SELECT oid FROM pg_namespace WHERE nspname = 'public')"
    )
    for enum in enums:
        await conn.execute(f'DROP TYPE IF EXISTS "{enum["typname"]}" CASCADE')
    await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    await conn.close()
    print("Database schema reset successfully")


if __name__ == "__main__":
    asyncio.run(reset())
