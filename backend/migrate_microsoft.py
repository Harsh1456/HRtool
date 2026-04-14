"""
One-off migration: adds Microsoft SSO support to the users table.

Run once:  python migrate_microsoft.py
"""
import asyncio
from sqlalchemy import text
from database import engine


async def migrate():
    async with engine.begin() as conn:
        # Allow hashed_password to be NULL for SSO-only accounts
        await conn.execute(text(
            "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"
        ))
        # Add microsoft_id column (unique, so we can look up SSO users)
        await conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS microsoft_id VARCHAR(255)"
        ))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_microsoft_id "
            "ON users (microsoft_id) WHERE microsoft_id IS NOT NULL"
        ))
        print("✅ Migration complete: hashed_password is now nullable, microsoft_id column added.")


if __name__ == "__main__":
    asyncio.run(migrate())
