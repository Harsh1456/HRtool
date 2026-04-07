import os
from pydantic_settings import BaseSettings
from functools import lru_cache

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

class Settings(BaseSettings):
    openai_api_key: str = ""
    database_url: str = "postgresql+asyncpg://hr_user:hr_password@localhost:5433/hr_ai"
    jwt_secret: str = "change-me-please-use-a-real-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days
    frontend_url: str = "http://localhost:3000"
    backend_url: str = "http://localhost:8000"
    upload_dir: str = "./uploads"
    openai_chat_model: str = "gpt-4o"
    openai_embed_model: str = "text-embedding-3-small"
    embed_dimensions: int = 1536

    class Config:
        env_file = ENV_PATH
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
