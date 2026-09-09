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
