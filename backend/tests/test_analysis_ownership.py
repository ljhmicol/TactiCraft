"""회원 A가 회원 B의 분석을 조회·수정·삭제할 수 없는지(개선 로드맵 §5.3
필수 테스트 목록 2번). GET(id 기반)의 소유자 판정은 test_visibility.py가
공개 범위별로 더 자세히 다루므로, 여기서는 수정·삭제 소유권만 집중한다.

TestClient는 인스턴스마다 쿠키를 따로 들고 다닌다 — "회원 A"와 "회원 B"를
같은 브라우저가 아니라 서로 다른 사용자로 흉내 내려면 client 픽스처 하나를
공유하지 않고 각자 새 TestClient(main.app)를 만들어야 한다.
"""

from fastapi.testclient import TestClient

import main
from conftest import minimal_analysis_payload, register_user


def _create_as(email: str, username: str) -> tuple[TestClient, int]:
    owner = TestClient(main.app)
    register_user(owner, email=email, username=username)
    res = owner.post("/api/analyses", json=minimal_analysis_payload())
    assert res.status_code == 201, res.text
    return owner, res.json()["id"]


def test_owner_can_update_own_analysis():
    owner, analysis_id = _create_as("owner@t.com", "주인")
    res = owner.put(f"/api/analyses/{analysis_id}", json=minimal_analysis_payload(summary="수정됨"))
    assert res.status_code == 200
    assert res.json()["summary"] == "수정됨"


def test_owner_can_delete_own_analysis():
    owner, analysis_id = _create_as("owner2@t.com", "주인2")
    res = owner.delete(f"/api/analyses/{analysis_id}")
    assert res.status_code == 204


def test_other_user_cannot_update_analysis():
    _owner, analysis_id = _create_as("owner3@t.com", "주인3")

    other = TestClient(main.app)
    register_user(other, email="other3@t.com", username="타인3")
    res = other.put(f"/api/analyses/{analysis_id}", json=minimal_analysis_payload(summary="가로채기 시도"))
    assert res.status_code == 403


def test_other_user_cannot_delete_analysis():
    owner, analysis_id = _create_as("owner4@t.com", "주인4")

    other = TestClient(main.app)
    register_user(other, email="other4@t.com", username="타인4")
    res = other.delete(f"/api/analyses/{analysis_id}")
    assert res.status_code == 403

    # 실제로 안 지워졌는지 소유자 시점에서 재확인
    assert owner.get(f"/api/analyses/{analysis_id}").status_code == 200


def test_other_user_cannot_change_visibility():
    _owner, analysis_id = _create_as("owner5@t.com", "주인5")

    other = TestClient(main.app)
    register_user(other, email="other5@t.com", username="타인5")
    res = other.patch(f"/api/analyses/{analysis_id}/visibility", json={"visibility": "community"})
    assert res.status_code == 403


def test_anonymous_list_requires_login():
    anon = TestClient(main.app)
    res = anon.get("/api/analyses")
    assert res.status_code == 401
