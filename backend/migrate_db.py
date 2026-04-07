import asyncio
from config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine

async def run_migration():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    
    async with engine.begin() as conn:
        try:
            await conn.execute(__import__("sqlalchemy").text(
                "ALTER TABLE resume_scan_jobs ADD COLUMN candidate_name VARCHAR;"
            ))
            print("Added candidate_name column.")
        except Exception as e:
            print(f"Error adding candidate_name: {e}")
            
        try:
            await conn.execute(__import__("sqlalchemy").text(
                "ALTER TABLE resume_scan_jobs ADD COLUMN role VARCHAR;"
            ))
            print("Added role column.")
        except Exception as e:
            print(f"Error adding role: {e}")
            
    await engine.dispose()
    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(run_migration())
