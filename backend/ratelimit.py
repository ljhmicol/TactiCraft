"""IP 기준 요청 제한(개선 로드맵 §5.5). Redis 등 외부 저장소 없이 프로세스
메모리에 슬라이딩 윈도우를 둔다 — Fly.io 머신 1대·이 앱 규모에서 충분하고,
min_machines_running=0이라 어차피 재기동마다 초기화돼도 문제없다(도배 방지가
목적이지 영구 차단 목록이 아니다).

IP 기준(계정 기준이 아님)으로 통일한 이유 — 로그인 전(회원가입·로그인
자체)에는 계정이 아직 없어 IP밖에 쓸 수 없고, 댓글/좋아요처럼 로그인 후
호출되는 엔드포인트까지 계정 기준으로 나누면 의존성이 두 벌이 돼 복잡도만
늘어난다. 단일 IP에서의 도배를 막는 것만으로 이 앱 규모의 위협 모델(스팸
봇, 무차별 대입)에는 충분하다고 판단했다.
"""

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

_lock = Lock()
_hits: dict[str, list[float]] = defaultdict(list)


def _get_client_ip(request: Request) -> str:
    """Fly.io는 신뢰할 수 있는 프록시를 거치므로 Fly-Client-IP를 우선 쓴다.
    X-Forwarded-For의 맨 왼쪽 항목은 클라이언트가 직접 써서 보낼 수 있어
    (스푸핑 가능) 신뢰할 수 없다 — 오른쪽 끝(프록시가 실제로 덧붙인 항목)만
    신뢰한다."""
    fly_ip = request.headers.get("fly-client-ip")
    if fly_ip:
        return fly_ip
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def reset() -> None:
    """테스트 전용 — 모듈 전역 상태를 비운다. conftest.py의 autouse 픽스처가
    매 테스트 전에 호출해, TestClient가 모든 요청에 같은 호스트를 쓰는 탓에
    서로 다른 테스트끼리 제한 카운트가 섞이는 걸 막는다."""
    with _lock:
        _hits.clear()


def rate_limit(key_prefix: str, limit: int, window_seconds: float):
    """FastAPI Depends로 쓰는 팩토리. key_prefix + IP로 버킷을 나눈다."""

    def dependency(request: Request) -> None:
        ip = _get_client_ip(request)
        key = f"{key_prefix}:{ip}"
        now = time.monotonic()
        with _lock:
            hits = _hits[key]
            cutoff = now - window_seconds
            while hits and hits[0] < cutoff:
                hits.pop(0)
            if len(hits) >= limit:
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    "요청이 너무 잦습니다. 잠시 후 다시 시도하세요.",
                )
            hits.append(now)

    return dependency
