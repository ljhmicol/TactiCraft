"""분석 CRUD 엔드포인트 (3단계 §2).

get_analysis(id 기반)는 2026-09-18(개선 로드맵 §5.2)부터 더 이상 무조건
공개가 아니다 — 소유자 또는 visibility='community'인 분석만 id로 읽을 수
있다. visibility='link'인 분석은 id로는 404이고 반드시 공유 토큰
(GET /api/share/{token}, routers/share.py)으로만 읽힌다 — id는 순차 정수라
그 자체로 비밀이 될 수 없어서다. 이 변경 전에는 로그인 여부와 무관하게
누구나 id만 알면 비공개 분석도 읽을 수 있었다(실제 취약점, 로드맵 문서
5.2절에서 지적됨). 목록·생성·수정·삭제는 로그인을 요구하고, 수정·삭제는
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
    is_owner = bool(user and row.user_id == user.id)
    if not is_owner and row.visibility != "community":
        # link/private는 id로 접근 불가 — link는 반드시 /api/share/{token}으로
        # 접근해야 한다(존재 여부를 노출하지 않도록 403이 아니라 404).
        raise HTTPException(status_code=404, detail="Analysis not found")
    like_count, liked_by_me = crud.get_like_info(db, analysis_id, user.id if user else None)
    return {
        **crud.to_analysis_dict(row),
        "is_owner": is_owner,
        "share_token": row.share_token if is_owner else None,
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
    # 생성·수정 요청은 항상 로그인한 본인 소유로 만들어지므로(auth.get_current_user
    # + upsert_analysis의 user_id=user.id) is_owner는 항상 True다. 이걸 빼먹으면
    # 방금 만든 분석을 곧바로 "링크 공개"로 바꿨을 때 share_token이 응답에 없어서
    # 프론트가 `/s/undefined` 링크를 만드는 문제가 생긴다(2026-09-18 발견).
    return {**crud.to_analysis_dict(row), "is_owner": True, "share_token": row.share_token}


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
    return {**crud.to_analysis_dict(row), "is_owner": True, "share_token": row.share_token}


@router.patch("/{analysis_id}/visibility", response_model=schemas.AnalysisSummary)
def set_analysis_visibility(
    analysis_id: int,
    payload: schemas.AnalysisVisibilityIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    """공개 범위 변경(개선 로드맵 §5.2). 전체 AnalysisIn PUT과 별개의 전용
    엔드포인트인 이유는 schemas.AnalysisVisibilityIn의 docstring 참조 —
    에디터의 다른 미저장 변경과 뒤섞이지 않게 이 필드 하나만 바꾼다.
    """
    try:
        existing = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    # 운영자는 소유자가 아니어도 바꿀 수 있다(개선 로드맵 §5.5, 신고된 분석을
    # 비공개로 내리는 "차단" 조치 — routers/moderation.py 참조).
    if existing.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="본인이 저장한 분석이거나 운영자만 공개 설정을 바꿀 수 있습니다")
    row = crud.set_analysis_visibility(db, analysis_id, payload.visibility)
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


@router.patch("/{analysis_id}/remix-settings", response_model=schemas.AnalysisSummary)
def set_analysis_remix_settings(
    analysis_id: int,
    payload: schemas.AnalysisRemixSettingsIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    """리믹스 허용 여부 변경(개선 로드맵 §7.3) — set_analysis_visibility와
    같은 이유로 이 필드 하나만 바꾸는 전용 엔드포인트를 쓴다."""
    try:
        existing = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 분석만 설정을 바꿀 수 있습니다")
    return crud.set_analysis_remix_settings(db, analysis_id, payload.allow_remix)


@router.post("/{analysis_id}/remix", response_model=schemas.AnalysisOut, status_code=status.HTTP_201_CREATED)
def remix_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    """커뮤니티 리믹스(개선 로드맵 §7.3) — 지금 보고 있는 공개 전술을 내
    분석으로 복제한다. 읽을 수 있는 분석만 리믹스할 수 있다(is_visible_to —
    get_analysis와 같은 규칙), 원작자가 리믹스를 꺼뒀으면(allow_remix=False)
    막는다. 자기 자신의 분석은 복제 저장(DuplicateButton)이 이미 있으므로
    리믹스 대상에서 제외한다 — "출처 표시"가 의미 없는 자기 복제를 리믹스
    이력에 남기지 않기 위해서다.
    """
    try:
        source = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if source.user_id == user.id:
        raise HTTPException(status_code=400, detail="자신의 분석은 리믹스할 수 없습니다. 복제 저장을 사용하세요.")
    if not crud.is_visible_to(source, user.id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    if not source.allow_remix:
        raise HTTPException(status_code=403, detail="원작자가 리믹스를 허용하지 않았습니다")
    row = crud.remix_analysis(db, source, requester_id=user.id)
    return {**crud.to_analysis_dict(row), "is_owner": True, "share_token": row.share_token}
