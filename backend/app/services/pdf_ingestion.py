from io import BytesIO
from typing import List, Tuple
from pypdf import PdfReader

from .gemini_client import GeminiClient


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts text content from PDF bytes using pypdf."""
    reader = PdfReader(BytesIO(pdf_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(page.strip() for page in pages if page.strip())


def extract_text_and_meta(pdf_bytes: bytes) -> Tuple[str, int]:
    """Extracts combined text and total page count from PDF bytes."""
    reader = PdfReader(BytesIO(pdf_bytes))
    page_count = len(reader.pages)
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(page.strip() for page in pages if page.strip())
    return text, page_count


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
    """Splits text into overlapping chunks of characters."""
    normalized = " ".join(text.split())
    if not normalized:
        return []

    chunks: List[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + chunk_size, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(end - overlap, 0)
    return chunks


def extract_page_chunks(
    pdf_bytes: bytes, chunk_size: int = 1000, overlap: int = 150
) -> Tuple[List[str], List[int], int]:
    """Extracts chunks tagged with their exact 1-indexed page number.
    Returns (chunks, page_numbers, total_pages)."""
    reader = PdfReader(BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    all_chunks: List[str] = []
    all_page_numbers: List[int] = []

    for page_idx, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        clean_text = " ".join(raw_text.split())
        if not clean_text:
            continue
        p_chunks = chunk_text(clean_text, chunk_size=chunk_size, overlap=overlap)
        for c in p_chunks:
            all_chunks.append(c)
            all_page_numbers.append(page_idx)

    # Fallback if no text extracted per page
    if not all_chunks:
        combined_text, _ = extract_text_and_meta(pdf_bytes)
        fallback_chunks = chunk_text(combined_text, chunk_size=chunk_size, overlap=overlap)
        return fallback_chunks, [1] * len(fallback_chunks), total_pages

    return all_chunks, all_page_numbers, total_pages


async def create_chunk_embeddings(chunks: List[str]) -> List[List[float]]:
    """Generates 768-dim vector embeddings for chunks using Gemini API."""
    if not chunks:
        return []
    client = GeminiClient()
    return await client.embed_texts(chunks)
