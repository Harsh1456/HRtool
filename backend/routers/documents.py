import os
import time
from typing import List

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from auth import get_current_user
from database import get_db
from models import Document, DocumentChunk, User
from services.pdf import extract_text_from_pdf, extract_text_from_docx, chunk_text
from services.rag import embed_batch
from config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


class DocumentOut(BaseModel):
    id: str
    filename: str
    file_size: int | None
    page_count: int | None
    uploaded_at: str

    class Config:
        from_attributes = True


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported. Use PDF or DOCX.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max 50 MB allowed.")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Save file to disk
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = f"{int(time.time())}_{current_user.id}_{file.filename}"
    file_path = os.path.join(settings.upload_dir, safe_name)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_bytes)

    # Extract text
    pages = []
    if ext == ".pdf":
        pages = extract_text_from_pdf(file_bytes)
    elif ext in {".docx", ".doc"}:
        pages = extract_text_from_docx(file_bytes)

    page_count = max((p for p, _ in pages), default=0) if pages else 0

    # Create document record
    doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_size=len(file_bytes),
        page_count=page_count,
    )
    db.add(doc)
    await db.flush()  # get doc.id

    # Chunk + embed
    all_chunks = []
    global_idx = 0
    for page_num, page_text in pages:
        chunks = chunk_text(page_text)
        for chunk in chunks:
            all_chunks.append({
                "document_id": doc.id,
                "chunk_text": chunk,
                "page_number": page_num,
                "chunk_index": global_idx,
            })
            global_idx += 1

    if all_chunks:
        # Batch embed
        texts = [c["chunk_text"] for c in all_chunks]
        embeddings = await embed_batch(texts)

        for chunk_data, embedding in zip(all_chunks, embeddings):
            db_chunk = DocumentChunk(
                document_id=chunk_data["document_id"],
                chunk_text=chunk_data["chunk_text"],
                page_number=chunk_data["page_number"],
                chunk_index=chunk_data["chunk_index"],
                embedding=embedding,
            )
            db.add(db_chunk)

    await db.commit()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "chunks_created": len(all_chunks),
        "message": f"Document uploaded and indexed successfully ({len(all_chunks)} chunks).",
    }


@router.post("/extract-text")
async def extract_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported. Use PDF or DOCX.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large.")
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    pages = []
    if ext == ".pdf":
        pages = extract_text_from_pdf(file_bytes)
    elif ext in {".docx", ".doc"}:
        pages = extract_text_from_docx(file_bytes)

    text = "\n".join(page_text for _, page_text in pages)
    return {"text": text}


@router.get("")
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document, User.full_name.label("uploader_name"))
        .join(User, Document.user_id == User.id)
        .order_by(Document.uploaded_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_size": d.file_size,
            "page_count": d.page_count,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "uploaded_by": uploader_name,
        }
        for d, uploader_name in rows
    ]


class DocumentRename(BaseModel):
    filename: str

@router.put("/{doc_id}")
async def rename_document(
    doc_id: str,
    data: DocumentRename,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.filename = data.filename
    await db.commit()
    return {"message": "Document renamed successfully", "filename": doc.filename}


@router.get("/{doc_id}/view")
async def view_document(
    doc_id: str,
    page: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File missing from disk")

    if page is not None and doc.filename.lower().endswith('.pdf'):
        import fitz
        try:
            src_pdf = fitz.open(doc.file_path)
            if 1 <= page <= len(src_pdf):
                out_pdf = fitz.open()
                out_pdf.insert_pdf(src_pdf, from_page=page-1, to_page=page-1)
                pdf_bytes = out_pdf.write()
                out_pdf.close()
                src_pdf.close()
                return Response(content=pdf_bytes, media_type="application/pdf")
            src_pdf.close()
        except:
            pass

    media_type = "application/pdf" if doc.filename.lower().endswith('.pdf') else "application/octet-stream"
    return FileResponse(doc.file_path, media_type=media_type)


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    try:
        if os.path.exists(doc.file_path):
            os.remove(doc.file_path)
    except Exception:
        pass

    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted successfully"}
