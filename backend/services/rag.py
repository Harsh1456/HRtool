"""Core RAG service: embed, store, retrieve, generate."""
import time
from typing import List, Dict, Any

from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models import DocumentChunk, Document

settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.openai_api_key)


async def embed_text(text_input: str) -> List[float]:
    """Get OpenAI embedding for a text string."""
    response = await openai_client.embeddings.create(
        model=settings.openai_embed_model,
        input=text_input,
        dimensions=settings.embed_dimensions,
    )
    return response.data[0].embedding


async def embed_batch(texts: List[str]) -> List[List[float]]:
    """Embed a batch of texts."""
    response = await openai_client.embeddings.create(
        model=settings.openai_embed_model,
        input=texts,
        dimensions=settings.embed_dimensions,
    )
    return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]


async def retrieve_chunks(
    query: str,
    db: AsyncSession,
    top_k: int = 6,
) -> List[Dict[str, Any]]:
    """
    Embed the query and return top-k most similar chunks
    from the shared organisation-wide document pool.
    """
    query_embedding = await embed_text(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    sql = text("""
        SELECT
            dc.id,
            dc.chunk_text,
            dc.page_number,
            dc.chunk_index,
            d.filename,
            d.id AS document_id,
            1 - (dc.embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.embedding IS NOT NULL
        ORDER BY dc.embedding <=> CAST(:embedding AS vector)
        LIMIT :top_k
    """)

    result = await db.execute(sql, {
        "embedding": embedding_str,
        "top_k": top_k,
    })
    rows = result.fetchall()

    return [
        {
            "chunk_id": row.id,
            "chunk_text": row.chunk_text,
            "page_number": row.page_number,
            "filename": row.filename,
            "document_id": row.document_id,
            "similarity": float(row.similarity),
        }
        for row in rows
    ]


async def generate_rag_answer(
    question: str,
    chunks: List[Dict[str, Any]],
) -> str:
    """
    Generate a cited answer using GPT-4o given retrieved chunks.
    """
    if not chunks:
        return "I couldn't find relevant information in the uploaded HR documents. Please ensure the relevant policy documents have been uploaded."

    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[Source {i}: {chunk['filename']}, Page {chunk['page_number']}]\n{chunk['chunk_text']}"
        )
    context = "\n\n---\n\n".join(context_parts)

    system_prompt = """You are an expert HR assistant for this company. Answer questions strictly based on the provided HR policy documents.

Rules:
- Only answer based on the provided document excerpts
- Be precise and cite sources naturally in your answer
- If information is not in the documents, say so clearly
- Format your answer in clear paragraphs
- Bold key facts or policy numbers"""

    user_prompt = f"""Based on the following HR document excerpts, answer this question:

Question: {question}

Document Excerpts:
{context}

Please provide a comprehensive, cited answer."""

    response = await openai_client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=1500,
    )

    return response.choices[0].message.content
