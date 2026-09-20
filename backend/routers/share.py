"""공유 토큰 기반 읽기 전용 엔드포인트(2026-09-18, 개선 로드맵 §5.2).

id 기반 GET /api/analyses/{id}는 소유자 또는 visibility='community'만 읽을 수
있다(analyses.py 참조). visibility='link'인 분석은 순차 정수 id로 접근할
방법이 없어야 "링크를 아는 사람만"이라는 말이 성립하므로, 이 라우터가 그
대신 추측 불가능한 share_token으로 같은 분석을 읽는 경로를 제공한다.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/share", tags=["share"])


@router.get("/{token}", response_model=schemas.AnalysisOut)
def get_shared_analysis(
    token: str,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(auth.get_current_user_optional),
):
    try:
        row = crud.get_analysis_by_token(db, token)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    is_owner = bool(user and row.user_id == user.id)
    if not is_owner and row.visibility not in ("link", "community"):
        # 토큰을 들고 있어도 소유자가 이후 비공개로 되돌렸다면 더 이상
        # 유효하지 않다 — private로 낮춘 뒤 예전 링크가 계속 새는 걸 막는다.
        raise HTTPException(status_code=404, detail="Analysis not found")
    like_count, liked_by_me = crud.get_like_info(db, row.id, user.id if user else None)
    return {
        **crud.to_analysis_dict(row),
        "is_owner": is_owner,
        "share_token": row.share_token if is_owner else None,
        "like_count": like_count,
        "liked_by_me": liked_by_me,
    }
