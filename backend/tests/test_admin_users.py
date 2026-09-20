"""회원 관리(2026-09-20, 관리자 요청 "회원들이 회원가입을 하면 내가
관리를 해야할 것 같은데") — 목록 조회 + 정지("로그인만 차단" 범위로
사용자가 직접 확정). conftest.py가 ADMIN_EMAILS=admin@t.com으로 고정해
둬서, 이 이메일로 가입한 계정만 운영자 전용 엔드포인트를 통과한다."""

from fastapi.testclient import TestClient

import main
from config import settings
from conftest import minimal_analysis_payload, register_user


def _admin_client() -> TestClient:
    client = TestClient(main.app)
    register_user(client, email="admin@t.com", username="운영자")
    return client


def test_non_admin_cannot_access_user_management():
    plain = TestClient(main.app)
    register_user(plain, email="plain@t.com", username="일반사용자")

    assert plain.get("/api/admin/users").status_code == 403
    assert plain.post("/api/admin/users/1/suspend").status_code == 403


def test_admin_can_list_users_with_analysis_count():
    member = TestClient(main.app)
    register_user(member, email="member@t.com", username="회원")
    member.post("/api/analyses", json=minimal_analysis_payload())
    member.post("/api/analyses", json=minimal_analysis_payload())

    admin = _admin_client()
    users = admin.get("/api/admin/users").json()
    row = next(u for u in users if u["email"] == "member@t.com")
    assert row["analysis_count"] == 2
    assert row["is_suspended"] is False


def test_admin_can_suspend_and_unsuspend_user():
    member = TestClient(main.app)
    register_user(member, email="tobesuspended@t.com", username="정지대상")

    admin = _admin_client()
    users = admin.get("/api/admin/users").json()
    user_id = next(u["id"] for u in users if u["email"] == "tobesuspended@t.com")

    res = admin.post(f"/api/admin/users/{user_id}/suspend")
    assert res.status_code == 200
    assert res.json()["is_suspended"] is True

    # 정지된 계정은 그 자리에서 즉시 로그아웃된다 — 세션이 삭제돼 이후
    # 요청은 "로그인 필요"(401)로 취급된다(정지 자체를 구분해 알리는 403은
    # 세션이 아직 남아 있는 경우를 위한 방어 코드, auth.get_current_user 참조).
    assert member.get("/api/auth/me").status_code == 401
    login_res = TestClient(main.app).post(
        "/api/auth/login", json={"email": "tobesuspended@t.com", "password": "password123"}
    )
    assert login_res.status_code == 403

    res2 = admin.post(f"/api/admin/users/{user_id}/unsuspend")
    assert res2.status_code == 200
    assert res2.json()["is_suspended"] is False

    login_res2 = TestClient(main.app).post(
        "/api/auth/login", json={"email": "tobesuspended@t.com", "password": "password123"}
    )
    assert login_res2.status_code == 200


def test_admin_cannot_suspend_self():
    admin = _admin_client()
    me = admin.get("/api/auth/me").json()

    res = admin.post(f"/api/admin/users/{me['id']}/suspend")
    assert res.status_code == 400


def test_admin_cannot_suspend_another_admin(monkeypatch):
    """운영자가 여럿(ADMIN_EMAILS에 이메일 두 개)일 때, 한 운영자가 다른
    운영자를 정지해 잠글 수 없어야 한다(advisor 리뷰로 발견 — 처음엔
    "본인만" 막아서 이 경우가 새는 구멍이었다)."""
    monkeypatch.setattr(settings, "admin_emails", "admin@t.com,admin2@t.com")

    admin1 = _admin_client()
    admin2 = TestClient(main.app)
    register_user(admin2, email="admin2@t.com", username="운영자2")
    admin2_id = admin2.get("/api/auth/me").json()["id"]

    res = admin1.post(f"/api/admin/users/{admin2_id}/suspend")
    assert res.status_code == 400
