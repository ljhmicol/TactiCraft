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
from config import settings
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
        secure=settings.cookie_secure,
    )


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: schemas.UserRegister, response: Response, db: DbSession = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 가입된 이메일입니다")

    existing_username = db.query(models.User).filter(models.User.username == payload.username).first()
    if existing_username:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 사용자명입니다")

    user = models.User(
        email=payload.email,
        username=payload.username,
        password_hash=auth.hash_password(payload.password),
        created_at=_now(),
    )
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


@router.patch("/me/username", response_model=schemas.UserOut)
def change_username(
    payload: schemas.UsernameChange,
    db: DbSession = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    """내 정보 페이지의 닉네임 변경. 댓글에 이미 써넣은 과거 표시명(username
    컬럼, models.Comment 참조)은 의도적으로 그대로 둔다 — 그 당시 서명한
    이름이라 소급해서 바꾸면 "누가 언제 뭐라고 했는지" 기록이 흐려진다.
    """
    existing = (
        db.query(models.User)
        .filter(models.User.username == payload.username, models.User.id != user.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 사용 중인 사용자명입니다")
    user.username = payload.username
    db.commit()
    db.refresh(user)
    return user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: schemas.PasswordChange,
    request: Request,
    db: DbSession = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    if not auth.verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다")
    user.password_hash = auth.hash_password(payload.new_password)
    # 비밀번호를 바꾸면 이 브라우저를 뺀 다른 모든 세션을 끊는다 — 세션
    # 쿠키가 다른 기기에 남아 있었다면(공용 PC 등) 새 비밀번호로 잠그는
    # 의미가 없어지기 때문. 지금 쓰고 있는 세션(현재 쿠키)은 로그인 상태를
    # 유지해야 하므로 제외한다.
    current_token = request.cookies.get(auth.SESSION_COOKIE_NAME)
    db.query(models.Session).filter(
        models.Session.user_id == user.id, models.Session.token != current_token
    ).delete()
    db.commit()


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def withdraw(response: Response, db: DbSession = Depends(get_db), user: models.User = Depends(auth.get_current_user)):
    """회원 탈퇴 — 본인 소유 분석까지 함께 지운다(2026-09-09 사용자 결정).

    analyses를 먼저 지워야 한다 — Analysis.user_id FK에는 ondelete가 없어서
    (users를 참조하지만 CASCADE가 아님), 분석이 남아 있으면 users 삭제가
    FK 제약에 걸린다. 벌크 DELETE라도 DB 레벨 FK CASCADE(players/phases/...)는
    그대로 발동한다 — SQLite에서 FK 강제가 켜져 있어서다(database.py).
    """
    db.query(models.Analysis).filter(models.Analysis.user_id == user.id).delete()
    db.query(models.Session).filter(models.Session.user_id == user.id).delete()
    db.delete(user)
    db.commit()
    response.delete_cookie(auth.SESSION_COOKIE_NAME)
