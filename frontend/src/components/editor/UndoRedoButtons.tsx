import { Redo2, Undo2 } from 'lucide-react'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 되돌리기/다시하기(TO-DO 27번). 스토어가 `analysis` 변경을 debounce로
 * 자동 감지해 히스토리를 쌓으므로(analysisStore.ts 하단 subscribe) 이
 * 컴포넌트는 그 결과(past/future 길이, undo/redo 액션)만 보여준다.
 *
 * Ctrl/Cmd+Z(다시 실행은 Shift 추가)도 지원하되, 입력 필드에 포커스가
 * 있을 때는 가로채지 않는다 — 그 경우 브라우저 자체의 텍스트 되돌리기가
 * 우선이어야 자연스럽다(전역 되돌리기가 끼어들면 "방금 친 글자"가 아니라
 * "마지막 커밋된 변경"이 지워져 혼란스럽다).
 */
export function UndoRedoButtons() {
  const canUndo = useAnalysisStore((s) => s.past.length > 0)
  const canRedo = useAnalysisStore((s) => s.future.length > 0)
  const undo = useAnalysisStore((s) => s.undo)
  const redo = useAnalysisStore((s) => s.redo)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditable =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (!mod || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={undo}
        disabled={!canUndo}
        className="gap-1.5 px-2.5"
        title="실행 취소 (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
        실행 취소
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={redo}
        disabled={!canRedo}
        className="gap-1.5 px-2.5"
        title="다시 실행 (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
        다시 실행
      </Button>
    </div>
  )
}
