"""Grant admin privileges to a user by username.
Usage: python scripts/grant_admin.py [username]
Default username: cam
"""
import asyncio
import asyncpg
import sys


USERNAME = sys.argv[1] if len(sys.argv) > 1 else "cam"


async def main():
    # Try multiple connection methods
    for dsn in [
        "postgresql://casino:casino_secret_2024@localhost:5432/casino",
        "postgresql://postgres:postgres@localhost:5432/casino",
        "postgresql://localhost:5432/casino",
    ]:
        try:
            conn = await asyncpg.connect(dsn)
            print(f"Connected with: {dsn}")
            break
        except Exception as e:
            print(f"Failed {dsn}: {e}")
            conn = None
    if conn is None:
        print("Could not connect to database with any credentials.")
        return
    try:
        # Check if is_admin column exists, add it if not
        col = await conn.fetchval(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'is_admin'"
        )
        if not col:
            await conn.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false")
            print("Added is_admin column to users table.")

        result = await conn.execute("UPDATE users SET is_admin = true WHERE username = $1", USERNAME)
        print(f"UPDATE result: {result}")

        row = await conn.fetchrow("SELECT username, is_admin FROM users WHERE username = $1", USERNAME)
        if row:
            print(f"User: {row['username']}, is_admin: {row['is_admin']}")
        else:
            print(f"User '{USERNAME}' not found in the database.")
            # List existing users
            rows = await conn.fetch("SELECT username, is_admin FROM users LIMIT 20")
            if rows:
                print("Existing users:")
                for r in rows:
                    print(f"  - {r['username']} (is_admin: {r['is_admin']})")
            else:
                print("No users in the database yet.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
