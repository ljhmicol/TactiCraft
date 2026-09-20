"""분석 전체에 붙는 댓글 CRUD (TO-DO 12번) + 대댓글·좋아요/싫어요(TO-DO 54).

읽기·쓰기는 crud.is_visible_to로 접근을 제한한다(2026-09-18, 개선 로드맵
§5.2) — 소유자, 링크 공개, 커뮤니티 공개 분석의 댓글은 볼 수 있지만
비공개 분석의 댓글은 analysis_id를 안다 해도 더 이상 읽을 수 없다. 그
전까지는 analysis_id만 맞으면(순차 정수라 스캔 가능) 비공개 분석의 댓글도
새고 있었다. 로그인한 사용자가 읽으면 각 댓글에 "내가 좋아요/싫어요를
눌렀는지"를 같이 얹어준다(get_current_user_optional). 작성은 로그인
필수(2026-09-10 사용자 결정 — "로그인한 사용자만, 사용자명도 입력하게").
삭제는 작성자 본인 또는 분석 소유자만 가능하다(같은 결정). 좋아요/싫어요도
로그인 필수다(analyses.toggle_like와 같은 이유 — 누가 눌렀는지 식별해야
1인 1표 제한과 "내 반응" 표시가 가능하다).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db
from ratelimit import rate_limit

router = APIRouter(tags=["comments"])

# 댓글 작성 20회/분, 반응(좋아요/싫어요) 30회/분(IP 기준) — 개선 로드맵 §5.5.
_comment_rate_limit = rate_limit("comment", limit=20, window_seconds=60)
_reaction_rate_limit = rate_limit("comment_reaction", limit=30, window_seconds=60)


@router.get("/api/analyses/{analysis_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(
    analysis_id: int,
    db: Session = Depends(get_db),
    user: models.User | None = Depends(auth.get_current_user_optional),
):
    try:
        row = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    if not crud.is_visible_to(row, user.id if user else None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    return crud.list_comments(db, analysis_id, current_user_id=user.id if user else None)


@router.post(
    "/api/analyses/{analysis_id}/comments",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_comment_rate_limit)],
)
def create_comment(
    analysis_id: int,
    payload: schemas.CommentIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        row = crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    if not crud.is_visible_to(row, user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    try:
        comment = crud.create_comment(db, analysis_id, user, payload.body, payload.parent_id)
    except crud.CommentNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "답글을 달려는 댓글을 찾을 수 없습니다")
    # 방금 만든 댓글은 반응이 있을 수 없으니 집계 없이 0/None을 그대로 채운다.
    return {
        "id": comment.id,
        "analysis_id": comment.analysis_id,
        "user_id": comment.user_id,
        "parent_id": comment.parent_id,
        "username": comment.username,
        "body": comment.body,
        "created_at": comment.created_at,
        "like_count": 0,
        "dislike_count": 0,
        "my_reaction": None,
    }


@router.delete("/api/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    comment = crud.get_comment(db, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    is_author = comment.user_id == user.id
    is_owner = comment.analysis is not None and comment.analysis.user_id == user.id
    # 운영자는 작성자·분석 소유자가 아니어도 지울 수 있다(개선 로드맵 §5.5,
    # 신고된 댓글을 지우는 "차단" 조치 — routers/moderation.py 참조).
    if not (is_author or is_owner or user.is_admin):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인이 쓴 댓글이거나 분석 소유자, 운영자만 지울 수 있습니다")
    crud.delete_comment(db, comment_id)


@router.post(
    "/api/comments/{comment_id}/reaction",
    response_model=schemas.CommentReactionOut,
    dependencies=[Depends(_reaction_rate_limit)],
)
def toggle_comment_reaction(
    comment_id: int,
    payload: schemas.CommentReactionIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    comment = crud.get_comment(db, comment_id)
    if not comment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    my_reaction, like_count, dislike_count = crud.toggle_comment_reaction(
        db, comment_id, user, payload.value
    )
    return {"my_reaction": my_reaction, "like_count": like_count, "dislike_count": dislike_count}
