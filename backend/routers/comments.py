"""분석 전체에 붙는 댓글 CRUD (TO-DO 12번).

읽기는 analyses.get_analysis와 같은 이유로 로그인 여부와 무관하게 공개다 —
공유 링크(/share/:id)를 본 누구나 댓글을 읽을 수 있어야 "커뮤니티"가 된다.
작성은 로그인 필수(2026-09-10 사용자 결정 — "로그인한 사용자만, 사용자명도
입력하게"). 삭제는 작성자 본인 또는 분석 소유자만 가능하다(같은 결정).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter(tags=["comments"])


@router.get("/api/analyses/{analysis_id}/comments", response_model=list[schemas.CommentOut])
def list_comments(analysis_id: int, db: Session = Depends(get_db)):
    try:
        crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    return crud.list_comments(db, analysis_id)


@router.post(
    "/api/analyses/{analysis_id}/comments",
    response_model=schemas.CommentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    analysis_id: int,
    payload: schemas.CommentIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        crud.get_analysis(db, analysis_id)
    except crud.AnalysisNotFound:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Analysis not found")
    return crud.create_comment(db, analysis_id, user, payload.body)


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
    if not (is_author or is_owner):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인이 쓴 댓글이거나 분석 소유자만 지울 수 있습니다")
    crud.delete_comment(db, comment_id)
