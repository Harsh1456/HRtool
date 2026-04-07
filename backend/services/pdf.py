"""PDF text extraction using PyMuPDF."""
import io
from typing import List, Tuple
import fitz  # PyMuPDF


def extract_text_from_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
    """
    Extract text from PDF bytes.
    Returns list of (page_number, text) tuples (1-indexed).
    """
    pages = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        if text.strip():
            pages.append((page_num + 1, text.strip()))
    doc.close()
    return pages


def extract_text_from_docx(file_bytes: bytes) -> List[Tuple[int, str]]:
    """
    Extract text from DOCX bytes.
    Returns list of (page_number, text) tuples — DOCX doesn't have real pages,
    so we return (1, full_text).
    """
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    full_text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())
    return [(1, full_text)] if full_text else []


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> List[str]:
    """
    Split text into chunks of ~chunk_size characters with overlap.
    """
    words = text.split()
    chunks = []
    current_chunk_words = []
    current_len = 0

    for word in words:
        current_chunk_words.append(word)
        current_len += len(word) + 1
        if current_len >= chunk_size:
            chunks.append(" ".join(current_chunk_words))
            # Overlap: keep last N chars worth of words
            overlap_words = []
            overlap_len = 0
            for w in reversed(current_chunk_words):
                overlap_len += len(w) + 1
                if overlap_len > overlap:
                    break
                overlap_words.insert(0, w)
            current_chunk_words = overlap_words
            current_len = sum(len(w) + 1 for w in current_chunk_words)

    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))

    return [c for c in chunks if len(c.strip()) > 50]
