"""세션 해시 저장·만료 + 요청 제한(개선 로드맵 §5.5) 테스트.

로그인/댓글/좋아요 등 여러 엔드포인트에 같은 ratelimit.rate_limit 팩토리를
쓰므로, 여기서는 대표로 로그인 하나만 실제로 429까지 확인한다 — 나머지는
같은 의존성을 재사용할 뿐이라 별도로 반복 검증할 이유가 적다.
"""

from datetime import datetime, timedelta

from fastapi.testclient import TestClient

import main
import models
from conftest import minimal_analysis_payload, register_user
from database import SessionLocal


def test_session_token_stored_as_hash_not_plaintext():
    client = TestClient(main.app)
    register_user(client, email="hash@t.com", username="해시테스트")
    cookie_token = client.cookies.get("tacticore_session")
    assert cookie_token

    db = SessionLocal()
    try:
        session = db.query(models.Session).first()
        # DB에는 원문 쿠키 값이 그대로 남아 있으면 안 된다 — sha256 해시(16진수
        # 64자)만 저장돼야 한다.
        assert session.token != cookie_token
        assert len(session.token) == 64
        assert session.expires_at is not None
    finally:
        db.close()


def test_expired_session_is_rejected():
    client = TestClient(main.app)
    register_user(client, email="expired@t.com", username="만료테스트")
    assert client.get("/api/auth/me").status_code == 200

    db = SessionLocal()
    try:
        session = db.query(models.Session).first()
        session.expires_at = (datetime.now() - timedelta(days=1)).isoformat(timespec="seconds")
        db.commit()
    finally:
        db.close()

    assert client.get("/api/auth/me").status_code == 401


def test_login_rate_limited_after_repeated_attempts():
    setup = TestClient(main.app)
    register_user(setup, email="ratelimit@t.com", username="제한테스트")

    fresh = TestClient(main.app)
    # routers/auth.py의 _login_rate_limit: 10회/5분(IP 기준). 틀린 비밀번호로
    # 10번까지는 401(정상 거부), 11번째부터 429여야 한다.
    for _ in range(10):
        res = fresh.post("/api/auth/login", json={"email": "ratelimit@t.com", "password": "wrong"})
        assert res.status_code == 401
    res = fresh.post("/api/auth/login", json={"email": "ratelimit@t.com", "password": "wrong"})
    assert res.status_code == 429


def test_oversized_thumbnail_rejected():
    client = TestClient(main.app)
    register_user(client, email="bigthumb@t.com", username="썸네일테스트")
    payload = minimal_analysis_payload(thumbnail="x" * 500_001)
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_too_many_tags_rejected():
    client = TestClient(main.app)
    register_user(client, email="manytags@t.com", username="태그테스트")
    payload = minimal_analysis_payload(tags=[f"tag{i}" for i in range(21)])
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 422


def test_oversized_request_body_rejected_before_parsing():
    client = TestClient(main.app)
    register_user(client, email="hugebody@t.com", username="본문크기테스트")
    payload = minimal_analysis_payload(summary="x" * (3 * 1024 * 1024))
    res = client.post("/api/analyses", json=payload)
    assert res.status_code == 413
