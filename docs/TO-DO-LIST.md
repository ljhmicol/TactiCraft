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

- [O] **29. UI 리디자인 (Hallmark 감사 기반)** — 중 · 색·폰트 1차 완료, 내비게이션은 다음 단계

1~28번은 2026-09-01부터 순서대로 진행해 전부 완료(권장 순서 14 → 16 → 2/3/4/5/10 → 20·21·22 → 8 → 25/26/27 → 11·회원 탈퇴·28·3·10·7·9·12), `TO-DO-ARCHIVE.md`에 있다. 29번은 그 이후(2026-09-11) 사용자가 [Hallmark](https://www.usehallmark.com/)라는 외부 디자인 스킬을 어떻게 쓰면 좋을지 물으며 시작됐다.

## 항목 상세

### 29. UI 리디자인 (Hallmark 감사 기반)

- **내용**: "AI가 만든 티 나는 UI"를 잡아내는 Hallmark 스킬(`npx skills add nutlope/hallmark`, 프로젝트 로컬 `.agents/skills/`·`.claude/skills/`에 설치, `.gitignore`/`.dockerignore` 처리)로 TactiCore를 감사(audit)한 뒤, 지적된 항목을 실제로 고친 작업.
- **감사 결과(2026-09-10, 코드 인용 기반)**: critical 3(순백 배경 — `index.css`가 shadcn 기본값 그대로, 폰트 페어링 전무 — 앱 전체에 `font-family` 지정이 한 곳도 없음, AI 내비게이션 지문 — `App.tsx`의 워드마크 좌측+인라인 링크+CTA 우측 패턴) / major 2(`tabs.tsx`의 `transition-all`, 앱 전체에서 가장 큰 헤딩이 24px뿐인 타이포 위계 없음) / minor 1(프리셋·커뮤니티 카드 그리드 3곳이 같은 모양).
- **착수 전 확인**: 색·폰트(전역 적용, 리스크 낮음) 먼저 → 내비게이션(구조 변경, 리스크 큼)은 다음 단계로 순서를 제안해 승인받음. 톤은 AskUserQuestion으로 세 가지(테크니컬/에디토리얼/유틸리테리안) 프리뷰를 제시해 **테크니컬**(Bloomberg Terminal/Linear 데이터 화면 느낌) 선택받음.
- **문서화된 기존 결정과의 충돌 확인**: `2단계_시스템_설계서.md §12.4`에 "라이트 모드 단일, 강조색은 피치의 초록과 같은 계열로 묶는다"는 의도적 결정이 있었다 — 다크 전환이 이를 뒤집는다는 걸 짚고 넘어간 뒤, "악센트는 계속 초록 계열(터미널 그린) 유지"로 원래 취지를 살리는 절충안을 제시·진행. §12.4·§12.5(공유 카드) 문서를 새 값으로 갱신하고 예전 라이트 모드 표는 취소선으로 히스토리로 남겼다.
- **구현**:
  - **색**: `frontend/src/index.css`의 HSL 토큰을 다크로 전환(배경 `224 24% 7%`, 카드는 배경보다 살짝 밝게 — 그림자 대신 명도로 입체감, `--primary`는 emerald 계열 유지하되 어두운 배경에서 선명한 `152 69% 45%`). **`PITCH_COLORS`/`PLAYER_COLORS`/`SHARE_CARD_COLORS`(`lib/theme.ts`)는 전혀 안 건드림** — 이 상수들의 독스트링이 "색은 장식이 아니라 데이터, 즉흥적으로 안 바꾼다"고 명시하고 있고, 애초에 피치·선수·공유카드는 라이트/다크 전환과 무관하게 고정 색이라 손댈 이유도 없었다(공유 카드는 원래부터 다크였다 — 2026-09-11 문서 갱신에 "이번 전환이 앱을 오히려 그 카드 톤에 맞춘 셈"이라고 기록).
  - **폰트**: 처음엔 헤딩=IBM Plex Mono(라틴 전용)+한글은 IBM Plex Sans KR로 폴백하는 조합을 넣었는데, Playwright 스크린샷으로 실제 화면(`/new`의 "감독 스타일로 시작하기")을 보니 **스페이스(한글 단어 사이 띄어쓰기)가 Mono의 넓은 고정폭 그대로 남아 간격이 벌어져 보이는 버그**를 발견 — 한글까지 포함하는 진짜 monospace 폰트 **Nanum Gothic Coding**으로 교체해 해결(폴백 경계 자체가 없어짐). 본문은 IBM Plex Sans KR. `frontend/index.html`에 Google Fonts 링크 추가, `tailwind.config.js`에 `fontFamily.display`/`.sans`, `index.css` `@layer base`에 `h1,h2,h3 { @apply font-display }`(페이지마다 className 안 건드려도 전역 적용). 공유 카드 3종(`ShareCard`/`SharePngCard`/`AnimatedShareCard`)의 하드코딩된 `system-ui, sans-serif`도 새 페어링으로 교체(색은 유지).
  - **major 수정**: `components/ui/tabs.tsx`의 `transition-all` → `transition-colors`. 저장 목록·커뮤니티·프로필·로그인/회원가입·전술대결·공유 페이지 등 `text-lg`/`text-xl` h1 9곳을 `text-2xl`로 통일해 타이포 위계 부여.
  - **다음 단계로 미룬 것(1차 패스 시점)**: 내비게이션(App.tsx의 AI 내비 지문)과 카드 그리드 다양화(minor)는 색·폰트 패스에 포함 안 함 — 전역 톤이 먼저 자리 잡은 뒤에 구조를 다시 짜는 게 순서라고 판단.
- **검증(색·폰트)**: `tsc -b`/`npm run lint`(0 errors)/`vitest run`(174 tests, 회귀 없음)/`npm run build` 통과. Playwright로 `/new`·`/community`·`/login`·에디터(피치 포함) 스크린샷 확인 — 다크 배경·새 폰트 실제 적용 확인(computed style로 `body` 배경색·`h1` font-family 직접 조회), 피치는 여전히 고유 진한 초록으로 렌더링(다크 UI 위에서 오히려 더 도드라짐), 폰트 교체 후 한글 헤딩 간격 정상 확인, 콘솔 에러 없음.
- **내비게이션 재설계(2026-09-11 후속, "계속 진행해줘")**: `component-cookbook.md`의 나비 라우팅표에서 genre=modern-minimal(이 앱은 SaaS/dev-tool형 데이터 도구라 이 클러스터에 해당)의 기본값 **N1b(Canonical SaaS three-section)**를 채택. "terminal / CLI" 클러스터의 기본값인 N8(터미널 프롬프트 형태)도 사용자가 고른 "테크니컬" 톤과 표면적으로는 맞아 보였지만, N8 스펙 파일의 "Use when: CLI 도구·dev-tool 문서 페이지" 조건에 TactiCore(축구 전술 에디터)가 해당하지 않고, 스펙 자체가 "비개발자 사이트에 `>` 프롬프트를 쓰면 코스프레처럼 보인다"고 명시적으로 경고해 기각. N5(플로팅 필)도 검토했으나 knob 스펙의 "~720px 넘으면 N1로 전환" 경고에 걸릴 만큼 TactiCore 내비가 실제 항목이 많음(목적지 4개 + 로그인 상태 이메일/버튼들)을 확인해 기각.
  - **구조**: 워드마크 왼쪽 / 링크 4개(편집기·저장 목록·커뮤니티·전술 대결) 가운데 / 로그인 상태 오른쪽 — `grid-template-columns: 1fr auto 1fr` 3분할로 예전의 "모든 걸 한 덩어리로 오른쪽에 미는" 2분할 구조와 시각적으로 구분되게 했다.
  - **knob 선택**: 가운데 링크 4개·드롭다운 없음·CTA 쌍=로그인 텍스트+회원가입 채움 버튼(로그아웃 상태만, `Button asChild`)·**scroll state=always-solid**(N1b 원본 예시는 "히어로 위에서 투명하게 시작해 스크롤하면 프로스트"인데, 이건 마케팅 히어로 이미지용이고 TactiCore는 항상 조밀한 유틸리티 화면이라 always-solid를 N1b 문서가 제공하는 정식 knob 값으로 골랐다).
  - **추가 개선(원본 N1a에는 없던 것)**: `NavLink`로 활성 경로에 밑줄+본문색 표시 — 예전엔 지금 어느 화면인지 내비에 아무 표시가 없었다. 워드마크(TactiCore)에 `font-display`(Nanum Gothic Coding) 적용.
  - **검증**: `tsc -b`/`lint`(0 errors)/`vitest`(174, 회귀 없음)/`build` 통과. Playwright로 로그아웃/로그인 두 상태 스크린샷 확인, `/community`로 이동해 "커뮤니티" 링크만 밑줄로 활성 표시되는지 실제 DOM의 `textDecorationLine` 계산값으로 확인(4개 중 1개만 `underline`), 콘솔 에러 없음.
  - **남은 것**: 카드 그리드 다양화(minor, 프리셋 고르기·커뮤니티 목록 3곳이 같은 모양)는 여전히 급하지 않다고 판단해 보류.
- **미확인**: iOS Safari·Android Chrome 실기기에서 다크 배경 대비·Nanum Gothic Coding 렌더링·새 내비 레이아웃은 사람이 확인해야 한다(6단계 §10과 같은 범주) — 이번 검증은 headless Chromium(Playwright) 기준.

## 기각 기록

기각은 취소와 달리 "다시 논의할 때 사유부터 확인" 대상이다. 삭제하지 않는다.

| 항목 | 결정 | 날짜 | 사유 |
| --- | --- | --- | --- |
| 실제 경기 검색해 자동 분석 불러오기 | ❌ 기각 | 2026-09-01 | 무료 축구 API(football-data.org 10req/min, API-Football 100req/day)가 국면별 선수 좌표를 제공하지 않음. 유료 트래킹 데이터 업체만 가능. → 감독 스타일 프리셋으로 대체(커밋 7a0fb19). 부분 대안: 항목 9(StatsBomb) |
| Vercel 정적 배포 | ❌ 기각 | MVP 설계 시점 | DB 저장(FR-08)을 위해 FastAPI 백엔드 도입으로 무효. 배포 방식은 2차에서 결정(항목 10) |
