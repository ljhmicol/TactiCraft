"""저장 후 재조회했을 때 선수 좌표·전술 데이터가 동일한지(개선 로드맵 §5.3
필수 테스트 목록 5번). 정규화 테이블(analyses/players/phases/positions)로
쪼개 저장했다가 crud.to_analysis_dict가 다시 조립하는 왕복 경로라, 여기서
좌표가 어긋나면 사용자가 화면에서 눈치채기 전에 이미 DB에 잘못 박혀 있다는
뜻이다."""

import main
from conftest import minimal_analysis_payload, register_user
from fastapi.testclient import TestClient


def test_saved_positions_match_on_reload():
    client = TestClient(main.app)
    register_user(client, email="rt@t.com", username="왕복테스트")
    payload = minimal_analysis_payload()

    created = client.post("/api/analyses", json=payload).json()
    reloaded = client.get(f"/api/analyses/{created['id']}").json()

    sent_positions = {p["player_id"]: (p["x"], p["y"]) for p in payload["phases"]["base"]["positions"]}
    got_positions = {p["player_id"]: (p["x"], p["y"]) for p in reloaded["phases"]["base"]["positions"]}
    assert got_positions == sent_positions

    sent_players = {p["id"]: (p["name"], p["number"], p["role"]) for p in payload["players"]}
    got_players = {p["id"]: (p["name"], p["number"], p["role"]) for p in reloaded["players"]}
    assert got_players == sent_players


def test_update_replaces_positions_completely():
    """전체 교체(replace) 저장(crud.py docstring 참조) — PUT 후에는 이전
    좌표가 전혀 남아있지 않고 새 좌표로만 채워져야 한다."""
    client = TestClient(main.app)
    register_user(client, email="rt2@t.com", username="왕복테스트2")
    created = client.post("/api/analyses", json=minimal_analysis_payload()).json()

    moved = minimal_analysis_payload()
    for pos in moved["phases"]["base"]["positions"]:
        pos["x"] = 5.0  # 전부 같은 x로 이동

    client.put(f"/api/analyses/{created['id']}", json=moved)
    reloaded = client.get(f"/api/analyses/{created['id']}").json()
    assert all(p["x"] == 5.0 for p in reloaded["phases"]["base"]["positions"])
