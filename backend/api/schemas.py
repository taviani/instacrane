import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# --- Auth ---
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(None, max_length=50)


class LoginRequest(BaseModel):
    login: str  # username ou email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- User ---
class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str | None
    bio: str | None
    avatar_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserProfile(UserPublic):
    posts_count: int
    followers_count: int
    following_count: int
    is_following: bool = False


class UserUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=50)
    bio: str | None = Field(None, max_length=300)


# --- Post ---
class PostCreate(BaseModel):
    caption: str | None = Field(None, max_length=2200)


class PostPublic(BaseModel):
    id: uuid.UUID
    author: UserPublic
    image_url: str
    caption: str | None
    likes_count: int
    comments_count: int
    is_liked: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Comment ---
class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=500)


class CommentPublic(BaseModel):
    id: uuid.UUID
    author: UserPublic
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Pagination ---
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    per_page: int
