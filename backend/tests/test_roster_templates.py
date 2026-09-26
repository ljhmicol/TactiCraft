"""내 팀·선수단 템플릿(개선 로드맵 §7.2) CRUD + 소유권 검증."""

from fastapi.testclient import TestClient

import main
from conftest import register_user

PLAYERS = [
    {"name": "김선수", "number": 1, "role": "GK"},
    {"name": "이선수", "number": 2, "role": "RB", "tactical_role": "overlapping-fb"},
]


def test_requires_login():
    client = TestClient(main.app)
    res = client.get("/api/roster-templates")
    assert res.status_code == 401


def test_create_list_get():
    client = TestClient(main.app)
    register_user(client, email="a@t.com", username="에이팀")

    res = client.post("/api/roster-templates", json={"name": "우리팀", "players": PLAYERS})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "우리팀"
    assert len(body["players"]) == 2
    assert body["players"][1]["tactical_role"] == "overlapping-fb"
    template_id = body["id"]

    res = client.get("/api/roster-templates")
    assert res.status_code == 200
    summary = res.json()
    assert len(summary) == 1
    assert summary[0]["player_count"] == 2
    # 목록 요약에는 선수 배열 자체가 없다(TO-DO 7과 같은 이유).
    assert "players" not in summary[0]

    res = client.get(f"/api/roster-templates/{template_id}")
    assert res.status_code == 200
    assert res.json()["players"][0]["name"] == "김선수"


def test_update_and_delete():
    client = TestClient(main.app)
    register_user(client, email="b@t.com", username="비팀")
    created = client.post("/api/roster-templates", json={"name": "원래이름", "players": PLAYERS}).json()
    template_id = created["id"]

    res = client.put(
        f"/api/roster-templates/{template_id}",
        json={"name": "바뀐이름", "players": PLAYERS[:1]},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "바뀐이름"
    assert len(res.json()["players"]) == 1

    res = client.delete(f"/api/roster-templates/{template_id}")
    assert res.status_code == 204
    assert client.get(f"/api/roster-templates/{template_id}").status_code == 404


def test_cannot_access_others_template():
    owner = TestClient(main.app)
    register_user(owner, email="owner@t.com", username="주인")
    template_id = owner.post("/api/roster-templates", json={"name": "내꺼", "players": PLAYERS}).json()["id"]

    other = TestClient(main.app)
    register_user(other, email="other@t.com", username="남팀")
    assert other.get(f"/api/roster-templates/{template_id}").status_code == 404
    assert (
        other.put(f"/api/roster-templates/{template_id}", json={"name": "가로채기", "players": PLAYERS}).status_code
        == 403
    )
    assert other.delete(f"/api/roster-templates/{template_id}").status_code == 403

    # 다른 사람 목록에도 안 보인다.
    assert other.get("/api/roster-templates").json() == []
