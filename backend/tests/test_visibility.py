"""공개 범위 3단계(비공개/링크 공개/커뮤니티 공개) 접근 제어(개선 로드맵
§5.3 필수 테스트 목록 4번). 2026-09-18에 실제 배포본에 curl로 수동
검증했던 행렬(TO-DO-LIST.md 62번 항목)을 자동화한 것 — 이 테스트가 그
당시 발견했던 실제 취약점(비공개 분석이 id 스캔으로 새던 문제)의 회귀를
막는다.
"""

from fastapi.testclient import TestClient

import main
from conftest import minimal_analysis_payload, register_user


def _owner_with_analysis() -> tuple[TestClient, int, str]:
    owner = TestClient(main.app)
    register_user(owner, email="owner@t.com", username="주인")
    res = owner.post("/api/analyses", json=minimal_analysis_payload())
    assert res.status_code == 201, res.text
    body = res.json()
    return owner, body["id"], body["share_token"]


def _other_and_anon() -> tuple[TestClient, TestClient]:
    other = TestClient(main.app)
    register_user(other, email="other@t.com", username="타인")
    anon = TestClient(main.app)
    return other, anon


# ---------------------------------------------------------------------------
# private
# ---------------------------------------------------------------------------


def test_private_visible_only_to_owner():
    owner, analysis_id, token = _owner_with_analysis()
    other, anon = _other_and_anon()

    assert owner.get(f"/api/analyses/{analysis_id}").status_code == 200
    assert other.get(f"/api/analyses/{analysis_id}").status_code == 404
    assert anon.get(f"/api/analyses/{analysis_id}").status_code == 404
    # 토큰을 들고 있어도 비공개면 막혀야 한다 — 토큰은 'link' 이상에서만 유효.
    assert other.get(f"/api/share/{token}").status_code == 404
    assert anon.get(f"/api/share/{token}").status_code == 404


def test_private_comments_and_likes_blocked_for_others():
    owner, analysis_id, _token = _owner_with_analysis()
    other, anon = _other_and_anon()

    assert owner.get(f"/api/analyses/{analysis_id}/comments").status_code == 200
    assert other.get(f"/api/analyses/{analysis_id}/comments").status_code == 404
    assert anon.get(f"/api/analyses/{analysis_id}/comments").status_code == 404
    assert other.post(f"/api/community/analyses/{analysis_id}/like").status_code == 404


# ---------------------------------------------------------------------------
# link
# ---------------------------------------------------------------------------


def test_link_visible_only_via_token():
    owner, analysis_id, token = _owner_with_analysis()
    other, anon = _other_and_anon()
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "link"})

    # id로는 소유자 말고 아무도 못 들어온다 — link 공개의 핵심.
    assert owner.get(f"/api/analyses/{analysis_id}").status_code == 200
    assert other.get(f"/api/analyses/{analysis_id}").status_code == 404
    assert anon.get(f"/api/analyses/{analysis_id}").status_code == 404

    # 토큰만 있으면 로그인 여부와 무관하게 들어온다.
    assert owner.get(f"/api/share/{token}").status_code == 200
    assert other.get(f"/api/share/{token}").status_code == 200
    assert anon.get(f"/api/share/{token}").status_code == 200


def test_link_comments_and_likes_allowed():
    owner, analysis_id, _token = _owner_with_analysis()
    other, _anon = _other_and_anon()
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "link"})

    assert other.get(f"/api/analyses/{analysis_id}/comments").status_code == 200
    assert other.post(f"/api/community/analyses/{analysis_id}/like").status_code == 200


def test_link_not_listed_in_community():
    owner, analysis_id, _token = _owner_with_analysis()
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "link"})

    ids = [row["id"] for row in owner.get("/api/community/analyses").json()]
    assert analysis_id not in ids


# ---------------------------------------------------------------------------
# community
# ---------------------------------------------------------------------------


def test_community_visible_to_anyone_via_id():
    owner, analysis_id, _token = _owner_with_analysis()
    other, anon = _other_and_anon()
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})

    assert owner.get(f"/api/analyses/{analysis_id}").status_code == 200
    assert other.get(f"/api/analyses/{analysis_id}").status_code == 200
    assert anon.get(f"/api/analyses/{analysis_id}").status_code == 200


def test_community_listed_and_comments_open():
    owner, analysis_id, _token = _owner_with_analysis()
    other, _anon = _other_and_anon()
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})

    ids = [row["id"] for row in owner.get("/api/community/analyses").json()]
    assert analysis_id in ids
    assert other.get(f"/api/analyses/{analysis_id}/comments").status_code == 200
    assert other.post(f"/api/community/analyses/{analysis_id}/like").status_code == 200


# ---------------------------------------------------------------------------
# 토큰이 다시 비공개로 내려가면 예전 링크가 계속 새면 안 된다
# ---------------------------------------------------------------------------


def test_downgrading_to_private_invalidates_old_link():
    owner, analysis_id, token = _owner_with_analysis()
    other, _anon = _other_and_anon()

    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "link"})
    assert other.get(f"/api/share/{token}").status_code == 200

    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "private"})
    assert other.get(f"/api/share/{token}").status_code == 404
