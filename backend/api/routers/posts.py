import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.deps import get_current_user
from api.schemas import CommentCreate, CommentPublic, PostCreate, PostPublic, UserPublic
from api.storage import upload_file
from db.models import Comment, Follow, Like, Post, User
from db.session import get_db

router = APIRouter(prefix="/posts", tags=["posts"])


def _post_to_public(post: Post, likes_count: int, comments_count: int, is_liked: bool) -> PostPublic:
    return PostPublic(
        id=post.id,
        author=UserPublic.model_validate(post.author),
        image_url=post.image_url,
        caption=post.caption,
        likes_count=likes_count,
        comments_count=comments_count,
        is_liked=is_liked,
        created_at=post.created_at,
    )


@router.post("", response_model=PostPublic, status_code=status.HTTP_201_CREATED)
async def create_post(
    file: UploadFile,
    caption: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le fichier doit être une image")

    url = await upload_file(file, folder=f"posts/{current_user.id}")

    post = Post(author_id=current_user.id, image_url=url, caption=caption)
    db.add(post)
    await db.commit()
    await db.refresh(post, attribute_names=["author"])
    return _post_to_public(post, 0, 0, False)


@router.get("/feed", response_model=list[PostPublic])
async def get_feed(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    following_ids = select(Follow.following_id).where(Follow.follower_id == current_user.id)

    query = (
        select(Post)
        .where(Post.author_id.in_(following_ids) | (Post.author_id == current_user.id))
        .options(selectinload(Post.author))
        .order_by(Post.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    posts = result.scalars().all()

    response = []
    for post in posts:
        likes_count = (await db.execute(select(func.count()).where(Like.post_id == post.id))).scalar() or 0
        comments_count = (await db.execute(select(func.count()).where(Comment.post_id == post.id))).scalar() or 0
        is_liked_result = await db.execute(
            select(Like).where(Like.user_id == current_user.id, Like.post_id == post.id)
        )
        is_liked = is_liked_result.scalar_one_or_none() is not None
        response.append(_post_to_public(post, likes_count, comments_count, is_liked))

    return response


@router.get("/explore", response_model=list[PostPublic])
async def explore(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Post)
        .options(selectinload(Post.author))
        .order_by(Post.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    posts = result.scalars().all()

    response = []
    for post in posts:
        likes_count = (await db.execute(select(func.count()).where(Like.post_id == post.id))).scalar() or 0
        comments_count = (await db.execute(select(func.count()).where(Comment.post_id == post.id))).scalar() or 0
        is_liked_result = await db.execute(
            select(Like).where(Like.user_id == current_user.id, Like.post_id == post.id)
        )
        is_liked = is_liked_result.scalar_one_or_none() is not None
        response.append(_post_to_public(post, likes_count, comments_count, is_liked))

    return response


@router.get("/{post_id}", response_model=PostPublic)
async def get_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id).options(selectinload(Post.author)))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post introuvable")

    likes_count = (await db.execute(select(func.count()).where(Like.post_id == post.id))).scalar() or 0
    comments_count = (await db.execute(select(func.count()).where(Comment.post_id == post.id))).scalar() or 0
    is_liked_result = await db.execute(select(Like).where(Like.user_id == current_user.id, Like.post_id == post.id))
    return _post_to_public(post, likes_count, comments_count, is_liked_result.scalar_one_or_none() is not None)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post introuvable")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Non autorisé")
    await db.delete(post)
    await db.commit()


# --- Likes ---
@router.post("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def like_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post introuvable")

    existing = await db.execute(select(Like).where(Like.user_id == current_user.id, Like.post_id == post_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Déjà liké")

    db.add(Like(user_id=current_user.id, post_id=post_id))
    await db.commit()


@router.delete("/{post_id}/like", status_code=status.HTTP_204_NO_CONTENT)
async def unlike_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Like).where(Like.user_id == current_user.id, Like.post_id == post_id))
    like = result.scalar_one_or_none()
    if not like:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Like introuvable")
    await db.delete(like)
    await db.commit()


# --- Comments ---
@router.get("/{post_id}/comments", response_model=list[CommentPublic])
async def get_comments(
    post_id: uuid.UUID,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Comment)
        .where(Comment.post_id == post_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{post_id}/comments", response_model=CommentPublic, status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: uuid.UUID,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post introuvable")

    comment = Comment(post_id=post_id, author_id=current_user.id, content=body.content)
    db.add(comment)
    await db.commit()
    await db.refresh(comment, attribute_names=["author"])
    return comment
