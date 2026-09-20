"""로컬 SQLite DB 백업(개선 로드맵 §5.4).

sqlite3.Connection.backup()을 쓴다 — 파일을 그냥 복사(Copy-Item)하면 서버가
쓰는 도중일 때 반쪽짜리 상태가 그대로 찍힐 수 있다(6단계 운영 매뉴얼 §3.2가
이미 이 문제를 알고 "서버 종료 후에만 복사"로 회피해 왔다). backup()은
SQLite 자체의 온라인 백업 API를 써서 서버가 켜져 있어도(쓰기 중이어도)
일관된 스냅샷을 만든다 — 그래서 이 스크립트는 서버를 내릴 필요가 없다.

보관 정책: 이 스크립트가 만드는 타임스탬프 백업은 data/backups/ 아래 쌓이고,
기본적으로 최근 N개(기본 14 — 매일 한 번 돌린다고 가정하면 2주치)만 남기고
오래된 것부터 지운다. Fly.io 배포본 백업은 별개 절차다(운영 매뉴얼 §3.7 참조
— 이 스크립트는 로컬 파일만 다룬다. flyctl로 원격 볼륨에 접속해 백업을
내려받는 건 인프라 접근이 필요해 세션이 사용자 대신 실행하지 않는다).
"""

import argparse
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = PROJECT_ROOT / "data" / "tacticore.db"
BACKUP_DIR = PROJECT_ROOT / "data" / "backups"
DEFAULT_KEEP = 14


def backup(keep: int = DEFAULT_KEEP) -> Path:
    if not DB_PATH.is_file():
        print(f"DB 파일이 없습니다: {DB_PATH}", file=sys.stderr)
        sys.exit(1)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest_path = BACKUP_DIR / f"tacticore_{timestamp}.db"

    src_conn = sqlite3.connect(DB_PATH)
    dest_conn = sqlite3.connect(dest_path)
    try:
        src_conn.backup(dest_conn)
    finally:
        dest_conn.close()
        src_conn.close()

    print(f"백업 완료: {dest_path} ({dest_path.stat().st_size:,} bytes)")

    existing = sorted(BACKUP_DIR.glob("tacticore_*.db"), key=lambda p: p.stat().st_mtime)
    stale = existing[:-keep] if keep > 0 else []
    for old in stale:
        old.unlink()
        print(f"보관 기한 초과로 삭제: {old.name}")

    return dest_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--keep", type=int, default=DEFAULT_KEEP, help=f"보관할 최근 백업 개수 (기본 {DEFAULT_KEEP})")
    args = parser.parse_args()
    backup(keep=args.keep)
