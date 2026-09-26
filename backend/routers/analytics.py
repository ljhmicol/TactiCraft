"""방문자 분석(2026-09-26, "사람들이 사이트 얼마나 사용하는지 알 수 있는 방법
있어?" 요청 — Umami/Plausible 같은 외부 서비스 대신 이 앱의 기존 SQLite에
그대로 쌓는 쪽을 사용자가 직접 선택했다).

IP·유저 에이전트는 서버가 아예 저장하지 않는다 — path와 익명 방문자 쿠키
값, 로그인 상태면 user_id, 시각만 남긴다(models.PageView 참조).
"""

import secrets

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session as DbSession

import auth
import crud
import models
import schemas
from config import settings
from database import get_db
from ratelimit import rate_limit

router = APIRouter(tags=["analytics"])

# 로그인 세션 쿠키(30일)와 별개의 장기 쿠키다 — 로그인 여부와 무관하게
# "같은 브라우저가 몇 번 방문했는지"를 오래 구분하려는 목적이라 1년으로 잡는다.
VISITOR_COOKIE_NAME = "tacticore_visitor"
VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

# 60회/분(IP 기준) — SPA라 라우트를 옮길 때마다 호출되므로 댓글/좋아요보다
# 훨씬 여유 있게 잡았다(개선 로드맵 §5.5 rate_limit 패턴과 동일).
_pageview_rate_limit = rate_limit("pageview", limit=60, window_seconds=60)


@router.post(
    "/api/analytics/pageview",
    status_code=204,
    dependencies=[Depends(_pageview_rate_limit)],
)
def record_pageview(
    payload: schemas.PageViewIn,
    request: Request,
    response: Response,
    db: DbSession = Depends(get_db),
    user: models.User | None = Depends(auth.get_current_user_optional),
):
    visitor_id = request.cookies.get(VISITOR_COOKIE_NAME)
    if not visitor_id:
        visitor_id = secrets.token_urlsafe(16)
        response.set_cookie(
            VISITOR_COOKIE_NAME,
            visitor_id,
            max_age=VISITOR_COOKIE_MAX_AGE_SECONDS,
            httponly=True,
            samesite="lax",
            secure=settings.cookie_secure,
        )
    crud.record_pageview(db, payload.path, visitor_id, user.id if user else None)


@router.get("/api/admin/analytics", response_model=schemas.AnalyticsSummaryOut)
def get_analytics(
    db: DbSession = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    return crud.get_analytics_summary(db)
