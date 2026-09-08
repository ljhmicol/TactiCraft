"""Pydantic 스키마 (3단계 §1, §2.7).

서버 경계는 snake_case 다. 프론트의 camelCase 변환은 lib/api.ts 가 담당한다
(2단계 §5).
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PhaseType = Literal["base", "attack", "defense"]
TeamSide = Literal["home", "away"]

PHASE_TYPES: tuple[str, ...] = ("base", "attack", "defense")
SQUAD_SIZE = 11  # positions/opponent_positions는 항상 이 숫자(선발) — TO-DO 14
MAX_SQUAD_SIZE = 23  # players는 선발 11 + 벤치 최대 12


class Point(BaseModel):
    x: float = Field(ge=0, le=100)
    y: float = Field(ge=0, le=100)


class PlayerPosition(Point):
    player_id: str


class AnnotationIn(BaseModel):
    """국면별 화살표 (전술 그리기). `from`은 파이썬 예약어라 alias로 받는다."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(min_length=1)
    type: Literal["run", "pass"]
    from_: Point = Field(alias="from")
    to: Point
    curved: Optional[bool] = None


class MatchInfo(BaseModel):
    match_name: str = Field(min_length=1)
    home_team: str = Field(min_length=1)
    away_team: str = Field(min_length=1)
    match_date: str
    competition: Optional[str] = None
    analyzed_team: TeamSide

    @field_validator("match_date")
    @classmethod
    def _check_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("match_date는 YYYY-MM-DD 형식이어야 합니다")
        return v


class PlayerIn(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    number: int = Field(ge=1, le=99)
    role: Optional[str] = None
    tactical_role: Optional[str] = None


class PhaseIn(BaseModel):
    positions: List[PlayerPosition]
    # 없으면 오버로드 레이어가 비활성화된다. 있으면 11명 전원이어야 한다.
    opponent_positions: Optional[List[Point]] = None
    pressing_line_y: Optional[float] = Field(default=None, ge=0, le=100)
    comment: str = ""
    # 구버전 클라이언트 요청에는 없는 키다 — 기본 빈 목록으로 호환된다.
    annotations: List[AnnotationIn] = []

    @field_validator("positions")
    @classmethod
    def _check_own_count(cls, v: List[PlayerPosition]) -> List[PlayerPosition]:
        if len(v) != SQUAD_SIZE:
            raise ValueError(f"positions는 {SQUAD_SIZE}개여야 합니다 (현재 {len(v)}개)")
        return v

    @field_validator("opponent_positions")
    @classmethod
    def _check_opponent_count(cls, v: Optional[List[Point]]) -> Optional[List[Point]]:
        if v is not None and len(v) != SQUAD_SIZE:
            raise ValueError(
                f"opponent_positions는 생략하거나 {SQUAD_SIZE}개여야 합니다 "
                f"(현재 {len(v)}개). 부분 입력은 허용되지 않습니다"
            )
        return v


class ChangingPointIn(PhaseIn):
    """타임라인(매치 체인징 포인트, TO-DO 5번). phases의 base/attack/defense와
    모양이 같고(PhaseIn 그대로 상속 — positions 11개 검증도 물려받는다) id/label만
    추가된다. phases 딕셔너리와는 완전히 별개의 목록이다."""

    id: str = Field(min_length=1)
    label: str = Field(min_length=1)


class AnalysisIn(BaseModel):
    schema_version: Literal[1] = 1
    match: MatchInfo
    formation: str = Field(min_length=1)
    players: List[PlayerIn]
    phases: Dict[PhaseType, PhaseIn]
    # 없으면(구버전 클라이언트/저장분) 타임라인 미사용으로 취급한다.
    changing_points: List[ChangingPointIn] = []
    summary: str = ""

    @field_validator("players")
    @classmethod
    def _check_players(cls, v: List[PlayerIn]) -> List[PlayerIn]:
        if not (SQUAD_SIZE <= len(v) <= MAX_SQUAD_SIZE):
            raise ValueError(
                f"players는 {SQUAD_SIZE}~{MAX_SQUAD_SIZE}명이어야 합니다 (현재 {len(v)}명)"
            )
        ids = [p.id for p in v]
        if len(set(ids)) != len(ids):
            raise ValueError("players[].id 가 중복되었습니다")
        return v

    @model_validator(mode="after")
    def _check_phase_consistency(self) -> "AnalysisIn":
        missing = [p for p in PHASE_TYPES if p not in self.phases]
        if missing:
            raise ValueError(f"phases에 {', '.join(missing)} 국면이 없습니다")

        known = {p.id for p in self.players}
        for phase_type, phase in self.phases.items():
            unknown = {pos.player_id for pos in phase.positions} - known
            if unknown:
                raise ValueError(
                    f"phases.{phase_type}: players에 없는 player_id "
                    f"{sorted(unknown)}"
                )
            if len({pos.player_id for pos in phase.positions}) != SQUAD_SIZE:
                raise ValueError(
                    f"phases.{phase_type}: 같은 선수의 좌표가 중복되었습니다"
                )

        cp_ids = [cp.id for cp in self.changing_points]
        if len(set(cp_ids)) != len(cp_ids):
            raise ValueError("changing_points[].id 가 중복되었습니다")
        for i, cp in enumerate(self.changing_points):
            unknown = {pos.player_id for pos in cp.positions} - known
            if unknown:
                raise ValueError(
                    f"changing_points[{i}]: players에 없는 player_id {sorted(unknown)}"
                )
            if len({pos.player_id for pos in cp.positions}) != SQUAD_SIZE:
                raise ValueError(
                    f"changing_points[{i}]: 같은 선수의 좌표가 중복되었습니다"
                )
        return self


class AnalysisOut(AnalysisIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: str
    updated_at: str


class AnalysisSummary(BaseModel):
    """목록 조회 전용. 좌표를 싣지 않는다 (2단계 §5)."""

    id: int
    match_name: str
    home_team: str
    away_team: str
    match_date: str
    competition: Optional[str] = None
    updated_at: str


class HealthOut(BaseModel):
    status: str
    version: str
