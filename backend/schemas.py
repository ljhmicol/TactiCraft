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
    # 드리블/운반 — 공이 선수와 함께 출발한다(프론트 AnnotationLayer, 2026-09-10)
    carry: Optional[bool] = None


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
    # max_length=100(개선 로드맵 §5.5) — 국면 하나에 화살표 100개는 실제
    # 사용 시나리오를 크게 웃돌아, 요청 본문 크기를 키워 서버에 부담을 주려는
    # 시도만 걸러낸다.
    annotations: List[AnnotationIn] = Field(default=[], max_length=100)

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
    # max_length=50(개선 로드맵 §5.5) — 경기 하나에 체인징 포인트 50개는
    # 실사용을 크게 웃돈다.
    changing_points: List[ChangingPointIn] = Field(default=[], max_length=50)
    summary: str = Field(default="", max_length=2000)
    # 목록 검색·필터(TO-DO 7번). 자유 텍스트 태그 — 사전 정의 목록 없음.
    # 개수·글자 수 상한은 아래 _check_tags에서 검증한다(개선 로드맵 §5.5).
    tags: List[str] = []
    # 목록 미리보기(TO-DO 7번) — 프론트가 저장 시점에 base 국면을 캡처해
    # data URL(base64 PNG)로 보낸다. 없으면(구버전 클라이언트) 목록에서
    # 미리보기 없이 표시된다. max_length=500_000(개선 로드맵 §5.5)은 base64
    # 기준 약 375KB — 목록 미리보기용 축소 PNG치곤 넉넉하다.
    thumbnail: Optional[str] = Field(default=None, max_length=500_000)

    @field_validator("tags")
    @classmethod
    def _check_tags(cls, v: List[str]) -> List[str]:
        # 개선 로드맵 §5.5 — 요청 본문 크기를 태그로 부풀리는 시도 방지.
        if len(v) > 20:
            raise ValueError(f"tags는 최대 20개까지 가능합니다 (현재 {len(v)}개)")
        for tag in v:
            if len(tag) > 30:
                raise ValueError("태그 하나는 30자를 넘을 수 없습니다")
        return v

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


Visibility = Literal["private", "link", "community"]


class AnalysisOut(AnalysisIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: str
    updated_at: str
    # 지금 요청한 사람이 이 분석의 소유자인지(TO-DO 12번, 댓글 삭제 버튼 노출
    # 판정용) — 라우터가 채운다(crud.to_analysis_dict는 요청자를 모른다).
    # 비로그인 방문자에게도 분석 자체는 공개이므로 기본값 False로 안전하게 둔다.
    is_owner: bool = False
    # 공개 범위 3단계(2026-09-18, 개선 로드맵 §5.2) — "private"(소유자만) |
    # "link"(share_token을 아는 사람) | "community"(누구나 + 커뮤니티 목록 노출).
    # 기존 is_public 불리언을 대체한다.
    visibility: Visibility = "private"
    # 링크 공개 URL을 만드는 데 필요한 토큰 — 소유자에게만 내려준다(라우터가
    # is_owner가 아니면 None으로 채운다). 남에게 노출되면 링크 공개의 의미가
    # 없어지므로 여기서 항상 값이 있다고 가정하면 안 된다.
    share_token: Optional[str] = None
    # 좋아요(TO-DO 41 후속)는 원래 커뮤니티 목록(CommunityAnalysisOut)에만
    # 있었다 — 공유 링크(/share/:id) 상세 화면엔 좋아요 버튼 자체가 없었기
    # 때문이다(TO-DO 58, 2026-09-17 "커뮤니티에서 게시물에 좋아요 누르는
    # 방법이 없어" — 목록 카드의 작은 하트만으론 찾기 어렵다는 리포트).
    # liked_by_me는 CommunityAnalysisOut과 같은 이유로 비로그인 시 항상 False.
    like_count: int = 0
    liked_by_me: bool = False
    # 커뮤니티 리믹스(개선 로드맵 §7.3) — allow_remix는 소유자만 바꿀 수 있지만
    # (전용 PATCH, 아래 AnalysisRemixSettingsIn) 값 자체는 누구에게나 보인다
    # (버튼을 보여줄지 판단해야 하므로). remixed_from_*는 "이 분석 자체가
    # 리믹스로 만들어졌는지"의 출처 표시 — 원본이 아니라면 전부 None이다.
    allow_remix: bool = True
    remixed_from_id: Optional[int] = None
    remixed_from_author: Optional[str] = None
    remixed_at: Optional[str] = None


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
    visibility: Visibility = "private"


class AnalysisVisibilityIn(BaseModel):
    """공개 범위 변경(개선 로드맵 §5.2, 기존 AnalysisPublicIn 대체) — 이 필드
    하나만 바꾸는 전용 엔드포인트를 쓴다(전체 AnalysisIn PUT을 재사용하지
    않는 이유는, 그러면 에디터에 남아 있는 다른 미저장 변경까지 토글 한 번에
    같이 저장돼버려 "공개 범위만 바꾸려고 눌렀는데 다른 것도 저장됐다"는
    놀람을 줄 수 있어서다)."""

    visibility: Visibility


class AnalysisRemixSettingsIn(BaseModel):
    """리믹스 허용 여부 변경(개선 로드맵 §7.3) — AnalysisVisibilityIn과 같은
    이유로 전용 엔드포인트를 쓴다."""

    allow_remix: bool


class CommunityAnalysisOut(BaseModel):
    """커뮤니티 목록(TO-DO 12번 후속) 카드 한 장 — AnalysisSummary에 작성자
    표시 이름과 댓글 수를 더한다. 누가 공유했는지·얼마나 활발한 토론이
    붙었는지가 커뮤니티 목록의 핵심 정보라 목록 조회 시점에 같이 계산한다.

    like_count/liked_by_me는 TO-DO 41 후속("커뮤니티 좋아요/인기순 정렬")에서
    추가됐다. liked_by_me는 비로그인 조회 시 항상 False다(좋아요 누른 계정을
    알 수 없으므로)."""

    id: int
    match_name: str
    home_team: str
    away_team: str
    match_date: str
    competition: Optional[str] = None
    updated_at: str
    tags: List[str] = []
    thumbnail: Optional[str] = None
    owner_username: str
    comment_count: int = 0
    like_count: int = 0
    liked_by_me: bool = False


class LikeToggleOut(BaseModel):
    """좋아요 토글 응답 — 누른 뒤 상태(liked)와 최신 총 개수를 한 번에 돌려줘서
    프론트가 별도로 목록을 다시 불러오지 않고도 버튼·카운트를 즉시 갱신할 수 있게 한다."""

    liked: bool
    like_count: int


class HealthOut(BaseModel):
    status: str
    version: str


# 로그인(TO-DO 11번, 이메일/비밀번호). email-validator 의존성을 새로 안 들이려고
# EmailStr 대신 간단한 정규식으로 형태만 확인한다 — 실제 존재 확인은 어차피
# 이메일 발송 인프라가 없어서 못 한다(가입 시 검증 메일도 안 보냄, 범위 밖).
_EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
# 댓글(TO-DO 12번) 표시 이름. 한글/영문/숫자/밑줄만 허용 — 공백을 막아
# 댓글 목록에서 "누가 썼는지"가 줄바꿈 없이 한 줄로 또렷하게 보이게 한다.
_USERNAME_RE = r"^[\w가-힣]{2,20}$"


class UserRegister(BaseModel):
    email: str = Field(pattern=_EMAIL_RE)
    username: str = Field(pattern=_USERNAME_RE)
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


class UsernameChange(BaseModel):
    """내 정보 페이지의 닉네임(사용자명) 변경(TO-DO, 2026-09-11)."""

    username: str = Field(pattern=_USERNAME_RE)


class PasswordChange(BaseModel):
    """내 정보 페이지의 비밀번호 변경. 현재 비밀번호를 같이 받는 이유는
    세션 쿠키를 탈취당한 경우 그것만으로 비밀번호를 바꿔 계정을 통째로
    가로채는 걸 막기 위해서다 — 로그인 자체와 같은 검증을 한 번 더 요구한다.
    """

    current_password: str
    new_password: str = Field(min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def _check_password_bytes(cls, v: str) -> str:
        # UserRegister.password와 같은 이유(위 주석 참조) — bcrypt 72바이트 한도.
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
    username: Optional[str] = None  # 백필 전 구버전 계정은 없을 수 있다
    # 운영자 여부(개선 로드맵 §5.5) — DB 컬럼이 아니라 config.py의 admin_emails로
    # 판정한 결과를 그대로 실어 보낸다(routers/auth.py의 me()가 채운다).
    # 프론트가 "신고 처리" 메뉴를 보여줄지 판단하는 용도일 뿐 — 실제 권한
    # 검사는 서버(auth.require_admin)가 매 요청마다 다시 한다.
    is_admin: bool = False


# 회원 관리(2026-09-20, 관리자 요청) — 운영자 전용 회원 목록. UserOut과
# 분리한 이유는 이 스키마가 일반 사용자에겐 절대 안 나가야 할 필드
# (is_suspended, analysis_count처럼 다른 회원의 활동량)를 담기 때문이다.
class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: Optional[str] = None
    created_at: str
    is_suspended: bool = False
    analysis_count: int = 0


# 댓글(TO-DO 12번) + 대댓글·좋아요/싫어요(TO-DO 54, 2026-09-16). 작성은
# 로그인 필수, 삭제는 작성자 본인 또는 분석 소유자만(라우터에서 확인).
class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    # 대댓글 대상 댓글 id — 없으면 최상위 댓글. 대댓글에 또 답글을 달면
    # crud.create_comment가 최상위 댓글로 평탄화한다(1단계 깊이만 허용).
    parent_id: Optional[int] = None

    @field_validator("body")
    @classmethod
    def _strip_and_check(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("빈 댓글은 남길 수 없습니다")
        return v


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    analysis_id: int
    user_id: int
    parent_id: Optional[int] = None
    username: str
    body: str
    created_at: str
    like_count: int = 0
    dislike_count: int = 0
    # 지금 보는 사용자의 반응 — "like" | "dislike" | None. 비로그인 사용자는
    # 항상 None(자기 것이 없으니).
    my_reaction: Optional[Literal["like", "dislike"]] = None


class CommentReactionIn(BaseModel):
    """댓글 좋아요/싫어요(TO-DO 54). 좋아요·싫어요가 상호 배타적이라 두 개의
    bool 필드 대신 어느 쪽을 눌렀는지 하나로 받는다."""

    value: Literal["like", "dislike"]


class CommentReactionOut(BaseModel):
    my_reaction: Optional[Literal["like", "dislike"]] = None
    like_count: int
    dislike_count: int


# 신고(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에 같이"). 분석/댓글
# 공통 — models.Report의 target_type 참조.
ReportTargetType = Literal["analysis", "comment"]


class ReportIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_type: ReportTargetType
    target_id: int
    reporter_username: str
    reason: Optional[str] = None
    created_at: str
    status: Literal["open", "resolved"]
    # 운영자가 목록에서 바로 맥락을 볼 수 있도록 신고 대상의 짧은 미리보기를
    # 같이 얹는다(analysis면 경기 이름, comment면 본문 앞부분) — 대상이 이미
    # 삭제됐으면 None(routers/moderation.py가 채운다).
    target_preview: Optional[str] = None


# 방문자 분석(2026-09-26, "사람들이 사이트 얼마나 사용하는지"). path만 받는다 —
# IP·유저 에이전트는 서버가 아예 저장하지 않는다(models.PageView 참조).
class PageViewIn(BaseModel):
    path: str = Field(max_length=500)


class DailyViewStat(BaseModel):
    date: str  # YYYY-MM-DD
    views: int
    unique_visitors: int


class TopPathStat(BaseModel):
    path: str
    views: int


# "누가 조회했는지 알 수 없냐"는 후속 질문(2026-09-26)에 대한 답 — 비로그인
# 방문자는 애초에 IP·기기 정보를 저장하지 않아 신원을 알 방법이 없지만,
# 로그인 상태의 조회는 PageView.user_id로 이미 남아 있었다. 이 스키마는
# 그 기록을 운영자 화면에 그대로 노출한다.
class RecentUserView(BaseModel):
    username: str
    path: str
    created_at: str


class AnalyticsSummaryOut(BaseModel):
    total_views: int
    unique_visitors: int  # 조회 기간(daily_views가 덮는 기간) 내 순 방문자
    today_views: int
    daily_views: List[DailyViewStat]
    top_paths: List[TopPathStat]
    recent_user_views: List[RecentUserView]


# 내 팀·선수단 템플릿(개선 로드맵 §7.2). PlayerIn과 거의 같은 모양이지만
# id가 필수가 아니다 — 템플릿을 새 분석에 적용하는 시점에 프론트가 새
# nanoid를 발급하므로, 저장된 id를 그대로 재사용할 이유가 없다.
class RosterTemplatePlayerIn(BaseModel):
    name: str = Field(min_length=1)
    number: int = Field(ge=1, le=99)
    role: Optional[str] = None
    tactical_role: Optional[str] = None


class RosterTemplateIn(BaseModel):
    name: str = Field(min_length=1)
    players: List[RosterTemplatePlayerIn] = Field(min_length=1, max_length=23)


class RosterTemplateOut(BaseModel):
    id: int
    name: str
    players: List[RosterTemplatePlayerIn]
    created_at: str
    updated_at: str


# 목록 화면은 선수 명단 전체가 필요 없다 — AnalysisSummary가 phases/players를
# 안 돌려주는 것과 같은 이유(TO-DO 7).
class RosterTemplateSummary(BaseModel):
    id: int
    name: str
    player_count: int
    updated_at: str
