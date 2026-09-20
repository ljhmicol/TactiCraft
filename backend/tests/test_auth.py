"""회원가입/로그인/로그아웃(개선 로드맵 §5.3 필수 테스트 목록 1번)."""

from conftest import register_user


def test_register_creates_session(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "a@t.com", "username": "가입자", "password": "password123"},
    )
    assert res.status_code == 201
    assert res.json()["email"] == "a@t.com"
    # 가입 직후 곧바로 로그인 상태여야 한다 — register_user에서 재사용하는 전제.
    me = client.get("/api/auth/me")
    assert me.status_code == 200


def test_register_duplicate_email_rejected(client):
    client.post("/api/auth/register", json={"email": "dup@t.com", "username": "가입자1", "password": "password123"})
    res = client.post("/api/auth/register", json={"email": "dup@t.com", "username": "가입자2", "password": "password123"})
    assert res.status_code == 400


def test_register_duplicate_username_rejected(client):
    client.post("/api/auth/register", json={"email": "u1@t.com", "username": "같은이름", "password": "password123"})
    res = client.post("/api/auth/register", json={"email": "u2@t.com", "username": "같은이름", "password": "password123"})
    assert res.status_code == 400


def test_login_with_correct_password_succeeds(client):
    client.post("/api/auth/register", json={"email": "b@t.com", "username": "로그인용", "password": "password123"})
    client.post("/api/auth/logout")
    res = client.post("/api/auth/login", json={"email": "b@t.com", "password": "password123"})
    assert res.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_login_with_wrong_password_rejected(client):
    client.post("/api/auth/register", json={"email": "c@t.com", "username": "틀린비번용", "password": "password123"})
    client.post("/api/auth/logout")
    res = client.post("/api/auth/login", json={"email": "c@t.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_login_with_unknown_email_rejected(client):
    res = client.post("/api/auth/login", json={"email": "nobody@t.com", "password": "password123"})
    assert res.status_code == 401


def test_me_requires_login(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_logout_invalidates_session(client):
    """로그아웃 후엔 같은 쿠키로도 인증이 통과하면 안 된다 — 세션 "무효화"
    확인(로드맵이 요구한 "세션 만료와 무효화" 중 무효화 쪽). 만료(시간 경과로
    자동 무효화)는 현재 백엔드에 구현돼 있지 않아(Session에 expires_at이
    없음, 개선 로드맵 §5.5) 아직 테스트할 대상 자체가 없다."""
    register_user(client, email="d@t.com", username="로그아웃용")
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
