import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import init_db
from routers import auth, documents, chat, jd, offer_letter, resume, insights

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: init DB tables
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="HR AI Super Assistant API",
    description="RAG-based HR chatbot backend — Ask HR Docs, JD Builder, Resume Scanner, and more.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(jd.router)
app.include_router(offer_letter.router)
app.include_router(resume.router)
app.include_router(insights.router)


@app.get("/")
async def health():
    return {"status": "ok", "app": "HR AI Super Assistant", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
