"""회원가입/로그인/로그아웃/내 정보 (TO-DO 11번).

비밀번호 재설정·이메일 인증은 범위 밖이다 — 이 프로젝트엔 메일 발송
인프라가 없다(가입 시 이메일 형식만 확인하고 실존 여부는 확인 안 함).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DbSession

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE_NAME,
        token,
        max_age=auth.SESSION_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
    )


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, response: Response, db: DbSession = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 가입된 이메일입니다")

    user = models.User(email=payload.email, password_hash=auth.hash_password(payload.password), created_at=_now())
    db.add(user)
    db.flush()  # user.id 확보

    # 첫 가입 계정에 주인 없는 기존 분석을 전부 귀속한다(2026-09-09 사용자
    # 결정) — 로그인이 생기기 전엔 사실상 1인용 로컬 앱이었으니, 그때 쌓인
    # 데이터의 유일한 주인은 맨 처음 계정을 만드는 사람이다.
    is_first_user = db.query(models.User).count() == 1
    if is_first_user:
        db.query(models.Analysis).filter(models.Analysis.user_id.is_(None)).update({"user_id": user.id})

    db.commit()
    db.refresh(user)

    token = auth.create_session(db, user.id)
    _set_session_cookie(response, token)
    return user


@router.post("/login", response_model=schemas.UserOut)
def login(payload: schemas.UserLogin, response: Response, db: DbSession = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다")

    token = auth.create_session(db, user.id)
    _set_session_cookie(response, token)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: DbSession = Depends(get_db)):
    token = request.cookies.get(auth.SESSION_COOKIE_NAME)
    if token:
        auth.destroy_session(db, token)
    response.delete_cookie(auth.SESSION_COOKIE_NAME)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(auth.get_current_user)):
    return user
