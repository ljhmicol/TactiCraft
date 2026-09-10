"""DB ↔ 분석 JSON 변환 (4단계 §2.3, §2.4).

저장은 전체 교체(replace) 방식이다. PUT 시 하위 players/phases/positions 를
지우고 다시 삽입한다. 편집 화면이 항상 분석 전체를 들고 있으므로
부분 갱신의 이득이 없다 (2단계 §5).
"""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

import models
import schemas


class AnalysisNotFound(Exception):
    pass


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _load(db: Session, analysis_id: int) -> models.Analysis:
    stmt = (
        select(models.Analysis)
        .where(models.Analysis.id == analysis_id)
        .options(
            selectinload(models.Analysis.players),
            selectinload(models.Analysis.phases).selectinload(models.Phase.positions),
            selectinload(models.Analysis.phases).selectinload(models.Phase.annotations),
            selectinload(models.Analysis.changing_points)
            .selectinload(models.ChangingPoint.phase)
            .selectinload(models.Phase.positions),
            selectinload(models.Analysis.changing_points)
            .selectinload(models.ChangingPoint.phase)
            .selectinload(models.Phase.annotations),
        )
    )
    row = db.execute(stmt).scalar_one_or_none()
    if row is None:
        raise AnalysisNotFound(analysis_id)
    return row


def list_analyses(db: Session, user_id: int) -> List[models.Analysis]:
    """목록 조회. 좌표를 읽지 않는다 — 하위 테이블을 조인하지 않는 이유.

    로그인(TO-DO 11번) 이후에는 본인 소유 분석만 보인다 — user_id로 필터한다.
    """
    stmt = (
        select(models.Analysis)
        .where(models.Analysis.user_id == user_id)
        .order_by(models.Analysis.updated_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def get_analysis(db: Session, analysis_id: int) -> models.Analysis:
    return _load(db, analysis_id)


def delete_analysis(db: Session, analysis_id: int) -> None:
    row = _load(db, analysis_id)
    db.delete(row)
    db.commit()


def _build_phase(
    phase_type: str,
    phase_in: schemas.PhaseIn,
    player_map: dict[str, models.Player],
) -> models.Phase:
    """PhaseIn(및 이를 상속하는 ChangingPointIn)을 Phase(+positions/annotations)로
    변환한다 — 3국면과 타임라인 체인징 포인트가 같은 테이블을 공유한다."""
    phase = models.Phase(
        phase_type=phase_type,
        pressing_line_y=phase_in.pressing_line_y,
        comment=phase_in.comment,
    )
    for pos in phase_in.positions:
        phase.positions.append(
            models.Position(
                player=player_map[pos.player_id],
                side="own",
                slot=0,
                x=pos.x,
                y=pos.y,
            )
        )
    for slot, pos in enumerate(phase_in.opponent_positions or []):
        phase.positions.append(
            models.Position(player=None, side="opponent", slot=slot, x=pos.x, y=pos.y)
        )
    for ann in phase_in.annotations:
        phase.annotations.append(
            models.Annotation(
                client_id=ann.id,
                ann_type=ann.type,
                from_x=ann.from_.x,
                from_y=ann.from_.y,
                to_x=ann.to.x,
                to_y=ann.to.y,
                curved=ann.curved,
                carry=ann.carry,
            )
        )
    return phase


def upsert_analysis(
    db: Session,
    payload: schemas.AnalysisIn,
    analysis_id: Optional[int] = None,
    user_id: Optional[int] = None,
) -> models.Analysis:
    now = _now()

    if analysis_id is None:
        row = models.Analysis(created_at=now, user_id=user_id)
        db.add(row)
    else:
        row = _load(db, analysis_id)
        # 전체 교체: 하위를 비우면 delete-orphan 이 처리한다. changing_points가
        # phases의 행을 참조하므로(phase_id FK) phases보다 먼저 비운다.
        row.changing_points.clear()
        row.players.clear()
        row.phases.clear()
        db.flush()

    row.match_name = payload.match.match_name
    row.home_team = payload.match.home_team
    row.away_team = payload.match.away_team
    row.match_date = payload.match.match_date
    row.competition = payload.match.competition
    row.analyzed_team = payload.match.analyzed_team
    row.formation = payload.formation
    row.summary = payload.summary
    row.tags = payload.tags
    row.thumbnail = payload.thumbnail
    row.schema_version = payload.schema_version
    row.updated_at = now

    # client_id -> Player 매핑을 만들어 두고 좌표에서 참조한다.
    # 원본 id를 새로 발급하면 재로드 후 모핑이 엉킨다 (4단계 §5.1).
    player_map: dict[str, models.Player] = {}
    for p in payload.players:
        player = models.Player(
            client_id=p.id,
            name=p.name,
            number=p.number,
            role=p.role,
            tactical_role=p.tactical_role,
        )
        row.players.append(player)
        player_map[p.id] = player

    db.flush()  # player PK 확보

    for phase_type in schemas.PHASE_TYPES:
        row.phases.append(_build_phase(phase_type, payload.phases[phase_type], player_map))

    # 타임라인(TO-DO 5번) — 각 체인징 포인트는 자기 전용 Phase 행(phase_type=
    # "cp:<client_id>")을 갖고, ChangingPoint 행이 라벨·시간·순서만 얹는다.
    for i, cp_in in enumerate(payload.changing_points):
        cp_phase = _build_phase(f"cp:{cp_in.id}", cp_in, player_map)
        row.phases.append(cp_phase)
        db.flush()  # cp_phase PK 확보
        row.changing_points.append(
            models.ChangingPoint(
                client_id=cp_in.id,
                label=cp_in.label,
                minute=cp_in.minute,
                order_index=i,
                phase=cp_phase,
            )
        )

    db.commit()
    return _load(db, row.id)


def _phase_dict(phase: models.Phase, client_id_by_pk: dict[int, str]) -> dict:
    own = [p for p in phase.positions if p.side == "own"]
    opponent = sorted(
        (p for p in phase.positions if p.side == "opponent"),
        key=lambda p: p.slot,
    )
    return {
        "positions": [
            {"player_id": client_id_by_pk[p.player_id], "x": p.x, "y": p.y} for p in own
        ],
        "opponent_positions": (
            [{"x": p.x, "y": p.y} for p in opponent] if opponent else None
        ),
        "pressing_line_y": phase.pressing_line_y,
        "comment": phase.comment or "",
        "annotations": [
            {
                "id": a.client_id,
                "type": a.ann_type,
                "from": {"x": a.from_x, "y": a.from_y},
                "to": {"x": a.to_x, "y": a.to_y},
                "curved": a.curved,
                "carry": a.carry,
            }
            for a in phase.annotations
        ],
    }


def to_analysis_dict(row: models.Analysis) -> dict:
    """ORM 행을 3단계 §2.3의 응답 형태로 조립한다.

    ORM을 그대로 직렬화하면 구조가 다르므로 명시적으로 만든다.
    """
    client_id_by_pk = {p.id: p.client_id for p in row.players}

    phases: dict[str, dict] = {
        phase.phase_type: _phase_dict(phase, client_id_by_pk)
        for phase in row.phases
        if not phase.phase_type.startswith("cp:")
    }

    changing_points = [
        {
            "id": cp.client_id,
            "label": cp.label,
            "minute": cp.minute,
            **_phase_dict(cp.phase, client_id_by_pk),
        }
        for cp in row.changing_points
    ]

    return {
        "id": row.id,
        "schema_version": row.schema_version,
        "match": {
            "match_name": row.match_name,
            "home_team": row.home_team,
            "away_team": row.away_team,
            "match_date": row.match_date,
            "competition": row.competition,
            "analyzed_team": row.analyzed_team,
        },
        "formation": row.formation,
        "players": [
            {
                "id": p.client_id,
                "name": p.name,
                "number": p.number,
                "role": p.role,
                "tactical_role": p.tactical_role,
            }
            for p in row.players
        ],
        "phases": phases,
        "changing_points": changing_points,
        "summary": row.summary or "",
        "tags": row.tags or [],
        "thumbnail": row.thumbnail,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "is_public": bool(row.is_public),
    }


# ---------------------------------------------------------------------------
# 댓글 (TO-DO 12번)
# ---------------------------------------------------------------------------


def list_comments(db: Session, analysis_id: int) -> List[models.Comment]:
    """오래된 것부터 — 대화 스레드처럼 위에서 아래로 시간순으로 읽히게."""
    return (
        db.query(models.Comment)
        .filter(models.Comment.analysis_id == analysis_id)
        .order_by(models.Comment.id.asc())
        .all()
    )


def create_comment(db: Session, analysis_id: int, user: "models.User", body: str) -> models.Comment:
    comment = models.Comment(
        analysis_id=analysis_id,
        user_id=user.id,
        username=user.username or user.email.split("@")[0],
        body=body,
        created_at=_now(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def get_comment(db: Session, comment_id: int) -> Optional[models.Comment]:
    return db.query(models.Comment).filter(models.Comment.id == comment_id).first()


def delete_comment(db: Session, comment_id: int) -> None:
    db.query(models.Comment).filter(models.Comment.id == comment_id).delete()
    db.commit()


# ---------------------------------------------------------------------------
# 커뮤니티 공개(TO-DO 12번 후속)
# ---------------------------------------------------------------------------


def set_analysis_public(db: Session, analysis_id: int, is_public: bool) -> models.Analysis:
    row = _load(db, analysis_id)
    row.is_public = is_public
    db.commit()
    db.refresh(row)
    return row


def list_public_analyses(db: Session) -> List[dict]:
    """공개(is_public=True) 분석을 최신순으로 — 작성자 표시명·댓글 수를
    같이 계산해 카드에 바로 쓸 형태로 돌려준다. N+1을 피하려고 댓글 수는
    분석 id 목록으로 한 번에 GROUP BY 집계한 뒤 파이썬에서 합친다(분석 수가
    이 앱 규모에서 수백~수천 단위를 넘지 않을 것으로 보여, 별도 서브쿼리
    조인보다 이 편이 읽기 쉽다).
    """
    rows = (
        db.query(models.Analysis, models.User.username)
        .join(models.User, models.Analysis.user_id == models.User.id)
        .filter(models.Analysis.is_public.is_(True))
        .order_by(models.Analysis.updated_at.desc())
        .all()
    )
    analysis_ids = [row.id for row, _ in rows]
    counts: dict[int, int] = {}
    if analysis_ids:
        count_rows = (
            db.query(models.Comment.analysis_id, func.count(models.Comment.id))
            .filter(models.Comment.analysis_id.in_(analysis_ids))
            .group_by(models.Comment.analysis_id)
            .all()
        )
        counts = dict(count_rows)

    return [
        {
            "id": row.id,
            "match_name": row.match_name,
            "home_team": row.home_team,
            "away_team": row.away_team,
            "match_date": row.match_date,
            "competition": row.competition,
            "updated_at": row.updated_at,
            "tags": row.tags or [],
            "thumbnail": row.thumbnail,
            "owner_username": username or "",
            "comment_count": counts.get(row.id, 0),
        }
        for row, username in rows
    ]
