"""신고 제출 + 운영자 처리(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에
같이" 사용자 선택).

"차단"은 별도의 사용자 차단(뮤트) 기능이 아니라, 운영자가 신고된 콘텐츠를
직접 숨기거나(분석 → visibility='private', PATCH /api/analyses/{id}/visibility)
지우는(댓글 → DELETE /api/comments/{id}) 조치를 가리킨다 — 이미 있는 두
엔드포인트에 "운영자면 소유자가 아니어도 허용" 예외만 추가했다(routers/
analyses.py, routers/comments.py 참조). 새 엔드포인트를 또 만들지 않은 이유는
그러면 같은 동작(공개 범위 변경/댓글 삭제)이 두 경로로 존재하게 돼 혼란만
커지기 때문이다. 이 라우터는 신고 접수·목록·해결만 담당한다.

사용자 간 "이 사람 글은 안 보고 싶다" 식의 개인 차단(뮤트)은 로드맵 P2
"커뮤니티 운영과 탐색"의 몫으로 남겨둔다 — 이번 요청의 "차단"은 운영자
조치를 가리킨다는 해석 하에 진행했다(사용자가 다르게 의도했다면 별도로
알려달라고 TO-DO-LIST.md에 남긴다).
"""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db
from ratelimit import rate_limit

router = APIRouter(tags=["moderation"])

# 신고 10회/시간(IP 기준) — 댓글/좋아요보다 훨씬 드문 행동이라 낮게 잡았다.
_report_rate_limit = rate_limit("report", limit=10, window_seconds=3600)


@router.post(
    "/api/analyses/{analysis_id}/report",
    response_model=schemas.ReportOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_report_rate_limit)],
)
def report_analysis(
    analysis_id: int,
    payload: schemas.ReportIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        row = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    # 비공개 분석은 소유자 외엔 애초에 존재를 알 수 없어야 한다 — 신고도
    # 예외가 아니다(다른 라우터의 is_visible_to 사용과 같은 원칙).
    if not crud.is_visible_to(row, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    try:
        report = crud.create_report(db, "analysis", analysis_id, user.id, payload.reason)
    except crud.ReportDuplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 신고한 게시물입니다")
    return crud.get_report_dict(db, report)


@router.post(
    "/api/comments/{comment_id}/report",
    response_model=schemas.ReportOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_report_rate_limit)],
)
def report_comment(
    comment_id: int,
    payload: schemas.ReportIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    comment = crud.get_comment(db, comment_id)
    if not comment or comment.analysis is None or not crud.is_visible_to(comment.analysis, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    try:
        report = crud.create_report(db, "comment", comment_id, user.id, payload.reason)
    except crud.ReportDuplicate:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 신고한 댓글입니다")
    return crud.get_report_dict(db, report)


@router.get("/api/moderation/reports", response_model=list[schemas.ReportOut])
def list_reports(
    status_filter: Literal["open", "resolved"] = "open",
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    return crud.list_reports(db, status=status_filter)


@router.post("/api/moderation/reports/{report_id}/resolve", response_model=schemas.ReportOut)
def resolve_report(
    report_id: int,
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    report = crud.resolve_report(db, report_id)
    if not report:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found")
    return report
