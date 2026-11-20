import re
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse

from ..config import get_settings
from ..db.repositories import (
    create_document,
    delete_document_db,
    get_document_for_user,
    get_documents_for_user,
    get_messages_for_conversation,
    get_or_create_conversation,
    store_document_chunks,
    update_document_status,
)
from ..deps import get_current_user
from ..schemas import ChatMessage, DocumentSummary, UploadResponse, User
from ..services.pdf_ingestion import (
    chunk_text,
    create_chunk_embeddings,
    extract_page_chunks,
    extract_text_and_meta,
)
from ..services.storage import get_storage_service

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and special characters."""
    base = Path(filename).name
    clean = re.sub(r"[^\w\s\.-]", "", base).strip().lstrip(".")
    return clean or "document.pdf"


@router.get("/", response_model=list[DocumentSummary])
async def list_documents(current_user: User = Depends(get_current_user)) -> list[DocumentSummary]:
    rows = await get_documents_for_user(current_user.id)
    return [DocumentSummary(**row) for row in rows]


@router.get("/{document_id}/history", response_model=UploadResponse)
async def get_document_history(
    document_id: str, current_user: User = Depends(get_current_user)
) -> UploadResponse:
    document = await get_document_for_user(document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    conversation = await get_or_create_conversation(
        current_user.id, document_id, title=document["title"]
    )
    messages = await get_messages_for_conversation(conversation["id"])

    return UploadResponse(
        document=DocumentSummary(**document, conversation_id=conversation["id"]),
        history=[ChatMessage(**msg) for msg in messages],
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    current_user: User = Depends(get_current_user),
) -> UploadResponse:
    # 1. File size & signature validation
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    if len(pdf_bytes) < 5 or not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file. Header does not match PDF signature (%PDF-).",
        )

    # 2. Quota check
    user_docs = await get_documents_for_user(current_user.id)
    if len(user_docs) >= 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Free tier is limited to 5 documents. Please delete an older document to continue.",
        )

    # 3. Secure storage path generation
    original_name = sanitize_filename(Path(file.filename or title).name)
    storage_name = f"{current_user.id}/{uuid4()}-{original_name}"

    storage_service = get_storage_service()
    try:
        storage_service.upload_file(pdf_bytes, storage_name, content_type="application/pdf")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document to storage: {exc}",
        ) from exc

    # 4. Extract text & page count with page-aware chunking
    try:
        chunks, page_numbers, page_count = extract_page_chunks(pdf_bytes)
    except Exception as exc:
        storage_service.delete_file(storage_name)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupt or encrypted PDF file: {exc}",
        ) from exc

    # 5. Insert initial document record in Neon database
    document = await create_document(
        user_id=current_user.id,
        title=title,
        storage_path=storage_name,
        status="processing",
        file_size=len(pdf_bytes),
        page_count=page_count,
    )

    # 6. Generate Gemini embeddings and store in Neon pgvector with page numbers
    try:
        embeddings = await create_chunk_embeddings(chunks)
        await store_document_chunks(document["id"], chunks, embeddings, page_numbers=page_numbers)
        await update_document_status(document["id"], "ready", page_count=page_count)
        document["status"] = "ready"
    except Exception as exc:
        await update_document_status(document["id"], "failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to vectorize PDF: {exc}",
        ) from exc

    conversation = await get_or_create_conversation(
        current_user.id, document["id"], title=document["title"]
    )

    return UploadResponse(
        document=DocumentSummary(**document, conversation_id=conversation["id"]),
        history=[],
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str, current_user: User = Depends(get_current_user)
) -> Response:
    document = await get_document_for_user(document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete from Cloudflare R2 / storage
    storage_service = get_storage_service()
    try:
        storage_service.delete_file(document["storage_path"])
    except Exception:
        pass

    # Delete from Neon database (cascades to chunks, conversation, and messages)
    await delete_document_db(document_id, current_user.id)
    return Response(status_code=204)


@router.get("/{document_id}/preview")
async def get_document_preview(
    document_id: str, current_user: User = Depends(get_current_user)
) -> dict[str, str]:
    document = await get_document_for_user(document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    storage_service = get_storage_service()
    try:
        presigned_url = storage_service.generate_presigned_url(document["storage_path"], expires_in=3600)
        return {"url": presigned_url}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate preview URL: {exc}",
        ) from exc


@router.get("/raw/{user_id}/{filename}")
async def serve_raw_file(
    user_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Authenticated endpoint for local storage development fallback."""
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    settings = get_settings()
    local_path = Path(settings.local_storage_dir) / user_id / filename
    if not local_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(path=local_path, media_type="application/pdf")
