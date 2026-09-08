# syntax=docker/dockerfile:1
#
# TactiCore 배포 이미지 — 단일 이미지(TO-DO 10번, 2026-09-09 "단일 이미지로
# 가자" 확정).
#
# 1단계(node)에서 프론트를 빌드하고 산출물(dist/)만 2단계(python)로 복사한다.
# FastAPI가 /api/*는 API로, 그 외 경로는 정적 파일 또는 index.html(SPA
# 폴백)로 서빙한다(main.py 하단) — 프론트·백엔드가 같은 오리진이 되어 CORS도
# 필요 없어진다.
#
# 참고 프로젝트(my-asset-manager)와 달리 소스를 볼륨 마운트하지 않고
# 이미지에 굽는다. 이미지 하나만으로 어디서든 실행되어야 배포에 쓸 수 있다.
# SSH 서버도 넣지 않는다.

FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# package*.json만 먼저 복사해 npm ci 레이어를 캐싱한다(소스만 바뀌면 재설치 생략).
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

# 빌드된 정적 파일이 백엔드와 같은 오리진에서 서빙되므로 API 베이스를
# 상대 경로로 굽는다(로컬 개발 .env의 절대 URL과 다름 — 배포 전용 값).
ENV VITE_API_BASE_URL=/api
RUN npm run build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# DB는 /app/data 에 생성된다 (config.py의 기본값 = 프로젝트 루트/data).
# compose가 호스트의 ./data 를 여기에 마운트하므로 컨테이너를 지워도 남는다.
VOLUME ["/app/data"]

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
