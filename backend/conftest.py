"""pytest 전역 설정(개선 로드맵 §5.3).

DATABASE_URL을 다른 어떤 앱 모듈(import main 등)보다 먼저 임시 파일로
고정한다 — config.py의 Settings()가 프로세스 시작 시점의 환경변수를 한 번만
읽어 engine을 만들기 때문에(database.py), 여기서 늦게 설정하면 이미 실제
개발 DB(data/tacticore.db)를 가리킨 뒤라 테스트가 실사용 데이터를 건드리게
된다. conftest.py는 pytest가 테스트 파일을 수집하기 전에 항상 먼저
로드되므로, 이 파일 맨 위(다른 import보다 먼저)에서 환경변수를 고정하면
안전하다.
"""

import os
import tempfile
from pathlib import Path

_tmp_dir = tempfile.mkdtemp(prefix="tacticraft_test_")
_tmp_db_path = Path(_tmp_dir) / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path.as_posix()}"
os.environ["COOKIE_SECURE"] = "false"
os.environ["CORS_ORIGINS"] = "http://testserver"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from database import SessionLocal  # noqa: E402


@pytest.fixture()
def client():
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def _clean_tables():
    """매 테스트가 끝나면 모든 테이블을 비운다 — 테스트 간 데이터가 섞이면
    "회원 A가 회원 B의 분석에 접근 못 함" 같은 격리 테스트 자체가 오염된다.
    스키마는 conftest 로드 시 main.py가 이미 만들어 둔 상태라 여기선 행만
    지운다. FK 제약(PRAGMA foreign_keys=ON, database.py)을 지키려고 생성
    순서의 역순(자식 테이블부터)으로 지운다.
    """
    yield
    db = SessionLocal()
    try:
        for table in reversed(main.Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()


def register_user(client: TestClient, *, email: str, username: str, password: str = "password123") -> TestClient:
    """회원가입 + 로그인 상태 쿠키가 담긴 client를 그대로 돌려준다(TestClient는
    세션 쿠키를 자동으로 들고 다닌다) — 이후 요청은 이 계정으로 인증된다."""
    res = client.post(
        "/api/auth/register",
        json={"email": email, "username": username, "password": password},
    )
    assert res.status_code == 201, res.text
    return client


def minimal_analysis_payload(**overrides) -> dict:
    """schemas.AnalysisIn이 요구하는 최소 유효 페이로드 — 11명 선수, 3국면
    전부 좌표 채움. 2026-09-18 세션에서 curl로 실제 검증했던 것과 같은 형태를
    재사용한다."""
    players = [
        {"id": f"p{i}", "name": str(i), "number": i, "role": role}
        for i, role in enumerate(
            ["GK", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "FW", "FW", "FW"], start=1
        )
    ]
    positions = [
        {"player_id": f"p{i}", "x": 8.0 * i, "y": 50.0} for i in range(1, 12)
    ]
    phase = {"positions": positions, "pressing_line_y": 50.0, "annotations": []}
    payload = {
        "schema_version": 1,
        "match": {
            "match_name": "테스트 경기",
            "home_team": "A",
            "away_team": "B",
            "match_date": "2026-09-18",
            "analyzed_team": "home",
        },
        "formation": "4-3-3",
        "players": players,
        "phases": {"base": phase, "attack": phase, "defense": phase},
        "changing_points": [],
        "summary": "",
        "tags": [],
    }
    payload.update(overrides)
    return payload
