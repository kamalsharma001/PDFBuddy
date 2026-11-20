from typing import List, Optional
from pydantic import BaseModel, Field


class User(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)


class AuthStatusResponse(BaseModel):
    status: str
    message: str
    user: Optional[User] = None


class Document(BaseModel):
    id: str
    user_id: str
    title: str
    storage_path: str
    status: str
    file_size: Optional[int] = 0
    page_count: Optional[int] = 0
    created_at: Optional[str] = None


class DocumentSummary(Document):
    conversation_id: Optional[str] = None
    last_message_preview: Optional[str] = None


class ConversationSummary(BaseModel):
    id: str
    user_id: str
    document_id: str
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ChatMessage(BaseModel):
    id: Optional[str] = None
    role: str
    content: str
    created_at: Optional[str] = None


class ChatRequest(BaseModel):
    document_id: str
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    answer: str
    history: List[ChatMessage]


class UploadResponse(BaseModel):
    document: DocumentSummary
    history: List[ChatMessage]
