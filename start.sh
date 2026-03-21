#!/bin/sh
set -e

echo "=== Starting deployment ==="

echo "Step 1: Running Alembic migrations..."
alembic upgrade head

echo "Step 2: Starting uvicorn..."
exec uvicorn casino.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
