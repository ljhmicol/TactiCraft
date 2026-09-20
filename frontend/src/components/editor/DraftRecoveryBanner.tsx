import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { clearDraft, readDraft } from '@/lib/draftStorage'
import { useAnalysisStore } from '@/store/analysisStore'

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.round(hours / 24)}일 전`
}

/**
 * 초안 복구 배너(개선 로드맵 §5.1). 새로고침·탭 재접속으로 스토어(메모리)가
 * 비워진 뒤에도 localStorage에 남은 초안이 있으면 한 번 알려준다. `useState`
 * 초기값으로 마운트 시점에 딱 한 번만 localStorage를 읽는다 — 이후
 * useDraftAutosave가 계속 같은 슬롯을 갱신하더라도 이 배너가 매 렌더마다
 * 다시 나타났다 사라졌다 깜빡이면 안 되므로, "복구/버리기로 닫았는지"는
 * 이 컴포넌트의 로컬 state로만 추적한다.
 *
 * EditorPage가 렌더하는 두 분기(빈 화면 / 로드된 화면) 모두에서 쓴다 —
 * AnalysisDetailPage(/analyses/:id)가 새로고침 직후 서버의 "깨끗한" 버전을
 * 스토어에 먼저 채워 넣어도, 이 배너는 스토어가 아니라 localStorage를
 * 직접 보므로 상관없이 "복구할 초안이 있습니다"를 띄우고, 복구를 누르면
 * 그 깨끗한 버전 위에 초안을 덮어쓴다.
 */
export function DraftRecoveryBanner() {
  const [draft, setDraft] = useState(() => readDraft())
  const restoreDraft = useAnalysisStore((s) => s.restoreDraft)

  if (!draft) return null

  const handleRestore = () => {
    restoreDraft(draft.analysis)
    setDraft(null)
  }

  const handleDiscard = () => {
    clearDraft()
    setDraft(null)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <p className="text-foreground">
        저장하지 않은 초안이 있습니다 ({formatRelativeTime(draft.savedAt)} 자동 저장됨).
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={handleRestore}>
          복구하기
        </Button>
        <Button size="sm" variant="outline" onClick={handleDiscard}>
          버리기
        </Button>
      </div>
    </div>
  )
}
