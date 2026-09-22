import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 화면에는 안 보이지만 스크린리더는 읽는 공지 영역(개선 로드맵 §6.4,
 * 2026-09-22) — 선수/상대 노드를 키보드로 옮겼을 때 `announce()`가 채우는
 * `a11yAnnouncement`를 그대로 낭독한다. `aria-live="polite"`라 다른 낭독이
 * 끝난 뒤 순서대로 읽는다(assertive처럼 끼어들지 않음) — 화살표를 연타해도
 * 낭독이 밀리기만 하지 겹쳐 끊기지 않는다.
 */
export function LiveRegion() {
  const message = useAnalysisStore((s) => s.a11yAnnouncement)
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
