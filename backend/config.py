"""환경 설정. 값은 backend/.env 또는 컨테이너 환경변수에서 읽는다 (3단계 §5, §7)."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent

# DB는 프로젝트 루트의 data/ 에 둔다.
# 컨테이너에서는 이 경로(/app/data)가 호스트의 ./data 로 바인드 마운트되므로,
# 컨테이너를 지우고 다시 만들어도 저장된 분석이 남는다.
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "tacticore.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 실행 위치(cwd)와 무관하게 항상 같은 파일을 가리키도록 절대 경로를 기본값으로 쓴다.
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    cors_origins: str = "http://localhost:5173"  # 콤마 구분
    app_version: str = "1.0.0"
    # 로그인 세션 쿠키의 Secure 플래그(TO-DO 59, Fly.io 배포 준비). 로컬
    # 개발은 http://localhost라 True로 두면 브라우저가 쿠키를 거부해 로그인이
    # 끊긴다 — 그래서 기본값은 False이고, HTTPS로 서빙되는 배포 환경에서만
    # 환경변수(COOKIE_SECURE=true)로 켠다.
    cookie_secure: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
