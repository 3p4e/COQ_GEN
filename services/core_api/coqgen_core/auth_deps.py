"""Planner authentication — JWT bearer + role-based access control.

The CoQ desktop app keeps the X-COQGEN-Token scheme (see deps.require_session); the
planner uses real per-user JWT login instead. Passwords are bcrypt-hashed (the bcrypt
library directly — compatible with pgcrypto's gen_salt('bf') used in the demo seed).
Tokens are signed with settings.jwt_secret — override it outside dev.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_session

_bearer = HTTPBearer(auto_error=False)
# bcrypt operates on the first 72 bytes; truncate explicitly (bcrypt>=4 raises otherwise).
_BCRYPT_MAX = 72


class CurrentUser(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    dept_id: str | None = None


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:_BCRYPT_MAX], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8")[:_BCRYPT_MAX], bcrypt.gensalt()).decode("utf-8")


def create_access_token(*, subject: str, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=s.jwt_ttl_minutes)).timestamp()),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> CurrentUser:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token")
    s = get_settings()
    try:
        payload = jwt.decode(creds.credentials, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="malformed token")
    row = (
        await session.execute(
            text(
                "SELECT id, username, full_name, role, dept_id "
                "FROM app_user WHERE id = :id AND is_active"
            ),
            {"id": user_id},
        )
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user not found or inactive")
    return CurrentUser(
        id=str(row["id"]),
        username=row["username"],
        full_name=row["full_name"],
        role=row["role"],
        dept_id=str(row["dept_id"]) if row["dept_id"] else None,
    )


def require_role(*roles: str):
    """Dependency factory: 403 unless the current user holds one of `roles`."""

    async def _checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if roles and user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"requires role in {sorted(roles)}",
            )
        return user

    return _checker
