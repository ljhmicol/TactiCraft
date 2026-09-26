"""FastAPI 앱 진입점 (4단계 Phase 1-7)."""

import secrets

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

import models  # noqa: F401  (create_all 전에 모델 등록이 필요)
import schemas
from config import PROJECT_ROOT, settings
from database import Base, engine, get_db
from routers import (
    admin_users as admin_users_router,
    analyses,
    analytics as analytics_router,
    auth as auth_router,
    comments as comments_router,
    community as community_router,
    moderation as moderation_router,
    share as share_router,
)

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
_ensure_column("comments", "parent_id", "INTEGER REFERENCES comments(id) ON DELETE CASCADE")
_ensure_column("analyses", "visibility", "TEXT NOT NULL DEFAULT 'private'")
_ensure_column("analyses", "share_token", "TEXT")
_ensure_column("sessions", "expires_at", "TEXT")
_ensure_column("sessions", "last_used_at", "TEXT")
_ensure_column("users", "is_suspended", "BOOLEAN DEFAULT 0")


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


def _backfill_visibility_and_tokens() -> None:
    """visibility/share_token 컬럼을 막 추가한 직후엔 기존 분석이 전부
    share_token=NULL이다(visibility는 컬럼 기본값 덕에 이미 'private'로
    채워져 있다). 이 함수는 WHERE share_token IS NULL 조건이라 매번 실행돼도
    안전하다(_backfill_usernames와 같은 패턴) — 새로 만들어지는 분석은
    crud.upsert_analysis가 생성 시점에 토큰을 발급해서 여기 걸릴 일이 없다.

    기존에 is_public=1이던(TO-DO 12번 후속 "커뮤니티 공개") 분석은 이미
    완전히 공개였던 상태이므로 visibility='community'로 승격해 기존 공유
    링크·좋아요·댓글이 안 깨지게 한다. is_public=0이던 분석은 기본값
    'private' 그대로 둔다 — "링크 공개" 중간 단계는 이 컬럼이 생기기 전엔
    존재하지 않았으므로 소급 적용할 근거가 없다.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, is_public FROM analyses WHERE share_token IS NULL")
        ).fetchall()
        for row in rows:
            token = secrets.token_urlsafe(16)
            visibility = "community" if row[1] else "private"
            conn.execute(
                text("UPDATE analyses SET share_token = :t, visibility = :v WHERE id = :i"),
                {"t": token, "v": visibility, "i": row[0]},
            )
        if rows:
            conn.commit()
    # models.py의 share_token은 unique=True, index=True지만 create_all은 기존
    # 테이블의 인덱스를 반영하지 않는다(users.username과 같은 이유 — 위
    # _backfill_usernames 참조) — 이 인덱스가 없으면 get_analysis_by_token이
    # 매번 전체 스캔하고, 극히 낮은 확률이지만 토큰 충돌도 DB가 막아주지
    # 못한다.
    with engine.connect() as conn:
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_analyses_share_token ON analyses(share_token)"))
        conn.commit()


_backfill_visibility_and_tokens()

app = FastAPI(title="TactiCore API", version=settings.app_version)

_MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024  # 2MB — 썸네일 500KB 상한(schemas.py) 등을 감안해 여유 있게


@app.middleware("http")
async def _limit_request_body_size(request, call_next):
    """개선 로드맵 §5.5 — Pydantic 필드별 상한(schemas.py)은 본문을 다 읽고
    파싱한 뒤에야 걸린다. Content-Length를 먼저 보고 걸러내면 그 파싱
    비용 자체를 아낄 수 있다. Content-Length가 없는(chunked) 요청은 이
    앱의 프론트가 보내지 않으므로 통과시킨다.

    CORSMiddleware보다 먼저 등록해 둔다(아래) — Starlette는 나중에 등록한
    미들웨어가 더 바깥쪽을 감싸므로, 이 함수가 CORSMiddleware보다 먼저
    있어야 CORSMiddleware가 이 함수를 감싸는 바깥쪽이 된다. 순서가
    반대였다면 여기서 바로 반환하는 413 응답이 CORS 헤더 없이 나가
    로컬 개발(5173→8000, 교차 출처)에서 브라우저가 이걸 CORS 오류로
    오인해 프론트의 한글 에러 메시지 대신 "Failed to fetch"만 보였을
    것이다(같은 출처인 배포 환경은 영향 없음)."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > _MAX_REQUEST_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "요청 본문이 너무 큽니다"})
    return await call_next(request)


@app.middleware("http")
async def _add_security_headers(request, call_next):
    """기본 보안 헤더(개선 로드맵 §5.5). Content-Security-Policy는 일부러
    뺐다 — Google Fonts·Vite 빌드 산출물과 충돌 없이 값을 확정하려면 실제
    브라우저로 검증해야 하는데, 이 세션 환경에서는 배포된 프로덕션 사이트를
    직접 눈으로 확인할 방법이 없다(shell-sandbox-vs-real-browser-network
    메모리 참조) — 잘못된 CSP를 사람 확인 없이 배포하면 폰트·스크립트 로드가
    조용히 깨질 위험이 있어 별도 검증 세션의 몫으로 남긴다."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    return response


# 로컬 전용이라도 allow_origins=["*"] 는 쓰지 않는다 (3단계 §7).
# 로그인(TO-DO 11번) 세션 쿠키를 주고받으려면 allow_credentials=True가 필요하고,
# CORS 스펙상 이 값이 True면 allow_origins에 "*"를 쓸 수 없다 — cors_origin_list는
# 이미 명시적 목록이라 그대로 둔다. 위 두 미들웨어보다 뒤에 등록한다(이유는
# _limit_request_body_size의 docstring 참조) — Starlette에서 나중에 등록한
# 미들웨어가 더 바깥쪽을 감싸므로, CORSMiddleware가 가장 바깥쪽이어야
# 두 미들웨어가 만드는 응답(413 조기 반환 포함)에도 CORS 헤더가 실린다.
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

app.include_router(admin_users_router.router)
app.include_router(analyses.router)
app.include_router(analytics_router.router)
app.include_router(auth_router.router)
app.include_router(comments_router.router)
app.include_router(community_router.router)
app.include_router(moderation_router.router)
app.include_router(share_router.router)


@app.get("/api/health", response_model=schemas.HealthOut, tags=["health"])
def health(db: Session = Depends(get_db)):
    """프론트가 저장/목록 UI 활성화 여부를 판단하는 데 쓴다 (FR-08 폴백).

    개선 로드맵 §5.4 — 전엔 프로세스가 떠 있기만 하면(uvicorn 응답만 오면)
    무조건 "ok"였다. FastAPI 프로세스는 살아있는데 SQLite 파일이 없어졌거나
    (배포 볼륨 마운트 실패 등) 잠겨 있는 상태는 구분하지 못했다 — 그 경우
    프론트는 "서버 켜져 있음"으로 착각해 저장을 시도했다가 그제서야 실패를
    본다. 매 요청마다 가벼운 `SELECT 1`로 DB까지 실제로 살아있는지 확인하고,
    실패하면 503을 준다 — `useServerHealth`(프론트)는 `isServerUp`을
    `query.isSuccess`로만 판정하므로 503도 "서버 다운"과 똑같이 저장/목록
    UI를 비활성화한다(추가 프론트 변경 불필요).
    """
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        raise HTTPException(status_code=503, detail="database unavailable") from e
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
