from datetime import datetime
from typing import Optional, List
import uuid

from sqlalchemy import (
    String, Text, Integer, Float, DateTime, ForeignKey,
    Boolean, JSON, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ── User ──────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="hr_user")  # hr_admin | hr_user
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    microsoft_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    documents: Mapped[List["Document"]] = relationship("Document", back_populates="user", cascade="save-update, merge")
    chat_sessions: Mapped[List["ChatSession"]] = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    jd_records: Mapped[List["JDRecord"]] = relationship("JDRecord", back_populates="user", cascade="all, delete-orphan")
    offer_records: Mapped[List["OfferLetterRecord"]] = relationship("OfferLetterRecord", back_populates="user", cascade="all, delete-orphan")
    resume_jobs: Mapped[List["ResumeScanJob"]] = relationship("ResumeScanJob", back_populates="user", cascade="all, delete-orphan")


# ── Document ──────────────────────────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="documents")
    chunks: Mapped[List["DocumentChunk"]] = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


# ── DocumentChunk ─────────────────────────────────────────────────────────────
class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    document_id: Mapped[str] = mapped_column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536), nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="chunks")


# ── ChatSession ───────────────────────────────────────────────────────────────
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="New Chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship("User", back_populates="chat_sessions")
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")


# ── ChatMessage ───────────────────────────────────────────────────────────────
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    sources: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["ChatSession"] = relationship("ChatSession", back_populates="messages")


# ── JDRecord ──────────────────────────────────────────────────────────────────
class JDRecord(Base):
    __tablename__ = "jd_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    form_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="jd_records")


# ── OfferLetterRecord ─────────────────────────────────────────────────────────
class OfferLetterRecord(Base):
    __tablename__ = "offer_letter_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    position: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    form_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="offer_records")


# ── ResumeScanJob ─────────────────────────────────────────────────────────────
class ResumeScanJob(Base):
    __tablename__ = "resume_scan_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jd_text: Mapped[str] = mapped_column(Text, nullable=False)
    candidate_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="resume_jobs")
