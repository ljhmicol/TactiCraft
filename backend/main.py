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
from routers import analyses

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
_ensure_column("changing_points", "minute", "FLOAT")

app = FastAPI(title="TactiCore API", version=settings.app_version)

# 로컬 전용이라도 allow_origins=["*"] 는 쓰지 않는다 (3단계 §7).
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(analyses.router)


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
