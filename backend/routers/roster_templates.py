"""내 팀·선수단 템플릿 CRUD(개선 로드맵 §7.2). 전부 로그인이 필요하고,
조회·수정·삭제는 본인 소유인지도 확인한다 — routers/analyses.py와 같은 패턴.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import crud
import models
import schemas
from database import get_db

router = APIRouter(prefix="/api/roster-templates", tags=["roster-templates"])


def _to_out(row: models.RosterTemplate) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "players": row.players,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


@router.get("", response_model=list[schemas.RosterTemplateSummary])
def list_roster_templates(
    db: Session = Depends(get_db), user: models.User = Depends(auth.get_current_user)
):
    rows = crud.list_roster_templates(db, user.id)
    return [
        {"id": r.id, "name": r.name, "player_count": len(r.players), "updated_at": r.updated_at}
        for r in rows
    ]


@router.get("/{template_id}", response_model=schemas.RosterTemplateOut)
def get_roster_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        row = crud.get_roster_template(db, template_id)
    except crud.RosterTemplateNotFound:
        raise HTTPException(status_code=404, detail="Roster template not found")
    if row.user_id != user.id:
        raise HTTPException(status_code=404, detail="Roster template not found")
    return _to_out(row)


@router.post("", response_model=schemas.RosterTemplateOut, status_code=status.HTTP_201_CREATED)
def create_roster_template(
    payload: schemas.RosterTemplateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    row = crud.create_roster_template(db, payload, user_id=user.id)
    return _to_out(row)


@router.put("/{template_id}", response_model=schemas.RosterTemplateOut)
def update_roster_template(
    template_id: int,
    payload: schemas.RosterTemplateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        existing = crud.get_roster_template(db, template_id)
    except crud.RosterTemplateNotFound:
        raise HTTPException(status_code=404, detail="Roster template not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 선수단만 수정할 수 있습니다")
    row = crud.update_roster_template(db, template_id, payload)
    return _to_out(row)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roster_template(
    template_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(auth.get_current_user),
):
    try:
        existing = crud.get_roster_template(db, template_id)
    except crud.RosterTemplateNotFound:
        raise HTTPException(status_code=404, detail="Roster template not found")
    if existing.user_id != user.id:
        raise HTTPException(status_code=403, detail="본인이 저장한 선수단만 삭제할 수 있습니다")
    crud.delete_roster_template(db, template_id)
