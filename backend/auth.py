"""로그인 세션 유틸(TO-DO 11번, 이메일/비밀번호).

JWT 대신 DB 세션 테이블(models.Session)을 쓴다 — 로그아웃 시 즉시
무효화해야 하는데 JWT는 만료 전까지 서버가 통제할 방법이 없어서다.
세션 토큰은 httpOnly 쿠키에 담아 XSS로 못 훔치게 한다.

세션 보안 강화(2026-09-20, 개선 로드맵 §5.5):
- DB에는 원문 토큰 대신 SHA-256 해시만 저장한다. sessions 테이블이(백업
  파일이든 SQL 인젝션이든) 어떤 경로로든 유출돼도 그 자체로는 쿠키를
  재구성할 수 없다. models.Session.token 컬럼은 NOT NULL UNIQUE라 별도
  컬럼을 추가하지 않고 이 컬럼에 해시를 그대로 담는다 — 이 마이그레이션
  전에 발급된 세션(원문 그대로 저장됨)은 해시로 조회되지 않아 자동으로
  무효화된다(재로그인 필요, 허용 가능한 부작용).
- expires_at을 둬서 세션이 영구히 살아있지 않게 한다. last_used_at은
  세션이 실제로 쓰이고 있는지 참고용으로만 기록한다(운영 관측 목적,
  현재 UI에서 노출하진 않음). 매 요청마다 쓰면 SQLite에 쓰기가 몰리므로
  5분 이상 지났을 때만 갱신한다.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session as DbSession

import models
from database import get_db

SESSION_COOKIE_NAME = "tacticore_session"
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30  # 30일
_LAST_USED_UPDATE_THRESHOLD_SECONDS = 60 * 5  # 5분 — 매 요청 쓰기 방지


def _now() -> datetime:
    return datetime.now()


def _now_str() -> str:
    return _now().isoformat(timespec="seconds")


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_session(db: DbSession, user_id: int) -> str:
    # 로그인 시점에 이 계정의 만료된 세션을 같이 치운다 — 별도 정리
    # 작업(크론 등) 없이도 sessions 테이블이 계속 불어나지 않는다. SQL에서
    # `NULL < now`는 NULL(거짓 취급)이라 expires_at이 아예 없는 해시 전환
    # 이전 세션은 이 조건만으로는 걸러지지 않는다 — is_(None)도 같이 잡는다.
    db.query(models.Session).filter(
        models.Session.user_id == user_id,
        or_(models.Session.expires_at.is_(None), models.Session.expires_at < _now_str()),
    ).delete()

    token = secrets.token_urlsafe(32)
    now = _now()
    expires_at = now + timedelta(seconds=SESSION_MAX_AGE_SECONDS)
    db.add(
        models.Session(
            token=_hash_token(token),
            user_id=user_id,
            created_at=now.isoformat(timespec="seconds"),
            expires_at=expires_at.isoformat(timespec="seconds"),
            last_used_at=now.isoformat(timespec="seconds"),
        )
    )
    db.commit()
    return token


def destroy_session(db: DbSession, token: str) -> None:
    db.query(models.Session).filter(models.Session.token == _hash_token(token)).delete()
    db.commit()


def _find_valid_session(db: DbSession, token: str) -> Optional[models.Session]:
    session = db.query(models.Session).filter(models.Session.token == _hash_token(token)).first()
    if not session:
        return None
    # expires_at이 없는 세션(해시 전환 이전 데이터가 혹시 남아 있어도)은
    # 만료된 것으로 취급한다 — 만료 시각을 모르는 세션을 유효하다고 볼 이유가 없다.
    if not session.expires_at or datetime.fromisoformat(session.expires_at) < _now():
        return None
    last_used = datetime.fromisoformat(session.last_used_at) if session.last_used_at else None
    if last_used is None or (_now() - last_used).total_seconds() > _LAST_USED_UPDATE_THRESHOLD_SECONDS:
        session.last_used_at = _now_str()
        db.commit()
    return session


def get_current_user(request: Request, db: DbSession = Depends(get_db)) -> models.User:
    """로그인 필수 엔드포인트용 의존성 — 없으면 401."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다")
    session = _find_valid_session(db, token)
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
    session = _find_valid_session(db, token)
    if not session:
        return None
    return db.query(models.User).filter(models.User.id == session.user_id).first()


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    """운영자 전용 엔드포인트용 의존성(개선 로드맵 §5.5, routers/moderation.py).
    판정 자체는 models.User.is_admin 프로퍼티(config.py의 admin_emails 기반)에
    맡긴다."""
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "운영자 권한이 필요합니다")
    return user
