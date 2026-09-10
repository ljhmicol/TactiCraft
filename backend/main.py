"""FastAPI 앱 진입점 (4단계 Phase 1-7)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

import models  # noqa: F401  (create_all 전에 모델 등록이 필요)
import schemas
from config import PROJECT_ROOT, settings
from database import Base, engine
from routers import analyses, auth as auth_router, comments as comments_router, community as community_router

Base.metadata.create_all(bind=engine)


def _ensure_column(table: str, column: str, ddl_type: str) -> None:
    """create_all은 새 테이블만 만들고 기존 테이블에 컬럼을 추가하지 못한다.

    이미 만들어진 DB 파일에는 없을 수 있는 컬럼을, 없으면 여기서 한 번
    ALTER TABLE로 채워 넣는다. 이미 있으면 아무 것도 하지 않는다(재기동마다
    안전하게 반복 실행 가능). players.tactical_role(TO-DO 20)에서 처음
    쓴 패턴 — annotations.curved(TO-DO, 2026-09-07)도 같은 이유로 필요.
    """
    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
        if column not in columns:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl_type}"))
            conn.commit()


_ensure_column("players", "tactical_role", "VARCHAR")
_ensure_column("annotations", "curved", "BOOLEAN")
_ensure_column("annotations", "carry", "BOOLEAN")
_ensure_column("changing_points", "minute", "FLOAT")
_ensure_column("analyses", "user_id", "INTEGER REFERENCES users(id)")
_ensure_column("analyses", "thumbnail", "TEXT")
_ensure_column("analyses", "tags", "TEXT DEFAULT '[]'")
_ensure_column("users", "username", "VARCHAR")
_ensure_column("analyses", "is_public", "BOOLEAN DEFAULT 0")


def _backfill_usernames() -> None:
    """username 컬럼을 막 추가한 직후엔 기존 계정이 전부 NULL이다 — 댓글(TO-DO
    12번)에 빈 이름으로 뜨는 걸 막기 위해 이메일 앞부분으로 한 번 채워 넣는다.
    이후 회원가입(UserRegister)은 username을 항상 요구하므로 새 계정은 NULL이
    될 일이 없다 — 그래서 이 함수는 매번 실행돼도 조용히 아무 일도 안 한다
    (WHERE username IS NULL 조건).
    """
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, email FROM users WHERE username IS NULL")).fetchall()
        for row in rows:
            fallback = row[1].split("@")[0]
            conn.execute(text("UPDATE users SET username = :u WHERE id = :i"), {"u": fallback, "i": row[0]})
        if rows:
            conn.commit()
    # username은 이제 로그인마다 항상 값이 있어야 하는 컬럼이라, ALTER로 뒤늦게
    # 추가된 이 컬럼에도 새 가입 시 중복을 막을 유니크 인덱스를 걸어 둔다
    # (create_all은 기존 테이블을 건드리지 않아 모델의 unique=True가 반영 안
    # 됐다 — _ensure_column과 같은 이유).
    with engine.connect() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users(username)"))
        conn.commit()


_backfill_usernames()

app = FastAPI(title="TactiCore API", version=settings.app_version)

# 로컬 전용이라도 allow_origins=["*"] 는 쓰지 않는다 (3단계 §7).
# 로그인(TO-DO 11번) 세션 쿠키를 주고받으려면 allow_credentials=True가 필요하고,
# CORS 스펙상 이 값이 True면 allow_origins에 "*"를 쓸 수 없다 — cors_origin_list는
# 이미 명시적 목록이라 그대로 둔다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    # PATCH는 커뮤니티 공개 토글(TO-DO 12번 후속, /analyses/:id/public)에서
    # 처음 쓰였다 — 브라우저의 preflight(OPTIONS)가 이 목록에 없는 메서드는
    # 거부해 "Failed to fetch"로 보인다(2026-09-10 Playwright 검증 중 발견).
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(analyses.router)
app.include_router(auth_router.router)
app.include_router(comments_router.router)
app.include_router(community_router.router)


@app.get("/api/health", response_model=schemas.HealthOut, tags=["health"])
def health():
    """프론트가 저장/목록 UI 활성화 여부를 판단하는 데 쓴다 (FR-08 폴백)."""
    return {"status": "ok", "version": settings.app_version}


# 단일 이미지 배포(TO-DO 10번) — Dockerfile이 프론트를 빌드해 여기 복사해 둔다.
# 로컬 개발(Vite 5173 + uvicorn 8000 2프로세스)에는 이 디렉터리가 없으므로
# 아래 블록 전체가 조용히 건너뛰어진다 — 로컬 개발 경험에 영향 없음.
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str):
        """정적 파일(예: /samples/managers/*.json, 파비콘)은 그대로 서빙하고,
        그 외 경로(React Router가 처리할 클라이언트 라우트)는 index.html로
        폴백한다 — 이 라우트가 /api/* 보다 뒤에 등록돼 있어야 API가 먼저 잡힌다."""
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
