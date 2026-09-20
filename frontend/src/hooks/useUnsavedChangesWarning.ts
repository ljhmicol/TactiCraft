import { useEffect } from 'react'

import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 새로고침·탭 닫기 전 네이티브 경고(개선 로드맵 §5.1). 전엔 로고 클릭에만
 * 미저장 경고가 있고 새로고침/탭 종료는 아무 경고 없이 그대로 날아갔다 —
 * 초안 자동복구(useDraftAutosave)가 최근 몇 초를 못 건질 수도 있는 좁은
 * 틈을 메워준다. 브라우저가 안내 문구를 직접 통제해서(보안상 커스텀 텍스트를
 * 최신 브라우저들이 무시함) beforeunload의 관례대로 `returnValue`만 채운다.
 */
export function useUnsavedChangesWarning() {
  const isDirty = useAnalysisStore((s) => s.isDirty)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
