-- Casino Platform - Database Initialization Script
-- This runs automatically when the PostgreSQL container starts

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for secure random generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE casino TO casino;

-- Create indexes for performance (additional to Alembic migrations)
-- These are created here for initial setup optimization

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Casino database initialized successfully!';
END $$;
