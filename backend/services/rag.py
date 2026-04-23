"""Core RAG service: embed, store, retrieve, generate."""
import json
import time
from typing import List, Dict, Any, Tuple

from openai import AsyncOpenAI
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from models import DocumentChunk, Document

settings = get_settings()
openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

# Minimum similarity score to consider a document chunk "relevant"
SIMILARITY_THRESHOLD = 0.35


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
) -> Dict[str, str]:
    """
    Generate a plain-language answer using GPT-4o.

    Two-tier strategy:
      1. If relevant document chunks exist (similarity >= threshold), answer from docs.
      2. If no chunks or all chunks are below the threshold, fall back to general AI knowledge.

    Returns:
        dict with keys:
          - "answer": the plain-language response string
          - "source": one of "docs", "general", or "both"
    """
    # Filter for relevant chunks above the similarity threshold
    relevant_chunks = [c for c in chunks if c.get("similarity", 0) >= SIMILARITY_THRESHOLD]
    has_relevant_docs = len(relevant_chunks) > 0

    system_prompt = """You are an HR assistant. Your job is to help all employees easily understand company policies.

LANGUAGE RULES — always follow these:
- Respond in plain, simple language
- Use short, clear sentences
- Avoid technical jargon, complex HR or legal terminology
- Explain concepts as if speaking to someone with no prior HR knowledge
- Use everyday words wherever possible
- Ensure any employee, regardless of background, can easily understand your response

ANSWERING STRATEGY:
1. Check the document excerpts provided below first
2. If they contain a useful answer → use them and set source to "docs"
3. If the excerpts are empty or not helpful → answer from your general HR knowledge and set source to "general"
4. If you used both → set source to "both"

IMPORTANT: Always respond with ONLY a valid JSON object in this exact format (no markdown, no explanation outside):
{
  "answer": "your plain-language answer here",
  "source": "docs"
}"""

    if has_relevant_docs:
        context_parts = []
        for i, chunk in enumerate(relevant_chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk['filename']}, Page {chunk['page_number']}]\n{chunk['chunk_text']}"
            )
        context = "\n\n---\n\n".join(context_parts)
        user_prompt = f"""Answer this question using the document excerpts below. Use plain, simple language.

Question: {question}

Document Excerpts:
{context}

Remember: respond only with the JSON object as instructed."""
    else:
        user_prompt = f"""Answer this HR question using your general knowledge. Use plain, simple language.
No document excerpts are available, so rely on your trained HR knowledge.

Question: {question}

Remember: respond only with the JSON object as instructed."""

    response = await openai_client.chat.completions.create(
        model=settings.openai_chat_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        max_tokens=1500,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or ""

    try:
        parsed = json.loads(raw)
        answer = parsed.get("answer", "").strip()
        source = parsed.get("source", "general" if not has_relevant_docs else "docs")
        # Validate source value
        if source not in ("docs", "general", "both"):
            source = "general" if not has_relevant_docs else "docs"
        if not answer:
            raise ValueError("Empty answer")
        return {"answer": answer, "source": source}
    except Exception:
        # Fallback: return raw content as answer
        fallback_answer = raw.strip() or "Sorry, I couldn't generate an answer. Please try again."
        return {
            "answer": fallback_answer,
            "source": "general" if not has_relevant_docs else "docs",
        }
