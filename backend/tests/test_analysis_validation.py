"""잘못된 좌표·선수 수·중복 ID 요청 거부(개선 로드맵 §5.3 필수 테스트 목록
8번). 각각 schemas.py의 field/model validator 하나씩과 대응한다 — 스키마
쪽 로직이지만, 실제로 그 검증이 API 경계에서 살아있는지(예: 라우터가
검증을 우회하지 않는지)까지 확인하는 게 목적이라 유닛이 아니라 API
테스트로 둔다."""

import main
from conftest import minimal_analysis_payload, register_user
from fastapi.testclient import TestClient


def _client() -> TestClient:
    client = TestClient(main.app)
    register_user(client, email="valid@t.com", username="검증테스트")
    return client


def test_out_of_range_coordinate_rejected():
    client = _client()
    payload = minimal_analysis_payload()
    payload["phases"]["base"]["positions"][0]["x"] = 150.0  # 0~100 범위 밖
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_too_few_players_rejected():
    client = _client()
    payload = minimal_analysis_payload()
    payload["players"] = payload["players"][:5]  # 11명 미만
    # positions는 그대로 11개라 player_id 일부가 players에 없는 상태가 됨 —
    # 어느 검증이든(선수 수 부족 또는 unknown player_id) 422여야 한다.
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_duplicate_player_id_rejected():
    client = _client()
    payload = minimal_analysis_payload()
    payload["players"][1]["id"] = payload["players"][0]["id"]  # 중복
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_missing_phase_rejected():
    client = _client()
    payload = minimal_analysis_payload()
    del payload["phases"]["defense"]
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_duplicate_position_for_same_player_rejected():
    client = _client()
    payload = minimal_analysis_payload()
    # 같은 선수 좌표가 두 번 등장하고, 다른 선수 한 명이 통째로 빠진 상태
    payload["phases"]["base"]["positions"][1]["player_id"] = payload["phases"]["base"]["positions"][0]["player_id"]
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422
