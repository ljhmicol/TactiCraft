"""SQLAlchemy ORM 모델 (2단계 §4의 SQL 스키마와 대응).

relationship 의 cascade="all, delete-orphan" 은 DB의 FK CASCADE와 별개다.
ORM 레벨 삭제 전파를 위해 둘 다 필요하다.
"""

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    """로그인 계정(TO-DO 11번, 이메일/비밀번호). 비밀번호는 bcrypt 해시만 저장한다."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(String, nullable=False)
    # 댓글(TO-DO 12번)에 쓰는 표시 이름 — "커뮤니티에서 서로 얘기할 때 이름이
    # 있는 게 좋다"(2026-09-10 사용자 결정)는 요청으로 회원가입 시점부터
    # 받는다. 기존 DB에는 없는 컬럼이라 main.py에서 _ensure_column으로
    # 채운다(curved/carry와 같은 이유) — DB에는 nullable로 두고 기존 계정은
    # 이메일 앞부분으로 백필한다. 새 가입은 UserRegister가 항상 요구한다.
    username = Column(String, unique=True)


class Session(Base):
    """로그인 세션(httpOnly 쿠키에 담는 토큰). JWT 대신 이 테이블 방식을 쓴 이유는
    로그아웃 시 즉시 무효화할 수 있어야 하기 때문 — JWT는 만료 전까지 서버가
    통제할 수 없다."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String, nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(String, nullable=False)


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 로그인(TO-DO 11번) 이전에 저장된 분석은 NULL — 첫 가입 계정에 전부
    # 귀속시킨다(2026-09-09 사용자 결정, routers/auth.py의 register 참조).
    # 이 테이블이 로그인보다 먼저 존재해서 ALTER TABLE로 채운다(main.py
    # _ensure_column) — tactical_role/curved/minute과 같은 이유.
    user_id = Column(Integer, ForeignKey("users.id"))
    match_name = Column(String, nullable=False)
    home_team = Column(String, nullable=False)
    away_team = Column(String, nullable=False)
    match_date = Column(String, nullable=False)  # YYYY-MM-DD
    competition = Column(String)
    analyzed_team = Column(String, nullable=False)  # 'home' | 'away'
    formation = Column(String, nullable=False)
    summary = Column(Text)
    # 목록 화면 미리보기(TO-DO 7번) — base 국면을 작게 렌더링한 PNG를 프론트가
    # 저장 시점에 만들어 data URL 문자열째로 보낸다. 목록 조회 때마다 서버가
    # 다시 렌더링하면 느리다는 게 원래 TO-DO 메모의 판단이었다(파일/BLOB
    # 컬럼 필요). BLOB 대신 Text로 두는 이유는 새 테이블/파일 관리 없이
    # DB 백업 하나에 다 들어가게 하기 위해서 — SQLite는 컬럼 크기 제한이
    # 없어 data URL(base64) 그대로 넣어도 문제없다.
    thumbnail = Column(Text)
    # 목록 검색·필터(TO-DO 7번) — JSON 타입은 SQLAlchemy가 파이썬 list ↔
    # SQLite TEXT를 자동으로 (역)직렬화해준다. 정규화 테이블(별도 tags
    # 테이블 + 다대다)은 이 규모(분석 하나당 태그 몇 개)엔 과해서 채택 안 함.
    tags = Column(JSON, nullable=False, default=list)
    schema_version = Column(Integer, nullable=False, default=1)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    # 커뮤니티 공개 여부(TO-DO 12번 후속, 2026-09-10) — 기본 비공개.
    # 사용자가 "작성자가 공유하기를 누른 것만" 공개 목록에 뜨는 opt-in 모델을
    # 선택했다(전체 자동 공개는 기각) — 기존 저장분도 이 컬럼이 없던 시절엔
    # 전부 비공개로 취급되도록 기본값 False로 마이그레이션한다
    # (_ensure_column, curved/carry/username과 같은 패턴).
    # 2026-09-18(개선 로드맵 §5.2) — visibility로 대체됐다. 이 컬럼은 마이그레이션
    # 시 visibility 초기값을 정하는 데 한 번만 읽히고 이후로는 앱 코드 어디서도
    # 읽거나 쓰지 않는다 — SQLite에서 컬럼 삭제(ALTER TABLE DROP COLUMN)는 구버전
    # 호환 위험이 있어 죽은 컬럼으로 남겨 두는 쪽을 택했다(_ensure_column 패턴이
    # 애초에 컬럼 삭제를 지원하지 않는다).
    is_public = Column(Boolean, nullable=False, default=False)
    # 공개 범위 3단계(2026-09-18, 개선 로드맵 §5.2) — "private"(소유자만) |
    # "link"(share_token을 아는 사람) | "community"(누구나, 커뮤니티 목록 노출).
    # is_public 불리언 하나로는 "링크만 아는 사람에게 공유"를 표현할 수 없었고,
    # 무엇보다 비공개 분석도 순차 정수 id를 스캔하면 그대로 읽히는 게 실제
    # 취약점이었다(공유 링크와 편집기 로드가 같은 id 기반 엔드포인트를 공유).
    visibility = Column(String, nullable=False, default="private")
    # 링크 공개용 추측 불가능한 토큰(2026-09-18) — id는 순차 정수라 그 자체로는
    # 비밀이 될 수 없으므로, "링크를 아는 사람만" 접근을 진짜로 강제하려면
    # id와 별개의 랜덤 값이 필요하다. 생성 시점(crud.upsert_analysis)에
    # secrets.token_urlsafe로 한 번 발급되고 이후 바뀌지 않는다.
    share_token = Column(String, unique=True, index=True)

    players = relationship(
        "Player",
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="Player.id",
    )
    phases = relationship(
        "Phase",
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="Phase.id",
    )
    changing_points = relationship(
        "ChangingPoint",
        back_populates="analysis",
        cascade="all, delete-orphan",
        order_by="ChangingPoint.order_index",
    )


class Player(Base):
    __tablename__ = "players"
    __table_args__ = (UniqueConstraint("analysis_id", "client_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    # JSON 쪽 players[].id 를 그대로 보존한다. 저장·재로드를 반복해도 이 값이
    # 바뀌지 않아야 모핑 애니메이션의 노드 동일성이 유지된다 (4단계 §5.1).
    client_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    number = Column(Integer, nullable=False)
    role = Column(String)
    # 전술 역할(FM 스타일) id — frontend/src/lib/tacticalRoles.ts 참조. role(자유
    # 메모)과 별개 컬럼. 기존 DB에는 없을 수 있어 main.py에서 수동 ALTER TABLE로
    # 채운다(create_all은 기존 테이블에 컬럼을 추가하지 못한다) — TO-DO 20
    tactical_role = Column(String)

    analysis = relationship("Analysis", back_populates="players")
    positions = relationship(
        "Position", back_populates="player", cascade="all, delete-orphan"
    )


class Phase(Base):
    __tablename__ = "phases"
    __table_args__ = (UniqueConstraint("analysis_id", "phase_type"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    phase_type = Column(String, nullable=False)  # 'base' | 'attack' | 'defense'
    pressing_line_y = Column(Float)  # NULL이면 프론트에서 자동 산출
    comment = Column(Text)

    analysis = relationship("Analysis", back_populates="phases")
    positions = relationship(
        "Position",
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="Position.id",
    )
    annotations = relationship(
        "Annotation",
        back_populates="phase",
        cascade="all, delete-orphan",
        order_by="Annotation.id",
    )


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phase_id = Column(
        Integer, ForeignKey("phases.id", ondelete="CASCADE"), nullable=False
    )
    # 상대팀 좌표는 선수 정보가 없으므로 NULL이다.
    player_id = Column(Integer, ForeignKey("players.id", ondelete="CASCADE"))
    side = Column(String, nullable=False)  # 'own' | 'opponent'
    slot = Column(Integer, nullable=False, default=0)  # 상대팀 좌표 순서 보존
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)

    phase = relationship("Phase", back_populates="positions")
    player = relationship("Player", back_populates="positions")


class Annotation(Base):
    """국면별 화살표(전술 그리기, TO-DO 1번). 자유 좌표 — 선수에게 부착되지 않는다.

    기존 DB에 이 테이블이 없어도 create_all이 새 테이블은 자동 생성한다
    (기존 테이블에 컬럼을 추가하는 방식은 create_all이 반영하지 못해 쓰지 않았다).
    """

    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    phase_id = Column(Integer, ForeignKey("phases.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(String, nullable=False)  # JSON 쪽 id를 그대로 보존
    ann_type = Column(String, nullable=False)  # 'run'(실선·움직임) | 'pass'(점선·패스)
    from_x = Column(Float, nullable=False)
    from_y = Column(Float, nullable=False)
    to_x = Column(Float, nullable=False)
    to_y = Column(Float, nullable=False)
    # 곡선 화살표(오버랩 런 등) 여부. 기존 DB에는 없을 수 있는 컬럼이라
    # main.py에서 수동 ALTER TABLE로 채운다 — players.tactical_role과 같은
    # 이유(create_all은 기존 테이블에 컬럼을 추가하지 못한다), TO-DO 2026-09-07
    curved = Column(Boolean)
    # 드리블/운반 구간 여부. curved와 같은 이유로 main.py에서 _ensure_column으로
    # 채운다(2026-09-10 — 기존 DB에는 없는 컬럼이다).
    carry = Column(Boolean)

    phase = relationship("Phase", back_populates="annotations")


class ChangingPoint(Base):
    """타임라인(매치 체인징 포인트, TO-DO 5번). 기본/공격/수비 3국면과는 별개의
    선택적 확장 — 좌표/화살표/코멘트는 기존 Phase/Position/Annotation 테이블을
    그대로 재사용하고(phase_type을 'cp:<client_id>'로 둬 UniqueConstraint를
    만족시킨다), 이 테이블은 라벨·시간·순서만 얹는 얇은 메타데이터다. 새 테이블이라
    create_all이 자동 생성한다 — annotations 테이블과 같은 이유로 ALTER TABLE
    불필요(models.py 상단 Annotation 클래스 주석 참조). 단 minute 컬럼은 이 테이블이
    이미 만들어진 뒤(2026-09-09 이전 배포)에 추가됐으므로 main.py에서
    _ensure_column으로 채운다 — tactical_role/curved와 같은 이유.
    """

    __tablename__ = "changing_points"
    __table_args__ = (UniqueConstraint("analysis_id", "client_id"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    client_id = Column(String, nullable=False)  # JSON changingPoints[].id 보존
    label = Column(String, nullable=False)
    minute = Column(Float)  # 경기 시간(분), 0~120 — 없으면 "시간 미정"
    order_index = Column(Integer, nullable=False, default=0)  # 배열 순서 보존
    phase_id = Column(
        Integer, ForeignKey("phases.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    analysis = relationship("Analysis", back_populates="changing_points")
    phase = relationship("Phase")


class Comment(Base):
    """분석 전체에 붙는 댓글(TO-DO 12번) + 대댓글(TO-DO 54, 2026-09-16).

    2026-09-10엔 "스레드/답글 없이 평평한 목록"을 선택했으나(당시 사용자
    결정), 2026-09-16에 "대댓글을 남길 수 있으면 좋겠어"로 번복됐다 —
    `parent_id`(자기 참조 FK)로 1단계 깊이만 표현한다: 대댓글에 다시
    답글을 달면 그 대댓글의 부모(즉 최상위 댓글)로 평탄화한다(무한 중첩
    방지, crud.create_comment 참조). 최상위 댓글이면 NULL. 기존 테이블에
    컬럼을 추가하는 것이라 create_all이 아니라 main.py의 `_ensure_column`이
    처리한다(players.tactical_role과 같은 이유).

    username은 users.username과 중복 저장이다(정규화 위반) — 이 프로젝트가
    이미 쓰는 패턴(분석 목록 썸네일을 PNG data URL로 통째로 저장)과 같은
    이유로, 댓글을 읽을 때마다 users 테이블과 조인하지 않고 바로 보여주기
    위해서다. 현재 사용자명 변경 기능이 없어 최신값과 어긋날 일도 없다.
    """

    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(
        Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    username = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(String, nullable=False)

    analysis = relationship("Analysis")
    user = relationship("User")


class CommentReaction(Base):
    """댓글 좋아요/싫어요(TO-DO 54) — Like(분석 좋아요)와 달리 좋아요·싫어요가
    상호 배타적이라 bool 행의 존재 여부가 아니라 `value`(1=좋아요, -1=싫어요)
    컬럼으로 상태를 표현한다. (comment_id, user_id) 유니크 제약으로 1인
    1표만 — 같은 값을 다시 누르면 취소(행 삭제), 반대 값을 누르면 value만
    갱신한다(crud.toggle_comment_reaction). 새 테이블이라 create_all이
    자동 생성한다.
    """

    __tablename__ = "comment_reactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    value = Column(Integer, nullable=False)  # 1(좋아요) | -1(싫어요)
    created_at = Column(String, nullable=False)

    comment = relationship("Comment")
    user = relationship("User")

    __table_args__ = (UniqueConstraint("comment_id", "user_id", name="uq_comment_reactions_comment_user"),)


class Like(Base):
    """커뮤니티 좋아요(TO-DO 41 후속, "커뮤니티 좋아요/인기순 정렬").
    Comment와 같은 이유로 새 테이블이라 create_all이 자동 생성한다.
    (analysis_id, user_id) 유니크 제약으로 1인 1회만 — 토글 방식(다시
    누르면 이 행을 지운다)이라 상태를 bool 컬럼이 아니라 행의 존재
    여부로 표현한다."""

    __tablename__ = "likes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(String, nullable=False)

    analysis = relationship("Analysis")
    user = relationship("User")

    __table_args__ = (UniqueConstraint("analysis_id", "user_id", name="uq_likes_analysis_user"),)
