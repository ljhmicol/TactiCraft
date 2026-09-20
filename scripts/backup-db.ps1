# 로컬 SQLite DB 백업(개선 로드맵 §5.4). data\backups\에 타임스탬프 스냅샷을
# 남기고 오래된 것부터 최근 14개만 남긴다. 서버를 켠 채로 실행해도 안전하다
# (scripts\backup_db.py의 sqlite3 .backup() API 참조).

& "$PSScriptRoot\..\backend\.venv\Scripts\python.exe" "$PSScriptRoot\backup_db.py" @args
