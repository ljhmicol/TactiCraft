"""신고 + 운영자 처리(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에
같이" 사용자 선택). conftest.py가 ADMIN_EMAILS=admin@t.com으로 고정해 둬서,
이 이메일로 가입한 계정만 운영자 전용 엔드포인트를 통과한다."""

from fastapi.testclient import TestClient

import main
from conftest import minimal_analysis_payload, register_user


def _admin_client() -> TestClient:
    client = TestClient(main.app)
    register_user(client, email="admin@t.com", username="운영자")
    return client


def _owner_with_community_analysis() -> tuple[TestClient, int]:
    owner = TestClient(main.app)
    register_user(owner, email="owner@t.com", username="주인")
    created = owner.post("/api/analyses", json=minimal_analysis_payload()).json()
    owner.patch(f"/api/analyses/{created['id']}/visibility", json={"visibility": "community"})
    return owner, created["id"]


def test_report_analysis_succeeds_and_is_idempotent_per_user():
    owner, analysis_id = _owner_with_community_analysis()
    reporter = TestClient(main.app)
    register_user(reporter, email="reporter@t.com", username="신고자")

    res = reporter.post(f"/api/analyses/{analysis_id}/report", json={"reason": "부적절한 내용"})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["target_type"] == "analysis"
    assert body["status"] == "open"

    # 같은 사람이 같은 대상을 또 신고하면 409 — 신고 폭탄 방지.
    res2 = reporter.post(f"/api/analyses/{analysis_id}/report", json={"reason": "또"})
    assert res2.status_code == 409


def test_cannot_report_private_analysis_as_non_owner():
    owner = TestClient(main.app)
    register_user(owner, email="private_owner@t.com", username="비공개주인")
    created = owner.post("/api/analyses", json=minimal_analysis_payload()).json()

    other = TestClient(main.app)
    register_user(other, email="other_reporter@t.com", username="타인신고")
    res = other.post(f"/api/analyses/{created['id']}/report", json={"reason": "x"})
    assert res.status_code == 404


def test_report_comment_succeeds():
    owner, analysis_id = _owner_with_community_analysis()
    commenter = TestClient(main.app)
    register_user(commenter, email="commenter@t.com", username="댓글러")
    comment = commenter.post(
        f"/api/analyses/{analysis_id}/comments", json={"body": "부적절한 댓글"}
    ).json()

    reporter = TestClient(main.app)
    register_user(reporter, email="comment_reporter@t.com", username="댓글신고자")
    res = reporter.post(f"/api/comments/{comment['id']}/report", json={})
    assert res.status_code == 201, res.text
    assert res.json()["target_type"] == "comment"


def test_non_admin_cannot_access_moderation_endpoints():
    owner, analysis_id = _owner_with_community_analysis()
    reporter = TestClient(main.app)
    register_user(reporter, email="plain_user@t.com", username="일반사용자")
    reporter.post(f"/api/analyses/{analysis_id}/report", json={"reason": "x"})

    assert reporter.get("/api/moderation/reports").status_code == 403
    assert reporter.post("/api/moderation/reports/1/resolve").status_code == 403


def test_admin_can_list_and_resolve_reports():
    owner, analysis_id = _owner_with_community_analysis()
    reporter = TestClient(main.app)
    register_user(reporter, email="reporter2@t.com", username="신고자2")
    report = reporter.post(
        f"/api/analyses/{analysis_id}/report", json={"reason": "스팸"}
    ).json()

    admin = _admin_client()
    open_reports = admin.get("/api/moderation/reports").json()
    assert any(r["id"] == report["id"] for r in open_reports)
    assert open_reports[0]["target_preview"]  # 경기 이름 미리보기가 채워짐

    res = admin.post(f"/api/moderation/reports/{report['id']}/resolve")
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"

    still_open = admin.get("/api/moderation/reports").json()
    assert not any(r["id"] == report["id"] for r in still_open)


def test_admin_can_hide_analysis_without_being_owner():
    owner, analysis_id = _owner_with_community_analysis()
    admin = _admin_client()

    res = admin.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "private"})
    assert res.status_code == 200
    assert res.json()["visibility"] == "private"


def test_admin_can_delete_comment_without_being_owner():
    owner, analysis_id = _owner_with_community_analysis()
    commenter = TestClient(main.app)
    register_user(commenter, email="commenter2@t.com", username="댓글러2")
    comment = commenter.post(
        f"/api/analyses/{analysis_id}/comments", json={"body": "지워질 댓글"}
    ).json()

    admin = _admin_client()
    res = admin.delete(f"/api/comments/{comment['id']}")
    assert res.status_code == 204


def test_admin_flag_reflected_in_me_endpoint():
    admin = _admin_client()
    assert admin.get("/api/auth/me").json()["is_admin"] is True

    plain = TestClient(main.app)
    register_user(plain, email="notadmin@t.com", username="비운영자")
    assert plain.get("/api/auth/me").json()["is_admin"] is False
