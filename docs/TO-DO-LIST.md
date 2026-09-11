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

- [O] **29. UI 리디자인 (Hallmark 감사 기반)** — 중 · 색·폰트·내비게이션·카드 그리드 다양화·접근성·시작 화면 배경까지 전부 완료

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
- **카드 그리드 다양화(2026-09-11 후속, "카드 그리드도 다양하게 바꿔줘")**: minor 지적이었던 3곳 균일 카드 그리드를 콘텐츠 성격별로 다른 형태로 분리.
  - **`ManagerPresetPicker.tsx`**(감독 프리셋 10개, 텍스트 전용, 훑어보기용): 2열 테두리 카드 그리드 → `divide-y` hairline 구분선의 조밀한 리스트로 전환. 각 행 앞에 `tabular-nums`로 정렬한 2자리 번호(01~10) 배치, hover는 배경색 틴트(다른 두 곳은 테두리 강조).
  - **`MatchPresetPicker.tsx`**(실제 경기 프리셋 2개뿐, StatsBomb 실측 데이터 기반): 2열 그리드 → 세로 1열로 쌓은 큰 카드(패딩 확대, 제목 `text-lg`)로 전환. 카드 상단에 "실제 경기 데이터" 배지를 추가해 감독 프리셋(재구성)과 다른 데이터 출처임을 시각적으로도 구분.
  - **`CommunityPage.tsx`**(실제 썸네일 이미지가 있는 갤러리): 그리드 유지 — 이미지가 있는 콘텐츠라 그리드가 원래 맞는 형태였고, 위 두 곳이 그리드에서 벗어나면서 굳이 손대지 않아도 "3곳이 같은 모양"이라는 지적 자체가 해소됨.
  - **검증**: `tsc -b`/`npm run lint`(0 errors)/`vitest run`(174, 회귀 없음)/`npm run build` 통과. Playwright로 `/new`(감독 리스트+경기 카드 둘 다 보임)·`/community` 스크린샷 확인, 콘솔 에러는 로그아웃 상태의 기존 401(인증 체크, 이 변경과 무관) 하나뿐.
- **재감사(2026-09-11, "다음 진행해줘" → "재감사로 마무리 확인")**: `hallmark audit` 절차(`references/verbs/audit.md`)를 그대로 따라 anti-patterns.md 전체 목록으로 코드베이스를 재스캔. 기존 6개 지적은 전부 해소 확인(`transition-all`·`hover:scale-105`·이모지 아이콘·아이콘 라이브러리 혼용(lucide-react 단일 확인)·순수 블랙/화이트·임의 z-index·그라디언트 텍스트 없음). 원래 감사 범위 밖에서 새 발견 1건: **`:focus-visible` 링 누락** — raw `<button type="button">`(shadcn `Button` 컴포넌트를 안 쓴 곳) 다수가 hover 스타일만 있고 키보드 포커스 표시가 없었음. 스코프가 원래 29번(시각적 AI 티 제거)이 아니라 접근성이라 사용자에게 처리 방식을 물어 "지금 바로 수정"으로 진행.
  - **수정**: `App.tsx`·`AnalysisList.tsx`·`CommunityComments.tsx`·`CommentPanel.tsx`·`FormationPicker.tsx`·`LayerToggleChips.tsx`·`ManagerPresetPicker.tsx`·`MatchPresetPicker.tsx`·`PhaseTabs.tsx`·`TagInput.tsx`·`Timeline.tsx`·`AnalysesPage.tsx`·`SharePage.tsx`·`VersusPage.tsx` — raw button마다 `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`(새 색 추가 없이 기존 shadcn `--ring` 토큰 재사용). 타임라인 축 위의 작은 원형 클러스터 버튼은 `ring-offset-1`, 리스트 행(첫/끝 모서리가 둥근 hairline 리스트)은 잘림 방지를 위해 `ring-inset`으로 조정. shadcn `Button` 컴포넌트를 쓴 곳(`ToolPalette`/`UndoRedoButtons`/`PlayerForm`/`PlayerEditDialog`)은 베이스 컴포넌트에 이미 포커스 링이 있어 손대지 않음.
  - **검증**: 코드베이스 전체를 파싱하는 스크립트로 모든 raw `<button` 태그의 여는 태그 안에 `focus-visible`이 있는지 전수 확인(JSX 중괄호 깊이를 추적해 `onClick={() =>` 안의 `=>`를 태그 종료로 오인하지 않도록 함) — 0건 누락. `tsc -b`/`lint`(0 errors)/`vitest`(174, 회귀 없음)/`build` 통과. Playwright로 감독 리스트 행·실제 경기 카드에 `.focus()`를 걸어 `getComputedStyle().boxShadow`가 실제로 `--ring` 토큰 색(`rgb(36, 194, 120)`)의 링을 그리는지 확인, 스크린샷으로 카드 주변 초록 링 렌더링 육안 확인.
- **시작 화면 배경(2026-09-11 후속, "맨 처음 새분석시작 화면에서 페이지배경이 검은색에다가 흰색 줄로만 해서 축구 그라운드처럼 보이게하면 좋겠어")**: `/new`(`NewAnalysisPage.tsx`) 전용 장식 배경 — 정식 규격(105×68m) 축구장 비율 SVG를 `viewBox`로 그대로 써서 터치라인·골라인·하프라인·센터서클·센터스팟·양쪽 페널티 박스·골에어리어·페널티 스팟·페널티 아크를 그리고, 흰 선을 10% 불투명도로 눌러 본문 텍스트 대비를 해치지 않게 했다. `fixed inset-0 -z-10`로 스크롤해도 고정, `preserveAspectRatio="xMidYMid slice"`로 어떤 화면 비율에서도 항상 중앙(하프라인·센터서클)이 보이게 크롭. 애니메이션 없음(`motion.md`/이번 세션 전반의 모션 절제 원칙 유지).
  - **`lib/theme.ts`의 `PITCH_COLORS`는 건드리지 않음** — 그건 실제 전술 데이터를 그리는 진짜 피치(초록, 좌표 데이터)이고, 이건 시작 화면 한 곳에만 쓰는 순수 장식용 SVG라 완전히 별개로 `NewAnalysisPage.tsx` 로컬에 둠.
  - 검은색을 문자 그대로 `#000`으로 바꾸지 않고 기존 `bg-background`(다크 테마 도입 때 이미 골랐던 거의 검정에 가까운 `224 24% 7%`) 위에 흰 선만 얹음 — Hallmark anti-patterns.md가 순수 블랙(`#000000`)을 "flat하고 합성적으로 보인다"고 명시적으로 금지하는 항목이라, 이번 세션에서 이미 없앤 tell을 다시 들여오지 않기 위한 선택.
  - **검증**: `tsc -b`/`npm run lint`(0 errors)/`vitest run`(174, 회귀 없음)/`npm run build` 통과. Playwright로 1280px(데스크톱, 좌우 여백에 페널티 박스·센터서클 곡선이 뚜렷이 보임)·390px(모바일) 두 폭 스크린샷 확인, SVG의 `getBoundingClientRect`/`position: fixed`/`z-index: -10` 실제 적용 확인, 모바일에서도 하프라인이 옅게 보이는 걸 좁은 크롭 스크린샷으로 재확인. 콘솔 에러는 기존 401(인증 체크, 무관) 하나뿐.
- **`/`(첫 화면)까지 확장(2026-09-11 후속, "아예 첫번쨰 화면에서도 이렇게 나오면 좋겠어")**: `PitchFieldBackdrop`을 `NewAnalysisPage.tsx` 로컬 함수에서 `frontend/src/components/decor/PitchFieldBackdrop.tsx`로 뽑아 공유 컴포넌트로 만들고, `EditorPage.tsx`의 `!analysis` 빈 안내 화면(앱을 처음 열었을 때 `/`에서 가장 먼저 보이는 화면 — "아직 분석이 없습니다" + 새 분석 시작 버튼)에도 같은 배경을 적용했다. 실제 편집기(피치가 있는 화면, `analysis`가 있을 때)에는 적용하지 않음 — 거기는 진짜 초록 전술 피치가 이미 있어서 장식 배경을 더하면 두 피치가 겹쳐 보여 혼란스럽다.
  - **검증**: `tsc -b`/`lint`(0 errors)/`vitest`(174, 회귀 없음)/`build` 통과. Playwright로 `localStorage.clear()` 후 `/`를 새로고침해 진짜 빈 상태로 만들고 스크린샷 확인 — 센터서클·하프라인·양쪽 페널티 박스가 온전히 보이고 "아직 분석이 없습니다"·버튼들이 배경 위에서 잘 읽힘, 콘솔 에러는 기존 401(무관) 2건뿐.
- **미확인**: iOS Safari·Android Chrome 실기기에서 다크 배경 대비·Nanum Gothic Coding 렌더링·새 내비 레이아웃·리스트/카드 형태·포커스 링·`/new`·`/` 피치 배경은 사람이 확인해야 한다(6단계 §10과 같은 범주) — 이번 검증은 headless Chromium(Playwright) 기준.

## 기각 기록

기각은 취소와 달리 "다시 논의할 때 사유부터 확인" 대상이다. 삭제하지 않는다.

| 항목 | 결정 | 날짜 | 사유 |
| --- | --- | --- | --- |
| 실제 경기 검색해 자동 분석 불러오기 | ❌ 기각 | 2026-09-01 | 무료 축구 API(football-data.org 10req/min, API-Football 100req/day)가 국면별 선수 좌표를 제공하지 않음. 유료 트래킹 데이터 업체만 가능. → 감독 스타일 프리셋으로 대체(커밋 7a0fb19). 부분 대안: 항목 9(StatsBomb) |
| Vercel 정적 배포 | ❌ 기각 | MVP 설계 시점 | DB 저장(FR-08)을 위해 FastAPI 백엔드 도입으로 무효. 배포 방식은 2차에서 결정(항목 10) |
