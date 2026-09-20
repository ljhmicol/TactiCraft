"""회원 목록 + 계정 정지(2026-09-20, 관리자 요청 "회원들이 회원가입을
하면 내가 관리를 해야할 것 같은데").

"정지"는 로그인 차단만 한다(관리자가 명시적으로 고른 최소 범위) — 이미
올린 분석·댓글은 그대로 남는다. 문제 콘텐츠 자체를 숨기거나 지우는 건
이미 있는 신고 처리(routers/moderation.py)의 몫이다. 두 기능을 같은
라우터에 섞지 않은 이유는 moderation.py의 독스트링과 같다 — "신고 접수·
목록·해결만 담당한다"는 경계를 그대로 지킨다.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/admin/users", tags=["admin"])


@router.get("", response_model=list[schemas.AdminUserOut])
def list_users(
    db: Session = Depends(get_db),
    _admin: models.User = Depends(auth.require_admin),
):
    return crud.list_users_with_counts(db)


@router.post("/{user_id}/suspend", response_model=schemas.AdminUserOut)
def suspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    try:
        user = crud.set_user_suspended(db, admin, user_id, True)
    except crud.SelfSuspendError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "자기 자신은 정지할 수 없습니다")
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/{user_id}/unsuspend", response_model=schemas.AdminUserOut)
def unsuspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(auth.require_admin),
):
    user = crud.set_user_suspended(db, admin, user_id, False)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user
