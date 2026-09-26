"""방문자 분석(2026-09-26, "사람들이 사이트 얼마나 사용하는지" 요청).
conftest.py가 ADMIN_EMAILS=admin@t.com으로 고정해 둬서, 이 이메일로 가입한
계정만 /api/admin/analytics를 통과한다(test_moderation.py와 같은 패턴)."""

from fastapi.testclient import TestClient

import main
from conftest import register_user


def _admin_client() -> TestClient:
    client = TestClient(main.app)
    register_user(client, email="admin@t.com", username="운영자")
    return client


def test_pageview_sets_visitor_cookie_once():
    client = TestClient(main.app)
    res = client.post("/api/analytics/pageview", json={"path": "/"})
    assert res.status_code == 204
    assert "tacticore_visitor" in res.cookies

    # 같은 클라이언트(쿠키 유지)로 다시 방문해도 쿠키를 새로 발급하지 않는다.
    first_visitor = res.cookies["tacticore_visitor"]
    res2 = client.post("/api/analytics/pageview", json={"path": "/analyses"})
    assert res2.status_code == 204
    assert client.cookies["tacticore_visitor"] == first_visitor


def test_non_admin_cannot_read_analytics():
    client = TestClient(main.app)
    register_user(client, email="user@t.com", username="일반유저")
    res = client.get("/api/admin/analytics")
    assert res.status_code == 403


def test_admin_sees_recorded_pageviews():
    visitor_a = TestClient(main.app)
    visitor_a.post("/api/analytics/pageview", json={"path": "/"})
    visitor_a.post("/api/analytics/pageview", json={"path": "/analyses"})

    visitor_b = TestClient(main.app)
    visitor_b.post("/api/analytics/pageview", json={"path": "/"})

    admin = _admin_client()
    res = admin.get("/api/admin/analytics")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_views"] == 3
    assert body["unique_visitors"] == 2
    assert body["today_views"] == 3
    top_paths = {p["path"]: p["views"] for p in body["top_paths"]}
    assert top_paths["/"] == 2
    assert top_paths["/analyses"] == 1
    assert len(body["daily_views"]) == 1
    assert body["daily_views"][0]["views"] == 3
    assert body["daily_views"][0]["unique_visitors"] == 2


def test_logged_in_pageviews_show_username_but_anonymous_ones_dont():
    logged_in = TestClient(main.app)
    register_user(logged_in, email="viewer@t.com", username="열람자")
    logged_in.post("/api/analytics/pageview", json={"path": "/profile"})

    anonymous = TestClient(main.app)
    anonymous.post("/api/analytics/pageview", json={"path": "/"})

    admin = _admin_client()
    res = admin.get("/api/admin/analytics")
    assert res.status_code == 200, res.text
    recent = res.json()["recent_user_views"]
    assert len(recent) == 1
    assert recent[0]["username"] == "열람자"
    assert recent[0]["path"] == "/profile"
