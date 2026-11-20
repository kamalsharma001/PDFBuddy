from fastapi import APIRouter, Depends, HTTPException, status

from ..db.repositories import (
    create_message,
    get_document_for_user,
    get_messages_for_conversation,
    get_or_create_conversation,
)
from ..deps import get_current_user
from ..schemas import ChatMessage, ChatRequest, ChatResponse, User
from ..services.gemini_client import GeminiClient
from ..services.retrieval import retrieve_relevant_chunks

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def chat_with_document(
    payload: ChatRequest, current_user: User = Depends(get_current_user)
) -> ChatResponse:
    document = await get_document_for_user(payload.document_id, current_user.id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if document["status"] != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is still processing or failed to vectorize. Please wait until ready.",
        )

    # Resolve or create conversation thread
    if payload.conversation_id:
        conversation_id = payload.conversation_id
    else:
        conversation = await get_or_create_conversation(
            current_user.id, payload.document_id, title=document["title"]
        )
        conversation_id = conversation["id"]

    # Record user message
    await create_message(conversation_id, "user", payload.message)

    # Retrieve context and generate answer
    previous_messages = await get_messages_for_conversation(conversation_id)
    relevant_chunks = await retrieve_relevant_chunks(payload.document_id, payload.message)
    answer = await GeminiClient().answer_question(
        payload.message,
        relevant_chunks,
        [{"role": msg["role"], "content": msg["content"]} for msg in previous_messages],
    )

    # Record assistant message
    await create_message(conversation_id, "assistant", answer)
    final_history = await get_messages_for_conversation(conversation_id)

    return ChatResponse(
        conversation_id=conversation_id,
        answer=answer,
        history=[ChatMessage(**msg) for msg in final_history],
    )
