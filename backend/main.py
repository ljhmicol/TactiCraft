"""FastAPI 앱 진입점 (4단계 Phase 1-7)."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import models  # noqa: F401  (create_all 전에 모델 등록이 필요)
import schemas
from config import settings
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
