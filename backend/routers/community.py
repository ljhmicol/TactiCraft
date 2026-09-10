"""커뮤니티 공개 목록(TO-DO 12번 후속, 2026-09-10).

"커뮤니티는 어디있어?"라는 사용자 질문에서 시작 — 저장 목록에 댓글 링크만
추가했던 1차 대응으로는 부족해서, 공유하기를 누른 분석만 모아 보여주는
전용 페이지를 만들었다. 읽기는 comments 라우터와 같은 이유로 로그인 여부와
무관하게 공개다(누구나 둘러볼 수 있어야 "커뮤니티"다) — 목록에 실리는 것
자체는 작성자가 이미 opt-in한 결과라 추가 접근 제어가 필요 없다.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter(prefix="/api/community", tags=["community"])


@router.get("/analyses", response_model=list[schemas.CommunityAnalysisOut])
def list_public_analyses(db: Session = Depends(get_db)):
    return crud.list_public_analyses(db)
