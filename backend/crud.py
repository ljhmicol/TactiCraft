"""DB ↔ 분석 JSON 변환 (4단계 §2.3, §2.4).

저장은 전체 교체(replace) 방식이다. PUT 시 하위 players/phases/positions 를
지우고 다시 삽입한다. 편집 화면이 항상 분석 전체를 들고 있으므로
부분 갱신의 이득이 없다 (2단계 §5).
"""

import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

import models
import schemas


class AnalysisNotFound(Exception):
    pass


class CommentNotFound(Exception):
    pass


class ReportDuplicate(Exception):
    pass


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _analysis_load_options():
    return (
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


def _load(db: Session, analysis_id: int) -> models.Analysis:
    stmt = (
        select(models.Analysis)
        .where(models.Analysis.id == analysis_id)
        .options(*_analysis_load_options())
    )
    row = db.execute(stmt).scalar_one_or_none()
    if row is None:
        raise AnalysisNotFound(analysis_id)
    return row


def get_analysis_by_token(db: Session, token: str) -> models.Analysis:
    """공유 토큰(2026-09-18, 개선 로드맵 §5.2)으로 분석을 찾는다. id 기반
    _load와 조회 조건만 다르고 나머지(eager load 옵션)는 동일하다."""
    stmt = (
        select(models.Analysis)
        .where(models.Analysis.share_token == token)
        .options(*_analysis_load_options())
    )
    row = db.execute(stmt).scalar_one_or_none()
    if row is None:
        raise AnalysisNotFound(token)
    return row


def is_visible_to(row: models.Analysis, user_id: Optional[int]) -> bool:
    """소유자는 항상 볼 수 있고, 그 외엔 링크 공개·커뮤니티 공개만 허용한다
    (비공개는 소유자 전용) — 개선 로드맵 §5.2, 비공개 분석이 순차 id 스캔으로
    새던 문제의 수정. analyses/comments/community 라우터가 공통으로 쓴다."""
    if user_id is not None and row.user_id == user_id:
        return True
    return row.visibility in ("link", "community")


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
        # share_token은 링크 공개(visibility='link')의 유일한 접근 열쇠라 생성
        # 시점에 한 번만 발급하고 이후 바꾸지 않는다(개선 로드맵 §5.2) — id는
        # 순차 정수라 그 자체로 비밀이 될 수 없다.
        row = models.Analysis(created_at=now, user_id=user_id, share_token=secrets.token_urlsafe(16))
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
        "visibility": row.visibility,
    }


# ---------------------------------------------------------------------------
# 댓글 (TO-DO 12번)
# ---------------------------------------------------------------------------


def _annotate_reactions(
    db: Session, comments: List[models.Comment], current_user_id: Optional[int]
) -> List[dict]:
    """댓글 목록에 좋아요/싫어요 집계와 "내 반응"을 붙인다(TO-DO 54).
    list_public_analyses의 댓글 수 집계와 같은 이유로 N+1을 피하려 댓글
    id 목록으로 한 번에 GROUP BY 집계한 뒤 파이썬에서 합친다."""
    comment_ids = [c.id for c in comments]
    like_counts: dict[int, int] = {}
    dislike_counts: dict[int, int] = {}
    my_reactions: dict[int, str] = {}
    if comment_ids:
        count_rows = (
            db.query(
                models.CommentReaction.comment_id,
                models.CommentReaction.value,
                func.count(models.CommentReaction.id),
            )
            .filter(models.CommentReaction.comment_id.in_(comment_ids))
            .group_by(models.CommentReaction.comment_id, models.CommentReaction.value)
            .all()
        )
        for comment_id, value, count in count_rows:
            if value == 1:
                like_counts[comment_id] = count
            else:
                dislike_counts[comment_id] = count
        if current_user_id is not None:
            mine = (
                db.query(models.CommentReaction.comment_id, models.CommentReaction.value)
                .filter(
                    models.CommentReaction.comment_id.in_(comment_ids),
                    models.CommentReaction.user_id == current_user_id,
                )
                .all()
            )
            my_reactions = {cid: ("like" if v == 1 else "dislike") for cid, v in mine}

    result = []
    for c in comments:
        result.append(
            {
                "id": c.id,
                "analysis_id": c.analysis_id,
                "user_id": c.user_id,
                "parent_id": c.parent_id,
                "username": c.username,
                "body": c.body,
                "created_at": c.created_at,
                "like_count": like_counts.get(c.id, 0),
                "dislike_count": dislike_counts.get(c.id, 0),
                "my_reaction": my_reactions.get(c.id),
            }
        )
    return result


def list_comments(
    db: Session, analysis_id: int, current_user_id: Optional[int] = None
) -> List[dict]:
    """오래된 것부터 — 대화 스레드처럼 위에서 아래로 시간순으로 읽히게.
    최상위 댓글·대댓글 모두 평평하게 반환한다(parent_id로 구분) — 트리로
    묶는 건 프론트 책임(CommunityComments가 parent_id로 그룹핑)."""
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.analysis_id == analysis_id)
        .order_by(models.Comment.id.asc())
        .all()
    )
    return _annotate_reactions(db, comments, current_user_id)


def create_comment(
    db: Session,
    analysis_id: int,
    user: "models.User",
    body: str,
    parent_id: Optional[int] = None,
) -> models.Comment:
    """parent_id가 있으면 대댓글(TO-DO 54). 대댓글에 다시 답글을 달면(즉
    parent가 이미 parent_id를 가지고 있으면) 그 조상의 최상위 댓글로
    평탄화한다 — 무한 중첩 없이 1단계 깊이만 허용하는 설계다."""
    if parent_id is not None:
        parent = get_comment(db, parent_id)
        if parent is None or parent.analysis_id != analysis_id:
            raise CommentNotFound()
        if parent.parent_id is not None:
            parent_id = parent.parent_id

    comment = models.Comment(
        analysis_id=analysis_id,
        user_id=user.id,
        parent_id=parent_id,
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
    """이 댓글이 최상위 댓글이면 대댓글도 함께 지워진다 — 모델의
    `ondelete="CASCADE"`(DB 레벨, database.py의 PRAGMA foreign_keys=ON로
    활성화)가 처리한다."""
    db.query(models.Comment).filter(models.Comment.id == comment_id).delete()
    db.commit()


def toggle_comment_reaction(
    db: Session, comment_id: int, user: "models.User", value: str
) -> tuple[Optional[str], int, int]:
    """댓글 좋아요/싫어요 토글(TO-DO 54). analyses의 toggle_like와 같은
    토글 원칙이되, 좋아요·싫어요가 상호 배타적이라 행의 존재가 아니라
    `value`(1|-1) 컬럼으로 상태를 표현한다:
    - 반응이 없으면: 새로 만든다(누름)
    - 같은 값을 다시 누르면: 지운다(취소)
    - 반대 값을 누르면: value만 바꾼다(좋아요→싫어요 전환, 행 추가 없음)
    반환값은 (내 최종 반응 | None, like_count, dislike_count) — 프론트가
    재조회 없이 버튼·카운트를 즉시 갱신하도록 analyses의 LikeToggleOut과
    같은 방식.
    """
    numeric_value = 1 if value == "like" else -1
    existing = (
        db.query(models.CommentReaction)
        .filter(
            models.CommentReaction.comment_id == comment_id,
            models.CommentReaction.user_id == user.id,
        )
        .first()
    )
    if existing is None:
        db.add(
            models.CommentReaction(
                comment_id=comment_id, user_id=user.id, value=numeric_value, created_at=_now()
            )
        )
        db.commit()
        my_reaction: Optional[str] = value
    elif existing.value == numeric_value:
        db.delete(existing)
        db.commit()
        my_reaction = None
    else:
        existing.value = numeric_value
        db.commit()
        my_reaction = value

    like_count = (
        db.query(func.count(models.CommentReaction.id))
        .filter(models.CommentReaction.comment_id == comment_id, models.CommentReaction.value == 1)
        .scalar()
    )
    dislike_count = (
        db.query(func.count(models.CommentReaction.id))
        .filter(models.CommentReaction.comment_id == comment_id, models.CommentReaction.value == -1)
        .scalar()
    )
    return my_reaction, like_count, dislike_count


# ---------------------------------------------------------------------------
# 커뮤니티 공개(TO-DO 12번 후속)
# ---------------------------------------------------------------------------


def set_analysis_visibility(db: Session, analysis_id: int, visibility: str) -> models.Analysis:
    row = _load(db, analysis_id)
    row.visibility = visibility
    db.commit()
    db.refresh(row)
    return row


def list_public_analyses(
    db: Session, current_user_id: Optional[int] = None, sort: str = "recent"
) -> List[dict]:
    """공개(visibility='community') 분석을 최신순으로 — 작성자 표시명·댓글 수·좋아요
    수를 같이 계산해 카드에 바로 쓸 형태로 돌려준다. N+1을 피하려고 댓글
    수·좋아요 수는 분석 id 목록으로 한 번에 GROUP BY 집계한 뒤 파이썬에서
    합친다(분석 수가 이 앱 규모에서 수백~수천 단위를 넘지 않을 것으로 보여,
    별도 서브쿼리 조인보다 이 편이 읽기 쉽다).

    sort="popular"(TO-DO 41 후속)는 좋아요 수가 SQL 컬럼이 아니라 이렇게
    파이썬에서 집계한 값이라, DB의 order_by 대신 리스트를 만든 뒤 다시
    정렬한다 — 원래 최신순으로 가져온 목록이라 Python list.sort는 안정
    정렬이므로 좋아요 수가 같으면 최신순이 그대로 2차 정렬 기준이 된다.
    """
    rows = (
        db.query(models.Analysis, models.User.username)
        .join(models.User, models.Analysis.user_id == models.User.id)
        .filter(models.Analysis.visibility == "community")
        .order_by(models.Analysis.updated_at.desc())
        .all()
    )
    analysis_ids = [row.id for row, _ in rows]
    counts: dict[int, int] = {}
    like_counts: dict[int, int] = {}
    liked_ids: set[int] = set()
    if analysis_ids:
        count_rows = (
            db.query(models.Comment.analysis_id, func.count(models.Comment.id))
            .filter(models.Comment.analysis_id.in_(analysis_ids))
            .group_by(models.Comment.analysis_id)
            .all()
        )
        counts = dict(count_rows)

        like_count_rows = (
            db.query(models.Like.analysis_id, func.count(models.Like.id))
            .filter(models.Like.analysis_id.in_(analysis_ids))
            .group_by(models.Like.analysis_id)
            .all()
        )
        like_counts = dict(like_count_rows)

        if current_user_id is not None:
            liked_rows = (
                db.query(models.Like.analysis_id)
                .filter(
                    models.Like.analysis_id.in_(analysis_ids),
                    models.Like.user_id == current_user_id,
                )
                .all()
            )
            liked_ids = {row[0] for row in liked_rows}

    items = [
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
            "like_count": like_counts.get(row.id, 0),
            "liked_by_me": row.id in liked_ids,
        }
        for row, username in rows
    ]
    if sort == "popular":
        items.sort(key=lambda item: item["like_count"], reverse=True)
    return items


def toggle_like(db: Session, analysis_id: int, user: "models.User") -> tuple[bool, int]:
    """좋아요 토글(TO-DO 41 후속) — 이미 누른 상태면 행을 지우고(취소),
    아니면 새로 만든다(누름). 1인 1회는 Like 모델의 UniqueConstraint가
    보장한다. 반환값(liked, like_count)은 프론트가 버튼·카운트를 API 응답
    하나로 즉시 갱신할 수 있게 최신 총 개수까지 같이 준다."""
    existing = (
        db.query(models.Like)
        .filter(models.Like.analysis_id == analysis_id, models.Like.user_id == user.id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        liked = False
    else:
        db.add(models.Like(analysis_id=analysis_id, user_id=user.id, created_at=_now()))
        db.commit()
        liked = True
    count = (
        db.query(func.count(models.Like.id))
        .filter(models.Like.analysis_id == analysis_id)
        .scalar()
    )
    return liked, count


# ---------------------------------------------------------------------------
# 신고(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에 같이")
# ---------------------------------------------------------------------------


def create_report(
    db: Session, target_type: str, target_id: int, reporter_user_id: int, reason: Optional[str]
) -> models.Report:
    """같은 사람이 같은 대상을 두 번 신고하면 새 신고를 만들지 않고
    ReportDuplicate를 던진다 — models.Report의 UniqueConstraint와 짝이다."""
    existing = (
        db.query(models.Report)
        .filter(
            models.Report.target_type == target_type,
            models.Report.target_id == target_id,
            models.Report.reporter_user_id == reporter_user_id,
        )
        .first()
    )
    if existing:
        raise ReportDuplicate()
    report = models.Report(
        target_type=target_type,
        target_id=target_id,
        reporter_user_id=reporter_user_id,
        reason=reason,
        created_at=_now(),
        status="open",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def report_target_preview(db: Session, target_type: str, target_id: int) -> Optional[str]:
    """운영자 신고 목록에서 대상을 다시 열어보지 않고도 무엇에 대한 신고인지
    감을 잡을 수 있게 짧은 미리보기를 붙인다. 대상이 이미 지워졌으면
    None(신고 자체는 기록으로 남아 있어도 대상은 사라질 수 있다)."""
    if target_type == "analysis":
        row = db.query(models.Analysis).filter(models.Analysis.id == target_id).first()
        return row.match_name if row else None
    row = db.query(models.Comment).filter(models.Comment.id == target_id).first()
    return row.body[:80] if row else None


def _report_dict(db: Session, report: models.Report) -> dict:
    return {
        "id": report.id,
        "target_type": report.target_type,
        "target_id": report.target_id,
        "reporter_username": report.reporter.username or report.reporter.email.split("@")[0],
        "reason": report.reason,
        "created_at": report.created_at,
        "status": report.status,
        "target_preview": report_target_preview(db, report.target_type, report.target_id),
    }


def list_reports(db: Session, status: str = "open") -> List[dict]:
    rows = (
        db.query(models.Report)
        .filter(models.Report.status == status)
        .order_by(models.Report.created_at.desc())
        .all()
    )
    return [_report_dict(db, r) for r in rows]


def resolve_report(db: Session, report_id: int) -> Optional[dict]:
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        return None
    report.status = "resolved"
    db.commit()
    db.refresh(report)
    return _report_dict(db, report)


def get_report_dict(db: Session, report: models.Report) -> dict:
    return _report_dict(db, report)


def get_like_info(db: Session, analysis_id: int, user_id: Optional[int]) -> tuple[int, bool]:
    """분석 상세 조회(GET /api/analyses/{id})에 좋아요 수·내 좋아요 여부를
    얹는다(TO-DO 58) — 지금까지는 CommunityAnalysisOut(목록 카드)에만 있어서
    공유 링크 상세 화면(/share/:id)엔 좋아요를 누를 방법 자체가 없었다."""
    count = (
        db.query(func.count(models.Like.id))
        .filter(models.Like.analysis_id == analysis_id)
        .scalar()
    )
    liked = False
    if user_id is not None:
        liked = (
            db.query(models.Like)
            .filter(models.Like.analysis_id == analysis_id, models.Like.user_id == user_id)
            .first()
            is not None
        )
    return count, liked


# 회원 관리(2026-09-20, 관리자 요청). "정지"는 로그인 차단만 한다(사용자가
# 명시적으로 고른 범위) — 이미 올린 분석/댓글은 그대로 둔다. 문제 콘텐츠
# 자체를 숨기거나 지우는 건 이미 있는 신고 처리(routers/moderation.py)의
# 몫이라 여기서 새로 건드리지 않는다.
def list_users_with_counts(db: Session) -> List[dict]:
    rows = (
        db.query(models.User, func.count(models.Analysis.id))
        .outerjoin(models.Analysis, models.Analysis.user_id == models.User.id)
        .group_by(models.User.id)
        .order_by(models.User.created_at.desc())
        .all()
    )
    return [
        {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "created_at": user.created_at,
            "is_suspended": bool(user.is_suspended),
            "analysis_count": count,
        }
        for user, count in rows
    ]


class SelfSuspendError(Exception):
    """운영자 계정은 정지할 수 없다 — 자기 자신뿐 아니라 ADMIN_EMAILS에
    등록된 다른 운영자도 포함이다(advisor 리뷰로 발견: "본인만" 막으면
    운영자가 여럿일 때 서로를 정지해 잠글 수 있고, 자기 자신만 막아도
    테스트용으로 쓰던 다른 운영자 계정을 정지한 뒤 ADMIN_EMAILS에서 그
    이메일을 빼면 되돌릴 방법이 없어진다). 실수로 막아버리면
    ADMIN_EMAILS를 다시 설정하기 전까진 이 기능 자체에 접근할 방법이 없어진다."""


def set_user_suspended(db: Session, admin: models.User, user_id: int, suspended: bool) -> Optional[models.User]:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if suspended and user and user.is_admin:
        raise SelfSuspendError()
    if not user:
        return None
    user.is_suspended = suspended
    if suspended:
        # 이미 로그인된 세션이 있다면 즉시 끊는다 — 안 그러면 최대 30일(세션
        # 만료 기한)까지는 정지해도 계속 쓸 수 있다.
        db.query(models.Session).filter(models.Session.user_id == user_id).delete()
    db.commit()
    db.refresh(user)
    return user


def record_pageview(db: Session, path: str, visitor_id: str, user_id: Optional[int]) -> None:
    db.add(models.PageView(path=path, visitor_id=visitor_id, user_id=user_id, created_at=_now()))
    db.commit()


def get_analytics_summary(db: Session, days: int = 30) -> dict:
    """방문자 통계(2026-09-26, "사람들이 사이트 얼마나 사용하는지" 요청).

    IP·유저 에이전트를 아예 안 남기므로(models.PageView 참조) 집계는
    path/visitor_id/시각만으로 한다. SQLite 방언 날짜 함수 대신 파이썬에서
    날짜별로 묶는다 — 이 앱 규모(하루 수백 건 이하)에서는 DB 함수를 쓸
    이유가 없고, 날짜 포맷팅을 한 곳(파이썬)에서만 다루는 게 더 간단하다.
    """
    since = (datetime.now() - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    rows = (
        db.query(models.PageView.path, models.PageView.visitor_id, models.PageView.created_at)
        .filter(models.PageView.created_at >= since)
        .all()
    )
    today = datetime.now().strftime("%Y-%m-%d")

    by_day: dict[str, dict] = {}
    path_counts: dict[str, int] = {}
    for r in rows:
        day = r.created_at[:10]
        bucket = by_day.setdefault(day, {"views": 0, "visitors": set()})
        bucket["views"] += 1
        bucket["visitors"].add(r.visitor_id)
        path_counts[r.path] = path_counts.get(r.path, 0) + 1

    daily_views = [
        {"date": day, "views": v["views"], "unique_visitors": len(v["visitors"])}
        for day, v in sorted(by_day.items())
    ]
    top_paths = [
        {"path": p, "views": c}
        for p, c in sorted(path_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]

    # 로그인 상태의 조회는 PageView.user_id로 이미 남아 있다 — "누가
    # 조회했는지 알 수 없냐"는 후속 질문(2026-09-26)에 그 기록을 그대로
    # 보여준다. 비로그인 방문자는 IP·기기 정보를 아예 저장하지 않으므로
    # (위 문단 참조) 이 목록엔 애초에 나타나지 않는다 — 알아낼 방법이 없는
    # 게 아니라 처음부터 안 남기기로 한 설계다.
    recent_user_views = (
        db.query(models.PageView, models.User)
        .join(models.User, models.PageView.user_id == models.User.id)
        .order_by(models.PageView.created_at.desc())
        .limit(50)
        .all()
    )

    return {
        "total_views": len(rows),
        "unique_visitors": len({r.visitor_id for r in rows}),
        "today_views": by_day.get(today, {"views": 0})["views"],
        "daily_views": daily_views,
        "top_paths": top_paths,
        "recent_user_views": [
            {
                "username": user.username or user.email.split("@")[0],
                "path": pv.path,
                "created_at": pv.created_at,
            }
            for pv, user in recent_user_views
        ],
    }
