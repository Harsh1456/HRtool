import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from auth import get_current_user
from database import get_db
from models import ChatSession, ChatMessage, User
from services.rag import retrieve_chunks, generate_rag_answer

router = APIRouter(prefix="/api/chat", tags=["chat"])


class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class SessionCreate(BaseModel):
    title: str = "New Chat"


@router.post("/ask")
async def ask(
    body: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    start_time = time.time()

    # Get or create session
    session_id = body.session_id
    if session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id,
                ChatSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(
            user_id=current_user.id,
            title=body.question[:80],
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        role="user",
        content=body.question,
    )
    db.add(user_msg)

    # RAG: retrieve relevant chunks from the shared knowledge base
    chunks = await retrieve_chunks(
        query=body.question,
        db=db,
        top_k=6,
    )

    # Generate answer (returns {"answer": str, "source": "docs"|"general"|"both"})
    rag_result = await generate_rag_answer(question=body.question, chunks=chunks)
    answer = rag_result["answer"]
    answer_source = rag_result["source"]

    elapsed_ms = int((time.time() - start_time) * 1000)

    # Build sources list — only include what was actually used to answer
    from services.rag import SIMILARITY_THRESHOLD

    doc_sources = []
    seen = set()
    for chunk in chunks:
        # Only include chunks that were above the similarity threshold (i.e. actually used)
        if chunk.get("similarity", 0) < SIMILARITY_THRESHOLD:
            continue
        key = (chunk["filename"], chunk["page_number"])
        if key not in seen:
            seen.add(key)
            doc_sources.append({
                "filename": chunk["filename"],
                "page_number": chunk["page_number"],
                "document_id": chunk["document_id"],
                "similarity": round(chunk["similarity"], 3),
                "type": "document",
            })

    # Compose final sources list based on which tier(s) were used
    if answer_source == "docs":
        # Only uploaded documents — show them, no general knowledge entry
        sources = doc_sources

    elif answer_source == "general":
        # Answered entirely from general AI knowledge — do NOT list uploaded documents
        sources = [
            {
                "filename": "General AI Knowledge",
                "page_number": None,
                "document_id": None,
                "similarity": None,
                "type": "general",
            }
        ]

    else:  # "both"
        # Uploaded documents + general knowledge — show both
        sources = doc_sources + [
            {
                "filename": "General AI Knowledge",
                "page_number": None,
                "document_id": None,
                "similarity": None,
                "type": "general",
            }
        ]

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=answer,
        sources=sources,
        response_time_ms=elapsed_ms,
    )
    db.add(assistant_msg)
    await db.commit()

    return {
        "session_id": session_id,
        "question": body.question,
        "answer": answer,
        "sources": sources,
        "source": answer_source,
        "response_time_ms": elapsed_ms,
    }


@router.get("/sessions")
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in sessions
    ]


@router.post("/sessions")
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(user_id=current_user.id, title=body.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "title": session.title}


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    
    def derive_source(sources_list):
        if not sources_list or not isinstance(sources_list, list):
            return None
        has_general = any(isinstance(s, dict) and (s.get("type") == "general" or s.get("filename") == "General AI Knowledge") for s in sources_list)
        has_docs = any(isinstance(s, dict) and (s.get("type") == "document" or s.get("document_id") is not None) for s in sources_list)
        if has_general and has_docs:
            return "both"
        elif has_general:
            return "general"
        elif has_docs:
            return "docs"
        return None

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "source": derive_source(m.sources),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


class SessionUpdate(BaseModel):
    title: str

@router.put("/sessions/{session_id}")
async def rename_session(
    session_id: str,
    body: SessionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.title = body.title
    await db.commit()
    return {"id": session.id, "title": session.title}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted"}
