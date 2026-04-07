from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import ChatMessage, ChatSession, Document, User, JDRecord, OfferLetterRecord, ResumeScanJob

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total questions asked by this user
    total_q_result = await db.execute(
        select(func.count(ChatMessage.id))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == current_user.id, ChatMessage.role == "user")
    )
    total_questions = total_q_result.scalar() or 0

    # Unique questions
    unique_q_result = await db.execute(
        select(func.count(func.distinct(ChatMessage.content)))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == current_user.id, ChatMessage.role == "user")
    )
    unique_questions = unique_q_result.scalar() or 0

    # Avg response time
    avg_time_result = await db.execute(
        select(func.avg(ChatMessage.response_time_ms))
        .join(ChatSession, ChatMessage.session_id == ChatSession.id)
        .where(
            ChatSession.user_id == current_user.id,
            ChatMessage.role == "assistant",
            ChatMessage.response_time_ms.isnot(None),
        )
    )
    avg_ms = avg_time_result.scalar() or 0
    avg_minutes = int(avg_ms // 60000)
    avg_seconds = int((avg_ms % 60000) // 1000)

    # Document count
    doc_count_result = await db.execute(
        select(func.count(Document.id)).where(Document.user_id == current_user.id)
    )
    doc_count = doc_count_result.scalar() or 0

    return {
        "total_questions": total_questions,
        "unique_questions": unique_questions,
        "avg_response_time": {"minutes": avg_minutes, "seconds": avg_seconds, "ms": int(avg_ms)},
        "documents_used": doc_count,
    }


@router.get("/scanned-resumes")
async def get_scanned_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResumeScanJob)
        .where(ResumeScanJob.user_id == current_user.id)
        .order_by(ResumeScanJob.created_at.desc())
    )
    jobs = result.scalars().all()
    output = []
    for job in jobs:
        rankings = (job.results or {}).get("rankings", [])
        top_score = max((r.get("score", 0) for r in rankings), default=0)
        output.append({
            "id": job.id,
            "candidate_name": job.candidate_name or "Unknown",
            "role": job.role or "Unspecified",
            "top_score": top_score,
            "jd_text": job.jd_text[:100],
            "created_at": job.created_at.isoformat() if job.created_at else None,
        })
    # Sort by score descending
    output.sort(key=lambda x: x["top_score"], reverse=True)
    return output


@router.get("/jd-records")
async def get_jd_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(JDRecord)
        .where(JDRecord.user_id == current_user.id)
        .order_by(JDRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "department": r.department or "—",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/offer-records")
async def get_offer_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(OfferLetterRecord)
        .where(OfferLetterRecord.user_id == current_user.id)
        .order_by(OfferLetterRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "candidate_name": r.candidate_name,
            "position": r.position,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
