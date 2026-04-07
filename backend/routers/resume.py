import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI

from auth import get_current_user
from database import get_db
from models import ResumeScanJob, User
from services.pdf import extract_text_from_pdf, extract_text_from_docx
from config import get_settings

settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
router = APIRouter(prefix="/api/resume", tags=["resume"])


class ResumeRenameRequest(BaseModel):
    candidate_name: Optional[str] = None
    role: Optional[str] = None


@router.post("/scan")
async def scan_resumes(
    jd_text: str = Form(...),
    files: List[UploadFile] = File(...),
    candidate_name: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Job description text is required")
    if not files:
        raise HTTPException(status_code=400, detail="At least one resume file is required")

    # Extract text from each resume
    resumes = []
    for file in files:
        file_bytes = await file.read()
        ext = (file.filename or "").rsplit(".", 1)[-1].lower()
        try:
            if ext == "pdf":
                pages = extract_text_from_pdf(file_bytes)
            elif ext in ("docx", "doc"):
                pages = extract_text_from_docx(file_bytes)
            else:
                continue
            full_text = "\n".join(text for _, text in pages)
            if full_text.strip():
                resumes.append({"filename": file.filename, "text": full_text[:4000]})
        except Exception:
            continue

    if not resumes:
        raise HTTPException(status_code=400, detail="Could not extract text from any of the uploaded files.")

    # Build prompt for GPT-4o to rank resumes
    resumes_block = "\n\n---\n\n".join(
        f"Resume {i+1} (File: {r['filename']}):\n{r['text']}"
        for i, r in enumerate(resumes)
    )

    prompt = f"""You are an expert HR recruiter. Analyze the following resumes against the provided job description and rank them.

JOB DESCRIPTION:
{jd_text[:3000]}

RESUMES:
{resumes_block}

For each resume, provide:
- rank (1 = best fit)
- filename
- score (0-100)
- recommended_level: "Senior" | "Mid" | "Entry" | "Not Suitable"
- strengths: list of 2-3 specific strengths matching the JD
- gaps: list of 2-3 specific gaps or missing requirements

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {{
    "rank": 1,
    "filename": "Resume_Name.pdf",
    "score": 85,
    "recommended_level": "Mid",
    "strengths": ["strength 1", "strength 2"],
    "gaps": ["gap 1", "gap 2"]
  }}
]"""

    response = await openai_client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": "You are an expert HR recruiter. Always respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            if "results" in parsed and isinstance(parsed["results"], list):
                results = parsed["results"]
            elif "rankings" in parsed and isinstance(parsed["rankings"], list):
                results = parsed["rankings"]
            elif "rank" in parsed and "score" in parsed:
                results = [parsed]
            else:
                # Try to extract the first list value found
                list_vals = [v for v in parsed.values() if isinstance(v, list)]
                results = list_vals[0] if list_vals else []
        elif isinstance(parsed, list):
            results = parsed
        else:
            results = []
    except Exception:
        results = []
        
    if not isinstance(results, list):
        results = []

    # Post-process to ensure score is integer and fields exist
    cleaned_results = []
    for r in results:
        if not isinstance(r, dict):
            continue
        try:
            # Coerce score to int
            score = r.get("score")
            if isinstance(score, str):
                score = int("".join(filter(str.isdigit, score)) or 0)
            elif not isinstance(score, (int, float)):
                score = 0
            
            cleaned_results.append({
                "rank": int(r.get("rank") or 0),
                "filename": str(r.get("filename") or "Unknown"),
                "score": int(score),
                "recommended_level": str(r.get("recommended_level") or "Mid"),
                "strengths": list(r.get("strengths") or []),
                "gaps": list(r.get("gaps") or [])
            })
        except Exception:
            continue
    results = cleaned_results

    # Save job
    job = ResumeScanJob(
        user_id=current_user.id,
        jd_text=jd_text,
        candidate_name=candidate_name,
        role=role,
        results={"rankings": results},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {"job_id": job.id, "results": results}


@router.get("")
async def list_resume_scans(
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
        if not isinstance(rankings, list):
            rankings = []
        # Compute top score from rankings
        top_score = max((r.get("score", 0) for r in rankings if isinstance(r, dict)), default=0)
        output.append({
            "id": job.id,
            "candidate_name": job.candidate_name,
            "role": job.role,
            "jd_text": job.jd_text,
            "top_score": top_score,
            "resume_count": len(rankings),
            "results": rankings,
            "created_at": job.created_at.isoformat() if job.created_at else None,
        })
    return output


@router.put("/{job_id}")
async def rename_resume_scan(
    job_id: str,
    body: ResumeRenameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResumeScanJob).where(
            ResumeScanJob.id == job_id,
            ResumeScanJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")
    if body.candidate_name is not None:
        job.candidate_name = body.candidate_name
    if body.role is not None:
        job.role = body.role
    await db.commit()
    return {"ok": True}


@router.delete("/{job_id}")
async def delete_resume_scan(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ResumeScanJob).where(
            ResumeScanJob.id == job_id,
            ResumeScanJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found")
    await db.delete(job)
    await db.commit()
    return {"ok": True}
