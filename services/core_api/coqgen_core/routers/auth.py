"""Planner authentication endpoints — login (JWT) and current user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from coqgen_schemas import LoginRequest, Token, UserOut

from ..auth_deps import CurrentUser, create_access_token, get_current_user, verify_password
from ..db import get_session

router = APIRouter(prefix="/auth", tags=["auth"])

_USER_SELECT = (
    "SELECT u.id, u.username, u.full_name, u.role, u.email, u.avatar_url, "
    "u.password_hash, u.dept_id, d.key AS dept_key "
    "FROM app_user u LEFT JOIN planner_department d ON d.id = u.dept_id "
)


@router.post("/login", response_model=Token)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)) -> Token:
    row = (
        await session.execute(
            text(_USER_SELECT + "WHERE (u.username = :id OR u.email = :id) AND u.is_active"),
            {"id": body.username},
        )
    ).mappings().first()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid username or password"
        )
    user = UserOut(
        id=str(row["id"]),
        username=row["username"],
        full_name=row["full_name"],
        role=row["role"],
        email=row["email"],
        avatar_url=row["avatar_url"],
        dept_id=str(row["dept_id"]) if row["dept_id"] else None,
        dept_key=row["dept_key"],
    )
    token = create_access_token(subject=user.id, role=user.role)
    return Token(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
async def me(
    current: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserOut:
    row = (
        await session.execute(
            text(_USER_SELECT + "WHERE u.id = :id"), {"id": current.id}
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user not found")
    return UserOut(
        id=str(row["id"]),
        username=row["username"],
        full_name=row["full_name"],
        role=row["role"],
        email=row["email"],
        avatar_url=row["avatar_url"],
        dept_id=str(row["dept_id"]) if row["dept_id"] else None,
        dept_key=row["dept_key"],
    )
