#!/usr/bin/env python3
"""Setup PostgreSQL database for Casino"""
import subprocess
import sys
import os

# Path to psql
psql_path = r"C:\Program Files\PostgreSQL\16\bin\psql.exe"

# Set environment for postgres user (no password needed via socket)
env = os.environ.copy()

def run_psql(sql, user="postgres", password=None):
    """Run SQL command as specified user"""
    try:
        env = os.environ.copy()
        if password:
            env['PGPASSWORD'] = password
        # Try with postgres user first (local socket)
        result = subprocess.run(
            [psql_path, "-U", user, "-h", "localhost", "-c", sql],
            capture_output=True,
            text=True,
            timeout=10,
            env=env
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Timeout"
    except Exception as e:
        return False, "", str(e)

# Step 1: Create database casino
print("1. Creating database 'casino'...")
success, stdout, stderr = run_psql("CREATE DATABASE casino;", "postgres", "")
if success or "already exists" in stderr:
    print("   [OK] Database casino ready")
else:
    print(f"   [ERR] {stderr}")

# Step 2: Create user volde with password
print("\n2. Creating user 'volde'...")
success, stdout, stderr = run_psql("CREATE USER volde WITH PASSWORD 'volde';", "postgres", "")
if success or "already exists" in stderr:
    print("   [OK] User volde ready")
else:
    print(f"   [ERR] {stderr}")

# Step 3: Grant privileges to volde
print("\n3. Granting permissions...")
success, stdout, stderr = run_psql("GRANT ALL PRIVILEGES ON DATABASE casino TO volde;", "postgres", "")
if success or "already" in stderr:
    print("   [OK] Permissions granted")
else:
    print(f"   [ERR] {stderr}")

print("\n[SUCCESS] PostgreSQL setup complete!")
print("\nNow you can run migrations:")
print("  python -m alembic upgrade head")
