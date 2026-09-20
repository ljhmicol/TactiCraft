"""커뮤니티 공개 목록(TO-DO 12번 후속, 2026-09-10) + 좋아요(TO-DO 41 후속).

"커뮤니티는 어디있어?"라는 사용자 질문에서 시작 — 저장 목록에 댓글 링크만
추가했던 1차 대응으로는 부족해서, 공유하기를 누른 분석만 모아 보여주는
전용 페이지를 만들었다. 읽기는 comments 라우터와 같은 이유로 로그인 여부와
무관하게 공개다(누구나 둘러볼 수 있어야 "커뮤니티"다) — 목록에 실리는 것
자체는 작성자가 이미 opt-in한 결과라 추가 접근 제어가 필요 없다.

좋아요는 댓글 작성과 같은 이유로 로그인이 필요하다 — 누가 눌렀는지
식별해야 1인 1회 제한과 "내가 눌렀는지" 표시가 가능하다.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db
from ratelimit import rate_limit

router = APIRouter(prefix="/api/community", tags=["community"])

# 좋아요 토글 30회/분(IP 기준) — 개선 로드맵 §5.5, comments.py의 반응
# 제한과 같은 값.
_like_rate_limit = rate_limit("like", limit=30, window_seconds=60)


@router.get("/analyses", response_model=list[schemas.CommunityAnalysisOut])
def list_public_analyses(
    sort: str = "recent",
    db: Session = Depends(get_db),
    user: models.User | None = Depends(auth.get_current_user_optional),
):
    return crud.list_public_analyses(db, current_user_id=user.id if user else None, sort=sort)


@router.post(
    "/analyses/{analysis_id}/like",
    response_model=schemas.LikeToggleOut,
    dependencies=[Depends(_like_rate_limit)],
)
def toggle_like(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        row = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    if not crud.is_visible_to(row, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    liked, like_count = crud.toggle_like(db, analysis_id, user)
    return {"liked": liked, "like_count": like_count}
