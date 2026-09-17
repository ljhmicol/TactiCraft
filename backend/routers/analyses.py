"""분석 CRUD 엔드포인트 (3단계 §2).

읽기(get_analysis)는 로그인 여부와 무관하게 항상 공개다 — 공유 링크(TO-DO 8번,
/share/:id)가 이 엔드포인트로 남의 분석을 읽는다. 로그인(TO-DO 11번) 이후에도
그 설계를 그대로 유지한다. 목록·생성·수정·삭제만 로그인을 요구하고, 수정·삭제는
소유자 본인인지도 확인한다.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/analyses", tags=["analyses"])


@router.get("", response_model=list[schemas.AnalysisSummary])
def list_analyses(
    db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)
):
    return crud.list_analyses(db, user.id)


@router.get("/{analysis_id}", response_model=schemas.AnalysisOut)
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(auth.get_current_user_optional),
):
    try:
        row = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    like_count, liked_by_me = crud.get_like_info(db, analysis_id, user.id if user else None)
    return {
        **crud.to_analysis_dict(row),
        "is_owner": bool(user and row.user_id == user.id),
        "like_count": like_count,
        "liked_by_me": liked_by_me,
    }


@router.post("", response_model=schemas.AnalysisOut, status_code=status.HTTP_201_CREATED)
def create_analysis(
    payload: schemas.AnalysisIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    row = crud.upsert_analysis(db, payload, user_id=user.id)
    return crud.to_analysis_dict(row)


@router.put("/{analysis_id}", response_model=schemas.AnalysisOut)
def update_analysis(
    analysis_id: int,
    payload: schemas.AnalysisIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        existing = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 분석만 수정할 수 있습니다")
    row = crud.upsert_analysis(db, payload, analysis_id, user_id=user.id)
    return crud.to_analysis_dict(row)


@router.patch("/{analysis_id}/public", response_model=schemas.AnalysisSummary)
def set_analysis_public(
    analysis_id: int,
    payload: schemas.AnalysisPublicIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    """커뮤니티 공개 토글(TO-DO 12번 후속). 전체 AnalysisIn PUT과 별개의
    전용 엔드포인트인 이유는 schemas.AnalysisPublicIn의 docstring 참조 —
    에디터의 다른 미저장 변경과 뒤섞이지 않게 이 필드 하나만 바꾼다.
    """
    try:
        existing = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 분석만 공개 설정을 바꿀 수 있습니다")
    row = crud.set_analysis_public(db, analysis_id, payload.is_public)
    return row


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        existing = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 분석만 삭제할 수 있습니다")
    crud.delete_analysis(db, analysis_id)
