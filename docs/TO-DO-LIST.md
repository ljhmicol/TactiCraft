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

- [O] **72. 접근성 개선(개선 로드맵 §6.4)** — 중 · 1~5단계 전부 구현 완료, 사용자 확인 전.
- [O] **73. 감독 프리셋에 타임라인(체인징 포인트) 추가** — 중 · 10개 프리셋 전부 구현 완료, 사용자 확인 전.
- [O] **74. 전술 지표 설명(개선 로드맵 §7.5)** — 중 · 5채널·압박 라인·콤팩트니스·오버로드·병목 5개 지표 전부 구현 완료, 사용자 확인 전.

## 항목 상세

### 72. 접근성 개선(개선 로드맵 §6.4)

- **배경**: 개선 로드맵 §6("일상 사용성 개선") 중 마지막 항목. 6.1~6.3(69·71·68번)을 마친 뒤 "6.4 접근성부터"로 진행을 선택했다.
- **계획한 5단계**: ① 아이콘 버튼 라벨·range input aria-label ② prefers-reduced-motion(무한 반복 애니메이션만 정지, 정보 전달용 1회 재생은 유지) ③ 404 페이지 + 에러 바운더리 ④ 선수/상대 노드 키보드 이동(방향키 1유닛/Shift+방향키 5유닛) + aria-label + 스크린리더 공지 ⑤ 키보드 단축키 도움말 패널. 1~3번은 저위험이라 묶어 진행, 4번은 피치 상호작용을 직접 건드려 따로 검증.
- **1~3단계**(커밋 `c3bb3a1`): `Timeline.tsx`·`VersusPage.tsx` 아이콘/range input에 `aria-label` 추가. `StaticPlayerNode`·`SharePlayerNode`·`AnnotationLayer`·`MatchupOverloadLayer`에 `useReducedMotion()`으로 `repeat: Infinity`만 조건부 제거. `NotFoundPage.tsx`(404)·`ErrorBoundary.tsx`(클래스 컴포넌트, `App.tsx`에서 `<App/>` 감쌈) 신설.
- **4단계**(커밋 `7ce3182`): `PlayerNode`/`OpponentNode`에 `tabIndex`·`role="button"`·`aria-label`·`onKeyDown`(방향키 이동, PlayerNode는 Enter/Space로 기존 편집 다이얼로그도 염) 추가. `analysisStore`에 `announce()`/`a11yAnnouncement`, 화면 밖 `aria-live="polite"` 컴포넌트 `LiveRegion.tsx`(EditorPage에 마운트) 신설.
  - **구현 중 발견해 같이 고친 버그**: PNG/GIF 내보내기 카드 5개(`ShareCard`·`AnimatedShareCard`·`VersusShareCard`·`ThumbnailCard`·`SharePngCard`)가 화면 밖(-9999px)에서 실제 `PlayerNode`/`OpponentNode`를 그대로 재사용해 캡처하는데, 이번 키보드 지원이 그 숨겨진 복제 노드까지 Tab으로 딸려오게 만들었다(실측: Tab 스톱이 11개가 아니라 22개, 상대팀 있으면 44개까지). 카드 wrapper에 `aria-hidden` + `inert`(react-dom 18.3이 JSX prop으로는 렌더링하지 않아 콜백 ref로 DOM 프로퍼티 직접 대입)를 걸어 해결.
- **검증**: 프론트 `tsc -b`/`npm run lint`(0 errors, 기존 경고 3개 무관)/`npx vitest run`(215개 전부 통과)/`npm run build` 성공. **2026-09-22 실배포 브라우저 검증**: Tab 11번으로 화면의 선수만 정확히 순회하고(숨겨진 복제본 제외), 상대팀 추가 후에도 동일(11개만 focus 가능), 방향키가 `window.scrollY`를 바꾸지 않음(페이지 스크롤 안 됨), 화면 밖 라이브 리전에 "OOO, x .. y ..로 이동" 공지 텍스트가 정확히 채워짐, Enter로 선수 편집 다이얼로그 정상 오픈, Shift+방향키로 5유닛(큰 이동) 확인.
- **5단계**(키보드 단축키 도움말): `KeyboardShortcutsHelp.tsx` 신설 — Tab/방향키/Shift+방향키/Enter·Space/Ctrl+Z/Ctrl+Shift+Z/`?`/Esc 8개를 표로 보여주는 Dialog. `UndoRedoButtons` 옆에 "단축키" 버튼으로 열거나, 입력 필드가 아닌 곳에서 `?` 키로 여닫는다(`UndoRedoButtons`의 Ctrl+Z와 같은 이유로 INPUT/TEXTAREA/contentEditable에서는 가로채지 않음). advisor 리뷰로 발견해 고친 것: 버튼을 `DialogTrigger asChild`로 감싸지 않고 수동 `onClick`만 썼더니 `aria-haspopup`/`aria-expanded` 등이 전혀 안 실렸다 — `InfoDialogButton.tsx`와 같은 패턴으로 고쳤다.
  - **검증**: `tsc -b`/`npm run lint`(0 errors)/`npx vitest run`(215개 통과)/`npm run build` 성공. **2026-09-22 실배포 브라우저 검증**: 버튼 클릭으로 다이얼로그 정상 오픈. **advisor가 지적한 핵심 케이스** — 선수 노드(에데르손)에 실제로 포커스를 둔 채 `?` 키로 도움말을 열고 Esc로 닫으니 포커스가 정확히 그 선수 노드로 복귀했고, 곧이어 방향키를 누르니 이동·라이브 리전 공지("에데르손, x 50.0, y 93.0로 이동")가 그대로 이어졌다 — 방해 없이 원래 작업으로 복귀됨을 확인.
- **남은 일**: 없음(1~5단계 전부 구현·배포·실측 검증 완료). 사용자 본인 확인 대기 — 확인되면 `[C]`로 바꿔 `TO-DO-ARCHIVE.md`로 이동.

### 73. 감독 프리셋에 타임라인(체인징 포인트) 추가

- **배경**: "지금 있는 감독들 프리셋 모두 한번씩 확인하며 업데이트해줘. 타임라인에 그 감독들의 대표 전술이니까 그 감독들만의 시간대마다 바뀌는 전술이 하나씩 있을거잖아." — `ManagerPresetPicker.tsx`의 10개 프리셋 중 안첼로티·투헬 2개만 이미 `changingPoints`(타임라인)가 있었다(2026 월드컵 실제 경기 기준). 나머지 8개(과르디올라·아르테타·클롭·사비 알론소·루이스 엔리케·이정효 광주·이정효 수원·무리뉴)에도 각각 1개씩 추가해 10개 전부 통일했다.
- **사실 검증 원칙**: 실제로 검증 가능한 경기가 있으면 그 경기(날짜·스코어)를 그대로 썼다 — 사비 알론소(레버쿠젠 2-2 슈투트가르트, 2024-04-27, 안드리히 96분 동점골로 무패 46경기 연장), 루이스 엔리케(PSG 0-1 도르트문트, 2024-05-07 UCL 준결승 2차전, 합계 0-2 탈락), 이정효 광주(광주 2-1 수원 삼성, 2023-06-07 역전승) 3개는 서브에이전트를 병렬로 띄워 WebSearch로 교차 확인했다. 확인이 안 되거나(과르디올라·아르테타·클롭 — 서브에이전트가 최초 기억한 스코어가 실제로는 틀렸음을 검색으로 스스로 발견함) 애초에 가상 시나리오인 경우(이정효 수원 2026시즌·무리뉴 레알 마드리드 2026시즌)는 특정 경기를 지어내지 않고 "특정 경기 아님 — 반복 패턴"이라고 라벨에 명시해 사실처럼 보이지 않게 했다.
- **검증**: `npx vitest run src/lib/samples.test.ts`(analysisSchema로 10개 JSON 전부 재검증 통과) + 전체 `npx vitest run`(232개 통과). 코드 변경은 없고 `public/samples/managers/*.json` 8개 파일에 `changingPoints` 필드만 추가했다.
- **남은 일**: 없음. 사용자 본인 확인 대기 — 확인되면 `[C]`로 바꿔 `TO-DO-ARCHIVE.md`로 이동.

### 74. 전술 지표 설명(개선 로드맵 §7.5)

- **배경**: "전술 지표 설명이나 내팀 템플릿 리믹스는 뭐야?" 질문에 세 후보(내 팀 템플릿·커뮤니티 리믹스·전술 지표 설명)를 설명한 뒤 "뭐부터 할지 추천해줘"에 전술 지표 설명을 추천(이미 있는 `InfoDialogButton` 패턴을 재사용할 수 있어 범위가 가장 작음)했고 "진행해줘"로 착수.
- **구현**: `components/common/MetricInfoButtons.tsx` 신설 — 5채널·하프스페이스(`ChannelGridInfo`)·압박 라인(`PressingLineInfo`)·콤팩트니스(`CompactnessInfo`)·오버로드(`OverloadInfo`)·병목(`BottleneckInfo`) 5개 설명 컴포넌트. 에디터(`LayerToggleChips.tsx`)와 전술 대결(`VersusPage.tsx`)이 같은 계산 로직(`lib/overload.ts`·`lib/compactness.ts`·`lib/zones.ts`)을 쓰므로 설명 문구도 한 곳에서 공유해 드리프트를 막았다(기존 `AdvantageBadge`/`KeyZoneCallout`가 쓰던 `InfoDialogButton` 그대로 재사용). 각 설명은 계산 근거 + "실제 경기 결과나 승률을 보장하지 않는다"는 한계를 함께 명시한다(로드맵 원문 요구사항).
- **버튼-안-버튼 문제**: 토글 칩 자체가 `<button>`이라 그 안에 `InfoDialogButton`(역시 버튼)을 중첩할 수 없어, `<span className="flex items-center gap-1">` 형제 요소로 배치했다 — `KeyZoneCallout.tsx`가 이미 쓰던 것과 같은 패턴.
- **검증**: `tsc --noEmit`(0 errors)/`eslint`(0 errors)/`npx vitest run`(232개 통과). **실제 브라우저 시각 확인은 못 함** — 로컬 `npm run dev`(5173)를 Bash로 띄웠는데 claude-in-chrome이 그 포트에서 완전히 다른 프로젝트("My Asset Manager", 참고 프로젝트로 추정)를 띄운 화면을 봤다(기존 메모 `shell-sandbox-vs-real-browser-network.md`와 같은 증상 — 셸이 띄운 dev 서버와 브라우저 자동화 도구가 보는 네트워크가 분리됨). 재시도 대신 사용자에게 알리고 코드 정적 검증(tsc/eslint/vitest)만으로 배포했다 — **사용자가 직접 배포된 사이트에서 각 레이어 칩 옆 ⓘ 버튼을 눌러 다이얼로그가 정상적으로 뜨는지 확인 필요**.
- **남은 일**: 위 브라우저 실측 확인. 확인되면 `[C]`로 바꿔 `TO-DO-ARCHIVE.md`로 이동.

## 기각 기록

기각은 취소와 달리 "다시 논의할 때 사유부터 확인" 대상이다. 삭제하지 않는다.

| 항목 | 결정 | 날짜 | 사유 |
| --- | --- | --- | --- |
| 실제 경기 검색해 자동 분석 불러오기 | ❌ 기각 | 2026-09-01 | 무료 축구 API(football-data.org 10req/min, API-Football 100req/day)가 국면별 선수 좌표를 제공하지 않음. 유료 트래킹 데이터 업체만 가능. → 감독 스타일 프리셋으로 대체(커밋 7a0fb19). 부분 대안: 항목 9(StatsBomb) |
| Vercel 정적 배포 | ❌ 기각 | MVP 설계 시점 | DB 저장(FR-08)을 위해 FastAPI 백엔드 도입으로 무효. 배포 방식은 2차에서 결정(항목 10) |
| 전술 대결 무게중심(쏠림 지수) 표시(통계 기능 백로그 3번) | ❌ 기각(구현 후 제거) | 2026-09-16 | "3번부터 진행해줘"로 구현해 커밋(cfae471, `computeTiltIndex`/`TiltGauge.tsx`)까지 마쳤으나, 바로 다음 요청("4번 이어서 진행해줘. 그리고 무게중심은 지우자")으로 삭제 요청 — `git revert`로 되돌림(d5d80d1). 구체적 사유는 사용자가 밝히지 않았다. 백로그 4번(팀 폭/깊이 비교)을 진행하면서 재도입 여부는 다시 묻지 않는다 — 사용자가 먼저 꺼내지 않는 한 "삭제됐다"는 사실만 기억해 둔다 |
