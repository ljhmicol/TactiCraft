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

- [O] **72. 접근성 개선(개선 로드맵 §6.4)** — 중 · 1~4단계 구현 완료, 사용자 확인 전. 5단계(키보드 단축키 도움말)는 미착수.

## 항목 상세

### 72. 접근성 개선(개선 로드맵 §6.4)

- **배경**: 개선 로드맵 §6("일상 사용성 개선") 중 마지막 항목. 6.1~6.3(69·71·68번)을 마친 뒤 "6.4 접근성부터"로 진행을 선택했다.
- **계획한 5단계**: ① 아이콘 버튼 라벨·range input aria-label ② prefers-reduced-motion(무한 반복 애니메이션만 정지, 정보 전달용 1회 재생은 유지) ③ 404 페이지 + 에러 바운더리 ④ 선수/상대 노드 키보드 이동(방향키 1유닛/Shift+방향키 5유닛) + aria-label + 스크린리더 공지 ⑤ 키보드 단축키 도움말 패널. 1~3번은 저위험이라 묶어 진행, 4번은 피치 상호작용을 직접 건드려 따로 검증.
- **1~3단계**(커밋 `c3bb3a1`): `Timeline.tsx`·`VersusPage.tsx` 아이콘/range input에 `aria-label` 추가. `StaticPlayerNode`·`SharePlayerNode`·`AnnotationLayer`·`MatchupOverloadLayer`에 `useReducedMotion()`으로 `repeat: Infinity`만 조건부 제거. `NotFoundPage.tsx`(404)·`ErrorBoundary.tsx`(클래스 컴포넌트, `App.tsx`에서 `<App/>` 감쌈) 신설.
- **4단계**(커밋 `7ce3182`): `PlayerNode`/`OpponentNode`에 `tabIndex`·`role="button"`·`aria-label`·`onKeyDown`(방향키 이동, PlayerNode는 Enter/Space로 기존 편집 다이얼로그도 염) 추가. `analysisStore`에 `announce()`/`a11yAnnouncement`, 화면 밖 `aria-live="polite"` 컴포넌트 `LiveRegion.tsx`(EditorPage에 마운트) 신설.
  - **구현 중 발견해 같이 고친 버그**: PNG/GIF 내보내기 카드 5개(`ShareCard`·`AnimatedShareCard`·`VersusShareCard`·`ThumbnailCard`·`SharePngCard`)가 화면 밖(-9999px)에서 실제 `PlayerNode`/`OpponentNode`를 그대로 재사용해 캡처하는데, 이번 키보드 지원이 그 숨겨진 복제 노드까지 Tab으로 딸려오게 만들었다(실측: Tab 스톱이 11개가 아니라 22개, 상대팀 있으면 44개까지). 카드 wrapper에 `aria-hidden` + `inert`(react-dom 18.3이 JSX prop으로는 렌더링하지 않아 콜백 ref로 DOM 프로퍼티 직접 대입)를 걸어 해결.
- **검증**: 프론트 `tsc -b`/`npm run lint`(0 errors, 기존 경고 3개 무관)/`npx vitest run`(215개 전부 통과)/`npm run build` 성공. **2026-09-22 실배포 브라우저 검증**: Tab 11번으로 화면의 선수만 정확히 순회하고(숨겨진 복제본 제외), 상대팀 추가 후에도 동일(11개만 focus 가능), 방향키가 `window.scrollY`를 바꾸지 않음(페이지 스크롤 안 됨), 화면 밖 라이브 리전에 "OOO, x .. y ..로 이동" 공지 텍스트가 정확히 채워짐, Enter로 선수 편집 다이얼로그 정상 오픈, Shift+방향키로 5유닛(큰 이동) 확인.
- **남은 일**: 5단계(키보드 단축키 도움말) 미착수. 4단계까지 사용자 본인 확인 대기.



## 기각 기록

기각은 취소와 달리 "다시 논의할 때 사유부터 확인" 대상이다. 삭제하지 않는다.

| 항목 | 결정 | 날짜 | 사유 |
| --- | --- | --- | --- |
| 실제 경기 검색해 자동 분석 불러오기 | ❌ 기각 | 2026-09-01 | 무료 축구 API(football-data.org 10req/min, API-Football 100req/day)가 국면별 선수 좌표를 제공하지 않음. 유료 트래킹 데이터 업체만 가능. → 감독 스타일 프리셋으로 대체(커밋 7a0fb19). 부분 대안: 항목 9(StatsBomb) |
| Vercel 정적 배포 | ❌ 기각 | MVP 설계 시점 | DB 저장(FR-08)을 위해 FastAPI 백엔드 도입으로 무효. 배포 방식은 2차에서 결정(항목 10) |
| 전술 대결 무게중심(쏠림 지수) 표시(통계 기능 백로그 3번) | ❌ 기각(구현 후 제거) | 2026-09-16 | "3번부터 진행해줘"로 구현해 커밋(cfae471, `computeTiltIndex`/`TiltGauge.tsx`)까지 마쳤으나, 바로 다음 요청("4번 이어서 진행해줘. 그리고 무게중심은 지우자")으로 삭제 요청 — `git revert`로 되돌림(d5d80d1). 구체적 사유는 사용자가 밝히지 않았다. 백로그 4번(팀 폭/깊이 비교)을 진행하면서 재도입 여부는 다시 묻지 않는다 — 사용자가 먼저 꺼내지 않는 한 "삭제됐다"는 사실만 기억해 둔다 |
