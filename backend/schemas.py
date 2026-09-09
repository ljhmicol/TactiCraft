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
    모양이 같고(PhaseIn 그대로 상속 — positions 11개 검증도 물려받는다) id/label/
    minute이 추가된다. phases 딕셔너리와는 완전히 별개의 목록이다."""

    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    minute: Optional[float] = Field(default=None, ge=0, le=120)


class AnalysisIn(BaseModel):
    schema_version: Literal[1] = 1
    match: MatchInfo
    formation: str = Field(min_length=1)
    players: List[PlayerIn]
    phases: Dict[PhaseType, PhaseIn]
    # 없으면(구버전 클라이언트/저장분) 타임라인 미사용으로 취급한다.
    changing_points: List[ChangingPointIn] = []
    summary: str = ""
    # 목록 검색·필터(TO-DO 7번). 자유 텍스트 태그 — 사전 정의 목록 없음.
    tags: List[str] = []
    # 목록 미리보기(TO-DO 7번) — 프론트가 저장 시점에 base 국면을 캡처해
    # data URL(base64 PNG)로 보낸다. 없으면(구버전 클라이언트) 목록에서
    # 미리보기 없이 표시된다.
    thumbnail: Optional[str] = None

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
    """목록 조회 전용. 좌표를 싣지 않는다 (2단계 §5). 썸네일·태그는 예외로
    포함한다(TO-DO 7번) — 목록 화면이 보여줄 목적으로 만든 값이라 좌표와
    달리 여기서 굳이 뺄 이유가 없다."""

    id: int
    match_name: str
    home_team: str
    away_team: str
    match_date: str
    competition: Optional[str] = None
    updated_at: str
    tags: List[str] = []
    thumbnail: Optional[str] = None


class HealthOut(BaseModel):
    status: str
    version: str


# 로그인(TO-DO 11번, 이메일/비밀번호). email-validator 의존성을 새로 안 들이려고
# EmailStr 대신 간단한 정규식으로 형태만 확인한다 — 실제 존재 확인은 어차피
# 이메일 발송 인프라가 없어서 못 한다(가입 시 검증 메일도 안 보냄, 범위 밖).
_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class UserRegister(BaseModel):
    email: str = Field(pattern=_EMAIL_RE)
    password: str = Field(min_length=8, max_length=100)

    @field_validator("password")
    @classmethod
    def _check_password_bytes(cls, v: str) -> str:
        # bcrypt는 72바이트를 넘는 부분을 조용히 잘라버린다(예외를 던지지
        # 않는다) — 그대로 두면 72바이트 이후만 다른 두 비밀번호가 같은
        # 해시로 저장돼 로그인이 통과하는 사고가 난다. max_length=100은
        # 문자 수 기준이라 한글처럼 멀티바이트 문자에서는 이 값보다 훨씬
        # 먼저 72바이트를 넘을 수 있어 별도로 바이트 길이를 확인한다.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("비밀번호는 72바이트(한글 약 24자)를 넘을 수 없습니다")
        return v


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
