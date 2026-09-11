# TO-DO-LIST

2차(POST-MVP) 기능 작업 목록. 사용자가 확정한 체크박스 방식으로 관리한다(2026-09-01, 이전 `기능_백로그.md` 개편).

## 범례

| 표기 | 의미 |
| --- | --- |
| `[ ]` | 미진행 |
| `[/]` | 진행중 |
| `[O]` | 적용완료 — 구현됐지만 사용자 확인 전 |
| `[C]` | 사용자 확인완료 |
| `[S]` | 보류 |

**진행 흐름**: `[ ]` → `[/]` → `[O]` → (사용자가 브라우저에서 확인) → `[C]` → **`TO-DO-ARCHIVE.md`로 이동**

- `[S]`는 사유와 함께 이 목록에 남긴다.
- 기각(취소)은 체크박스가 아니라 아래 [기각 기록](#기각-기록) 표로 관리한다 — 사유까지 남겨 같은 논의가 반복되는 걸 막는다.

## 체크리스트

- [O] **30. 모바일 실기기 버그 수정** — 중 · LAN 접속 설정 + 타임라인 무한 렌더 루프 + 내비·국면탭 등 글자 줄바꿈 버그, 구현 완료·실기기 재확인 전

1~29번은 전부 완료해 `TO-DO-ARCHIVE.md`에 있다(권장 순서 14 → 16 → 2/3/4/5/10 → 20·21·22 → 8 → 25/26/27 → 11·회원 탈퇴·28·3·10·7·9·12·29). 30번은 사용자가 iOS Safari/Android Chrome 실기기로 확인하다가 발견됐다.

## 항목 상세

### 30. 모바일 실기기 버그 수정

- **내용**: 사용자가 iOS Safari/Android Chrome 실기기로 앱을 확인하고 싶어해, 먼저 로컬 개발 서버(Vite 5173 + uvicorn 8000, 둘 다 원래 `localhost` 전용 바인딩)를 같은 Wi-Fi의 폰에서 접속 가능하게 설정한 뒤, 실기기에서 확인한 사용자가 "글자크기들도 안 맞아서 튀어나오고 전술판이 안 보여"라고 리포트한 걸 조사·수정했다.
- **LAN 접속 설정**: PC의 로컬 IP(`ipconfig`, 예 `192.168.45.213`) 기준으로 (1) 백엔드 `uvicorn main:app --reload --port 8000 --host 0.0.0.0`, (2) 프론트 `vite --host 0.0.0.0`로 재기동, (3) `backend/.env`의 `CORS_ORIGINS`에 `http://<PC-IP>:5173` 추가, (4) `frontend/.env.local`(git 무시 대상, 커밋 안 됨)에 `VITE_API_BASE_URL=http://<PC-IP>:8000/api` 추가 — `VITE_API_BASE_URL`이 `localhost`로 고정돼 있으면 폰 브라우저 기준 "localhost"가 PC가 아니라 폰 자신을 가리켜 API가 전부 실패한다.
- **원인 조사**: 실기기 리포트를 그대로 재현하려고 Playwright로 390×844(iPhone 크기) 뷰포트에서 감독 프리셋 선택 → 에디터 진입을 재현, 콘솔 에러와 스크린샷을 같이 확인.
  - **버그 1(핵심) — `Timeline.tsx`의 무한 렌더 루프**: `useAnalysisStore((s) => s.analysis?.changingPoints ?? [])`처럼 Zustand 셀렉터 안에 인라인으로 `?? []`를 쓰면, `changingPoints`가 없는 분석(프리셋 대부분이 여기 해당 — 스키마상 `changingPoints`는 optional이고 감독 프리셋 JSON엔 아예 필드가 없음)에서 **렌더마다 새 배열 레퍼런스**가 생긴다. 이 값이 그대로 `useEffect(..., [changingPoints])`의 의존성으로 들어가 있어서, 매 렌더 이 effect가 재실행 → `setMergeSelected` 호출 → 재렌더 → 다시 새 배열 → 무한 루프. 콘솔에 "Maximum update depth exceeded" 경고로 확인됨. PC의 빠른 CPU(헤드리스 Chromium)에서는 경고만 뜨고 눈에 띄게 느려지지 않아 이번에야 발견됐지만, 폰의 느린 CPU에서는 이게 실제로 화면이 버벅이거나 멈춘 것처럼 보였을 가능성이 크다 — "전술판이 안 보여" 리포트의 유력한 원인.
    - **수정**: 모듈 스코프에 안정적인 참조를 갖는 `EMPTY_CHANGING_POINTS: ChangingPoint[] = []` 상수를 만들어 셀렉터의 `?? []`를 `?? EMPTY_CHANGING_POINTS`로 교체 — 데이터가 실제로 안 바뀌면 항상 같은 레퍼런스를 반환해 effect가 불필요하게 재실행되지 않는다.
  - **버그 2 — 내비게이션 바가 좁은 화면에서 글자 단위로 줄바꿈**: `App.tsx`의 3분할 그리드 내비(워드마크/링크4개/로그인상태)를 모든 화면 너비에 한 줄로 강제했더니, 390px 폭에서 "편집기"가 "편\n집\n기"처럼 한 글자씩 줄바꿈됐다(한글은 띄어쓰기 없이도 음절 단위로 줄바꿈될 수 있어, 컨테이너가 좁아지면 영어 word-wrap보다 더 쉽게 이 문제가 난다 — Hallmark anti-patterns.md gate 49 "두 줄로 잘리는 클릭 텍스트" 위반). 같은 스크린샷에서 `PhaseTabs.tsx`의 "기본/공격/수비" 탭도 "기\n본"처럼 동일하게 깨져 있어 추가로 발견·수정.
    - **수정**: `md` 미만에서는 [워드마크 …… 로그인상태]를 1행, 링크 4개를 가로 스크롤 가능한 2행으로 바꾸고(LayerToggleChips가 이미 쓰는 "좁으면 가로 스크롤" 패턴과 동일), `md` 이상에서는 원래 3분할 그리드 한 줄로 되돌아간다. `PhaseTabs.tsx`는 `flex-wrap`으로 두 버튼 그룹이 안 맞으면 줄바꿈되게 하고, 각 버튼엔 `shrink-0 whitespace-nowrap`을 줬다.
  - **전면 재점검**: 같은 원인(raw `<button>`이 `flex`/`justify-between` 행 안에서 `flex-shrink` 기본값 때문에 눌려 텍스트가 깨지는 것)이 다른 곳에도 있을지 코드베이스 전체를 스캔하는 스크립트로 모든 raw `<button>`의 여는 태그에 `whitespace-nowrap`이 있는지 확인 — `App.tsx`(AuthNav 로그아웃/탈퇴/로그인, 이메일 링크는 `truncate`로 별도 처리)·`AnalysisList.tsx`(삭제)·`CommentPanel.tsx`(역할 제안 칩)·`FormationPicker.tsx`(포메이션 카드)·`LayerToggleChips.tsx`·`Timeline.tsx`(자동재생·병합·구간확대·+시점·병합하기·취소·클러스터 점·시간미정 칩, 아이콘 전용 버튼 3개는 텍스트가 없어 제외)·`AnalysesPage.tsx`(태그·정렬 칩)·`SharePage.tsx`(국면탭·시점칩·레이어칩)·`VersusPage.tsx`(레이어칩)에 추가. `ManagerPresetPicker`/`MatchPresetPicker`의 카드 본문(의도적으로 여러 줄 wrap)과 아이콘 전용 버튼(텍스트 없음)은 제외 — 스캔 스크립트로 최종 0건(제외 대상 제외) 확인.
- **검증(1차)**: `tsc -b`/`npm run lint`(0 errors)/`vitest run`(174, 회귀 없음)/`npm run build` 통과. Playwright로 390×844(iPhone 크기) 뷰포트에서 (1) 감독 프리셋(과르디올라, `changingPoints` 없음) 선택 → 콘솔에 "Maximum update depth exceeded" 더 이상 없음(401 두 건만, 무관) 확인, (2) 내비·국면탭이 전부 한 줄로 제대로 렌더링되는 스크린샷 확인, (3) 시점 6개짜리 디마리아 프리셋으로 타임라인 헤더 버튼(자동재생·병합·전체보기·+시점)이 동시에 여러 개 떠도 전부 안 깨지는 것 확인, (4) 피치 자체는 실제 선수 배치로 정상 렌더링되는 것 확인(714~774px 정도 스크롤 필요 — 위치 자체는 이번에 안 건드림).
- **1차 수정 후에도 재현("그래도 전술판이 안 보여")**: 사용자에게 화면 상태를 물어보니 프리셋을 고른 뒤 편집 화면에서 툴바·국면탭·타임라인·도구 버튼까지는 다 보이는데 그 아래로 스크롤해도 "아무것도 없고 페이지가 끝남" — 피치 영역이 완전히 사라져 있었다.
  - **버그 3 — 모바일 실기기 전용 `vh` 오계산**: 헤드리스 Chromium으로 재현이 안 돼서, 혹시 WebKit 엔진 자체의 차이인가 싶어 Playwright의 **진짜 WebKit 엔진**(Safari와 같은 렌더링 엔진, `npx playwright install webkit`으로 설치)으로도 같은 시나리오를 재현했는데 거기서도 피치가 정상 렌더링됐다(355×548px, 에러 없음) — Chromium·WebKit 두 엔진 다 정상이라는 건 코드 버그가 아니라 **두 엔진 다 데스크톱 빌드라 재현 못하는 모바일 전용 문제**라는 뜻이었다. 피치 컨테이너(`EditorPage.tsx`의 `h-[65vh]`, `SharePage.tsx`/`VersusPage.tsx`도 동일 패턴)가 쓰는 `vh` 단위는 iOS Safari·Android Chrome의 동적 주소창(스크롤에 따라 나타났다 사라지는) 때문에 실기기에서만 계산이 꼬이는 걸로 잘 알려진 문제 — 데스크톱 브라우저와 데스크톱용 WebKit 빌드에는애초에 그런 주소창이 없어 재현 자체가 불가능하다.
  - **수정**: `height: 65vh`는 그대로 두고(구형 브라우저 폴백), `dvh`(Dynamic Viewport Height — 이 정확한 문제를 해결하려고 CSS에 추가된 단위)를 지원하는 브라우저에서만 `@supports`로 덮어쓰게 했다 — Tailwind의 `supports-[height:100dvh]:h-[65dvh]` 임의 variant로 `@supports (height:100dvh) { .supports-\[height\:100dvh\]\:h-\[65dvh\] { height:65dvh } }`가 실제로 컴파일되는 것까지 확인. 같은 패턴을 `EditorPage.tsx`의 피치(`65vh`→`65dvh`)·선수 목록 스크롤 박스(`max-h-[70vh]`→`70dvh`), `SharePage.tsx`의 공유 피치(`65vh`→`65dvh`), `VersusPage.tsx`의 대결 뷰(`82vh`→`82dvh`) 전부에 적용.
  - **검증**: `tsc -b`/`lint`(0 errors)/`vitest`(174, 회귀 없음)/`build` 통과. 빌드 산출물 CSS에 `@supports (height:100dvh)` 규칙이 실제로 포함된 것을 grep으로 확인. Playwright WebKit으로 `CSS.supports('height', '100dvh')`가 `true`인 환경에서 `editor-pitch`의 계산된 높이가 정상 범위(548px)로 나오는 것 확인 — 다만 헤드리스 환경엔 주소창이 없어 `vh`와 `dvh`가 이 테스트에서는 같은 값으로 나온다는 한계가 있다(그래서 이 버그 자체가 자동화 테스트로는 재현이 원천적으로 안 됐던 것과 같은 이유).
- **미확인**: 이번 `dvh` 수정이 실제 iOS Safari/Android Chrome 기기에서 피치를 보이게 하는지는 사용자가 재확인해야 한다 — 애초에 이 버그 자체가 자동화 도구로는 재현·검증이 구조적으로 불가능한 종류라, 실기기 확인이 유일한 최종 검증 수단이다.

## 기각 기록

기각은 취소와 달리 "다시 논의할 때 사유부터 확인" 대상이다. 삭제하지 않는다.

| 항목 | 결정 | 날짜 | 사유 |
| --- | --- | --- | --- |
| 실제 경기 검색해 자동 분석 불러오기 | ❌ 기각 | 2026-09-01 | 무료 축구 API(football-data.org 10req/min, API-Football 100req/day)가 국면별 선수 좌표를 제공하지 않음. 유료 트래킹 데이터 업체만 가능. → 감독 스타일 프리셋으로 대체(커밋 7a0fb19). 부분 대안: 항목 9(StatsBomb) |
| Vercel 정적 배포 | ❌ 기각 | MVP 설계 시점 | DB 저장(FR-08)을 위해 FastAPI 백엔드 도입으로 무효. 배포 방식은 2차에서 결정(항목 10) |
