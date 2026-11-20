from typing import Any, List

from ..db.postgres import fetch_rows
from .gemini_client import GeminiClient


def _vector_literal(values: List[float]) -> str:
    return "[" + ",".join(f"{value:.8f}" for value in values) + "]"


async def retrieve_relevant_chunks(document_id: str, query: str, limit: int = 5) -> List[dict[str, Any]]:
    embedding = (await GeminiClient().embed_texts([query]))[0]
    vector = _vector_literal(embedding)
    rows = await fetch_rows(
        """
        SELECT chunk_text, page_number
        FROM document_chunks
        WHERE document_id = $1
        ORDER BY embedding <-> $2::vector
        LIMIT $3
        """,
        document_id,
        vector,
        limit,
    )
    return [dict(row) for row in rows]
