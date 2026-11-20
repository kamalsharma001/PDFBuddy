from typing import Any
from .postgres import execute, fetch_rows


async def upsert_user_by_google(
    email: str,
    name: str | None = None,
    avatar_url: str | None = None,
    google_id: str | None = None,
) -> dict[str, Any]:
    rows = await fetch_rows(
        """
        INSERT INTO users (email, name, avatar_url, google_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE
        SET name = COALESCE(excluded.name, users.name),
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            google_id = COALESCE(excluded.google_id, users.google_id)
        RETURNING id::text, email, name, avatar_url, google_id, created_at::text
        """,
        email,
        name,
        avatar_url,
        google_id,
    )
    return dict(rows[0])


async def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    rows = await fetch_rows(
        """
        SELECT id::text, email, name, avatar_url, google_id, created_at::text
        FROM users
        WHERE id = $1
        LIMIT 1
        """,
        user_id,
    )
    return dict(rows[0]) if rows else None


async def get_user_by_email(email: str) -> dict[str, Any] | None:
    rows = await fetch_rows(
        """
        SELECT id::text, email, name, avatar_url, google_id, password_hash, 
               reset_token_hash, reset_token_expires_at::text, created_at::text
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
        """,
        email,
    )
    return dict(rows[0]) if rows else None


async def create_user_with_password(
    email: str,
    password_hash: str,
    name: str | None = None,
) -> dict[str, Any]:
    rows = await fetch_rows(
        """
        INSERT INTO users (email, name, password_hash)
        VALUES (lower($1), $2, $3)
        RETURNING id::text, email, name, avatar_url, created_at::text
        """,
        email,
        name,
        password_hash,
    )
    return dict(rows[0])


async def set_user_password(user_id: str, password_hash: str) -> None:
    await execute(
        """
        UPDATE users
        SET password_hash = $2,
            reset_token_hash = NULL,
            reset_token_expires_at = NULL
        WHERE id = $1
        """,
        user_id,
        password_hash,
    )


async def set_password_reset_token(
    email: str,
    token_hash: str,
    expires_at_iso: str,
) -> bool:
    res = await execute(
        """
        UPDATE users
        SET reset_token_hash = $2,
            reset_token_expires_at = $3::timestamptz
        WHERE lower(email) = lower($1)
        """,
        email,
        token_hash,
        expires_at_iso,
    )
    return "UPDATE 1" in res


async def clear_password_reset_token(user_id: str) -> None:
    await execute(
        """
        UPDATE users
        SET reset_token_hash = NULL,
            reset_token_expires_at = NULL
        WHERE id = $1
        """,
        user_id,
    )


async def get_user_by_reset_token(token_hash: str) -> dict[str, Any] | None:
    rows = await fetch_rows(
        """
        SELECT id::text, email, name, reset_token_expires_at::text
        FROM users
        WHERE reset_token_hash = $1
          AND reset_token_expires_at > timezone('utc'::text, now())
        LIMIT 1
        """,
        token_hash,
    )
    return dict(rows[0]) if rows else None


async def create_document(
    user_id: str,
    title: str,
    storage_path: str,
    status: str = "processing",
    file_size: int = 0,
    page_count: int = 0,
) -> dict[str, Any]:
    rows = await fetch_rows(
        """
        INSERT INTO documents (user_id, title, storage_path, status, file_size, page_count)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id::text, user_id::text, title, storage_path, status, file_size, page_count, created_at::text
        """,
        user_id,
        title,
        storage_path,
        status,
        file_size,
        page_count,
    )
    return dict(rows[0])


async def update_document_status(document_id: str, status: str, page_count: int | None = None) -> None:
    if page_count is not None:
        await execute(
            "UPDATE documents SET status = $2, page_count = $3 WHERE id = $1",
            document_id,
            status,
            page_count,
        )
    else:
        await execute("UPDATE documents SET status = $2 WHERE id = $1", document_id, status)


async def delete_document_db(document_id: str, user_id: str) -> None:
    await execute("DELETE FROM documents WHERE id = $1 AND user_id = $2", document_id, user_id)


async def store_document_chunks(
    document_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
    page_numbers: list[int] | None = None,
) -> None:
    if page_numbers is None:
        page_numbers = [1] * len(chunks)
    for chunk, embedding, page_num in zip(chunks, embeddings, page_numbers, strict=True):
        vector = "[" + ",".join(f"{value:.8f}" for value in embedding) + "]"
        await execute(
            """
            INSERT INTO document_chunks (document_id, page_number, chunk_text, embedding)
            VALUES ($1, $2, $3, $4::vector)
            """,
            document_id,
            page_num,
            chunk,
            vector,
        )


async def get_documents_for_user(user_id: str) -> list[dict[str, Any]]:
    rows = await fetch_rows(
        """
        SELECT
          d.id::text,
          d.user_id::text,
          d.title,
          d.storage_path,
          d.status,
          d.file_size,
          d.page_count,
          d.created_at::text,
          c.id::text AS conversation_id,
          (
            SELECT m.content
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) AS last_message_preview
        FROM documents d
        LEFT JOIN LATERAL (
          SELECT id FROM conversations
          WHERE document_id = d.id AND user_id = d.user_id
          ORDER BY updated_at DESC
          LIMIT 1
        ) c ON true
        WHERE d.user_id = $1
        ORDER BY d.created_at DESC
        """,
        user_id,
    )
    return [dict(row) for row in rows]


async def get_document_for_user(document_id: str, user_id: str) -> dict[str, Any] | None:
    rows = await fetch_rows(
        """
        SELECT id::text, user_id::text, title, storage_path, status, file_size, page_count, created_at::text
        FROM documents
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        """,
        document_id,
        user_id,
    )
    return dict(rows[0]) if rows else None


async def get_or_create_conversation(user_id: str, document_id: str, title: str | None = None) -> dict[str, Any]:
    """Gets the most recently active conversation for user and doc, or creates a new one."""
    rows = await fetch_rows(
        """
        SELECT id::text, user_id::text, document_id::text, title, created_at::text, updated_at::text
        FROM conversations
        WHERE user_id = $1 AND document_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        user_id,
        document_id,
    )
    if rows:
        return dict(rows[0])

    default_title = title or "General Discussion"
    new_rows = await fetch_rows(
        """
        INSERT INTO conversations (user_id, document_id, title)
        VALUES ($1, $2, $3)
        RETURNING id::text, user_id::text, document_id::text, title, created_at::text, updated_at::text
        """,
        user_id,
        document_id,
        default_title,
    )
    return dict(new_rows[0])


async def create_conversation(user_id: str, document_id: str, title: str = "New Chat") -> dict[str, Any]:
    """Creates a new conversation thread for a document."""
    rows = await fetch_rows(
        """
        INSERT INTO conversations (user_id, document_id, title)
        VALUES ($1, $2, $3)
        RETURNING id::text, user_id::text, document_id::text, title, created_at::text, updated_at::text
        """,
        user_id,
        document_id,
        title,
    )
    return dict(rows[0])


async def get_conversations_for_document(user_id: str, document_id: str) -> list[dict[str, Any]]:
    rows = await fetch_rows(
        """
        SELECT id::text, user_id::text, document_id::text, title, created_at::text, updated_at::text
        FROM conversations
        WHERE user_id = $1 AND document_id = $2
        ORDER BY updated_at DESC
        """,
        user_id,
        document_id,
    )
    return [dict(row) for row in rows]


async def create_message(conversation_id: str, role: str, content: str) -> dict[str, Any]:
    rows = await fetch_rows(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES ($1, $2, $3)
        RETURNING id::text, role, content, created_at::text
        """,
        conversation_id,
        role,
        content,
    )
    # Update conversation's updated_at timestamp
    await execute(
        "UPDATE conversations SET updated_at = timezone('utc'::text, now()) WHERE id = $1",
        conversation_id,
    )
    return dict(rows[0])


async def get_messages_for_conversation(conversation_id: str) -> list[dict[str, Any]]:
    rows = await fetch_rows(
        """
        SELECT id::text, role, content, created_at::text
        FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        """,
        conversation_id,
    )
    return [dict(row) for row in rows]
