import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user
from api.schemas import UserProfile, UserPublic, UserUpdate
from api.storage import upload_file
from db.models import Follow, Post, User
from db.session import get_db

router = APIRouter(prefix="/users", tags=["users"])


async def _build_profile(user: User, db: AsyncSession, current_user: User | None = None) -> UserProfile:
    posts_count = (await db.execute(select(func.count()).where(Post.author_id == user.id))).scalar() or 0
    followers_count = (await db.execute(select(func.count()).where(Follow.following_id == user.id))).scalar() or 0
    following_count = (await db.execute(select(func.count()).where(Follow.follower_id == user.id))).scalar() or 0

    is_following = False
    if current_user and current_user.id != user.id:
        result = await db.execute(
            select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == user.id)
        )
        is_following = result.scalar_one_or_none() is not None

    return UserProfile(
        **UserPublic.model_validate(user).model_dump(),
        posts_count=posts_count,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
    )


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_profile(current_user, db)


@router.patch("/me", response_model=UserPublic)
async def update_me(
    body: UserUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserPublic)
async def upload_avatar(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Le fichier doit être une image")

    url = await upload_file(file, folder=f"avatars/{current_user.id}")
    current_user.avatar_url = url
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/{username}", response_model=UserProfile)
async def get_user_profile(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")
    return await _build_profile(user, db, current_user)


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def follow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Impossible de se suivre soi-même")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")

    existing = await db.execute(
        select(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Déjà abonné")

    db.add(Follow(follower_id=current_user.id, following_id=user_id))
    await db.commit()


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        delete(Follow).where(Follow.follower_id == current_user.id, Follow.following_id == user_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Abonnement introuvable")
    await db.commit()


@router.get("/search/{query}", response_model=list[UserPublic])
async def search_users(query: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.username.ilike(f"%{query}%")).order_by(User.username).limit(20)
    )
    return result.scalars().all()
