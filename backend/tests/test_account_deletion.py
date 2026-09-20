"""회원 탈퇴 시 관련 데이터 처리(개선 로드맵 §5.3 필수 테스트 목록 7번).
routers/auth.py의 withdraw() docstring이 설명하는 동작(본인 소유 분석까지
함께 삭제)을 그대로 확인한다."""

import main
from conftest import minimal_analysis_payload, register_user
from fastapi.testclient import TestClient


def test_withdrawal_deletes_owned_analyses_and_session():
    client = TestClient(main.app)
    register_user(client, email="bye@t.com", username="탈퇴예정")
    created = client.post("/api/analyses", json=minimal_analysis_payload()).json()
    analysis_id = created["id"]

    res = client.delete("/api/auth/me")
    assert res.status_code == 204

    # 탈퇴 직후엔 세션도 함께 지워지므로 같은 클라이언트(같은 쿠키)로도
    # 더 이상 인증되지 않는다.
    assert client.get("/api/auth/me").status_code == 401

    # 탈퇴한 사람의 분석이 여전히 id로 조회되면(다른 계정으로) 안 된다 —
    # 소유자가 없어졌으니 그 데이터도 같이 사라져야 한다는 게 기존 결정.
    other = TestClient(main.app)
    register_user(other, email="witness@t.com", username="목격자")
    assert other.get(f"/api/analyses/{analysis_id}").status_code == 404


def test_withdrawal_frees_up_email_for_reuse():
    """탈퇴한 이메일로 재가입이 가능해야 정상적으로 지워진 것이다."""
    client = TestClient(main.app)
    register_user(client, email="reuse@t.com", username="재사용전")
    client.delete("/api/auth/me")

    fresh = TestClient(main.app)
    res = fresh.post(
        "/api/auth/register",
        json={"email": "reuse@t.com", "username": "재사용후", "password": "password123"},
    )
    assert res.status_code == 201
