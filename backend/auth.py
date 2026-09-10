"""로그인 세션 유틸(TO-DO 11번, 이메일/비밀번호).

JWT 대신 DB 세션 테이블(models.Session)을 쓴다 — 로그아웃 시 즉시
무효화해야 하는데 JWT는 만료 전까지 서버가 통제할 방법이 없어서다.
세션 토큰은 httpOnly 쿠키에 담아 XSS로 못 훔치게 한다.
"""

import secrets
from datetime import datetime
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as DbSession

import models
from database import get_db

SESSION_COOKIE_NAME = "tacticore_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30일


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_session(db: DbSession, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.add(models.Session(token=token, user_id=user_id, created_at=_now()))
    db.commit()
    return token


def destroy_session(db: DbSession, token: str) -> None:
    db.query(models.Session).filter(models.Session.token == token).delete()
    db.commit()


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> models.User:
    """로그인 필수 엔드포인트용 의존성 — 없으면 401."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    session = db.query(models.Session).filter(models.Session.token == token).first()
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    user = db.query(models.User).filter(models.User.id == session.user_id).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    return user


def get_current_user_optional(request: Request, db: DbSession = Depends(get_db)) -> Optional[models.User]:
    """get_current_user와 같지만 비로그인이면 401 대신 None을 돌려준다.

    공유 링크(/share/:id, 로그인 여부와 무관하게 공개)에서 "지금 보는 내가
    이 분석의 소유자인가"(TO-DO 12번 댓글의 삭제 권한 UI 판정용)를 알아야
    하는데, 그 판정 자체는 로그인을 요구하면 안 된다 — 비로그인 방문자도
    분석은 볼 수 있어야 하기 때문이다.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    session = db.query(models.Session).filter(models.Session.token == token).first()
    if not session:
        return None
    return db.query(models.User).filter(models.User.id == session.user_id).first()
