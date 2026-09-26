"""커뮤니티 리믹스(개선 로드맵 §7.3, "공개 전술을 내 분석으로 복제하되
원작자·원본 링크·복제 시점·복제 허용 여부를 보존한다")."""

from fastapi.testclient import TestClient

import main
from conftest import minimal_analysis_payload, register_user


def _create_as(email: str, username: str, **overrides) -> tuple[TestClient, int]:
    client = TestClient(main.app)
    register_user(client, email=email, username=username)
    res = client.post("/api/analyses", json=minimal_analysis_payload(**overrides))
    assert res.status_code == 201, res.text
    return client, res.json()["id"]


def test_cannot_remix_own_analysis():
    owner, analysis_id = _create_as("owner@t.com", "원작자")
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})
    res = owner.post(f"/api/analyses/{analysis_id}/remix")
    assert res.status_code == 400


def test_cannot_remix_private_analysis():
    _owner, analysis_id = _create_as("owner2@t.com", "원작자2")
    # 기본값은 private — 아무도 공개하지 않았다.
    other = TestClient(main.app)
    register_user(other, email="other2@t.com", username="다른사람2")
    res = other.post(f"/api/analyses/{analysis_id}/remix")
    assert res.status_code == 404


def test_cannot_remix_when_owner_disabled_it():
    owner, analysis_id = _create_as("owner3@t.com", "원작자3")
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})
    res = owner.patch(f"/api/analyses/{analysis_id}/remix-settings", json={"allow_remix": False})
    assert res.status_code == 200

    other = TestClient(main.app)
    register_user(other, email="other3@t.com", username="다른사람3")
    res = other.post(f"/api/analyses/{analysis_id}/remix")
    assert res.status_code == 403


def test_only_owner_can_change_remix_settings():
    owner, analysis_id = _create_as("owner4@t.com", "원작자4")
    other = TestClient(main.app)
    register_user(other, email="other4@t.com", username="다른사람4")
    res = other.patch(f"/api/analyses/{analysis_id}/remix-settings", json={"allow_remix": False})
    assert res.status_code == 403


def test_successful_remix_preserves_provenance_and_copies_data():
    owner, analysis_id = _create_as(
        "owner5@t.com",
        "원작자5",
        match={
            "match_name": "원본 전술",
            "home_team": "A",
            "away_team": "B",
            "match_date": "2026-09-18",
            "analyzed_team": "home",
        },
        summary="원본 요약",
    )
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})

    remixer = TestClient(main.app)
    register_user(remixer, email="remixer5@t.com", username="리믹서5")
    res = remixer.post(f"/api/analyses/{analysis_id}/remix")
    assert res.status_code == 201, res.text
    body = res.json()

    assert body["id"] != analysis_id
    assert body["is_owner"] is True
    assert body["visibility"] == "private"  # 리믹스 직후는 항상 비공개로 시작
    assert body["match"]["match_name"] == "원본 전술 (리믹스)"
    assert body["summary"] == "원본 요약"
    assert body["remixed_from_id"] == analysis_id
    assert body["remixed_from_author"] == "원작자5"
    assert body["remixed_at"] is not None
    assert len(body["players"]) == 11
    assert len(body["phases"]["base"]["positions"]) == 11

    # 리믹스는 원본과 독립된 새 행이다 — 원본을 고쳐도 사본엔 영향이 없다
    # (외래키 없이 값만 복사했다는 설계를 확인하는 회귀 테스트).
    owner.put(f"/api/analyses/{analysis_id}", json=minimal_analysis_payload(summary="바뀐 요약"))
    reread = remixer.get(f"/api/analyses/{body['id']}")
    assert reread.json()["summary"] == "원본 요약"


def test_remixed_from_id_becomes_null_when_source_deleted():
    owner, analysis_id = _create_as("owner6@t.com", "원작자6")
    owner.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})

    remixer = TestClient(main.app)
    register_user(remixer, email="remixer6@t.com", username="리믹서6")
    remix_id = remixer.post(f"/api/analyses/{analysis_id}/remix").json()["id"]

    owner.delete(f"/api/analyses/{analysis_id}")

    body = remixer.get(f"/api/analyses/{remix_id}").json()
    assert body["remixed_from_id"] is None
    # 스냅샷 메타데이터(작성자·시각)는 원본 삭제와 무관하게 남는다.
    assert body["remixed_from_author"] == "원작자6"
