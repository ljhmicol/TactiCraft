import { useEffect, useRef } from 'react'

import { clearDraft, saveDraft } from '@/lib/draftStorage'
import { useAnalysisStore } from '@/store/analysisStore'

const AUTOSAVE_DEBOUNCE_MS = 4000

/**
 * 편집 중 로컬 초안 자동 저장(개선 로드맵 §5.1). `isDirty`가 true인 동안
 * 편집이 멈추고 4초 뒤 localStorage에 현재 상태를 써 둔다 — 매 키 입력마다
 * 쓰면 낭비고, 서버 저장(SaveButton)만큼 즉시성이 필요한 것도 아니다.
 *
 * `isDirty`가 true에서 false로 바뀌면(저장 성공, 다른 분석 로드, 복구
 * 배너에서 "버리기") 초안을 지운다. 단, "이 마운트 동안 한 번이라도
 * dirty였던 적이 있을 때만" 지운다(hasBeenDirtyRef) — 이 게이트가 없으면
 * 페이지를 막 연 시점(analysis가 아직 null이거나 방금 loadAnalysis로
 * 깨끗하게 로드된 시점, 둘 다 isDirty=false)에 이펙트가 곧바로
 * clearDraft()를 불러 복구해야 할 초안 자체를 이 마운트가 지워버리는
 * 문제가 있었다(2026-09-18, advisor 리뷰로 발견). 특히 /analyses/:id는
 * 로딩 중(analysis=null) → 데이터 도착(loadAnalysis, isDirty=false) 두
 * 단계를 거치는데, 그 사이 DraftRecoveryBanner가 다른 분기(다른 JSX
 * 서브트리)로 마운트가 바뀌면서 리마운트된다 — 첫 마운트의 이펙트가 이미
 * draft를 지워버리면 두 번째 마운트는 복구할 게 없어 배너가 안 뜬다.
 */
export function useDraftAutosave() {
  const analysis = useAnalysisStore((s) => s.analysis)
  const isDirty = useAnalysisStore((s) => s.isDirty)
  const hasBeenDirtyRef = useRef(false)

  useEffect(() => {
    if (isDirty) hasBeenDirtyRef.current = true

    if (!isDirty || !analysis) {
      if (hasBeenDirtyRef.current) clearDraft()
      return
    }
    const timer = setTimeout(() => saveDraft(analysis), AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [analysis, isDirty])
}
