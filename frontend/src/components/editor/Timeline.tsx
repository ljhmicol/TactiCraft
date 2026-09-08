import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 타임라인(매치 체인징 포인트, TO-DO 5번). 기본/공격/수비 3국면과 완전히
 * 별개의 선택적 확장이다 — "전반 23분 추격 상황"처럼 경기 시간 축의 임의
 * 시점을 자유 라벨과 함께 저장한다. 점을 고르면 피치가 그 시점의 스냅샷을
 * 보여주고(드래그·화살표·코멘트까지 그대로 편집 가능), 국면 탭을 누르면
 * 다시 평소 국면 보기로 돌아간다(analysisStore.switchPhase).
 */
export function Timeline() {
  const changingPoints = useAnalysisStore((s) => s.analysis?.changingPoints ?? [])
  const selectedChangingPointId = useAnalysisStore((s) => s.selectedChangingPointId)
  const addChangingPoint = useAnalysisStore((s) => s.addChangingPoint)
  const renameChangingPoint = useAnalysisStore((s) => s.renameChangingPoint)
  const removeChangingPoint = useAnalysisStore((s) => s.removeChangingPoint)
  const moveChangingPoint = useAnalysisStore((s) => s.moveChangingPoint)
  const selectChangingPoint = useAnalysisStore((s) => s.selectChangingPoint)

  const selected = changingPoints.find((cp) => cp.id === selectedChangingPointId) ?? null
  const selectedIndex = selected ? changingPoints.findIndex((cp) => cp.id === selected.id) : -1

  const handleAdd = () => addChangingPoint(`체인징 포인트 ${changingPoints.length + 1}`)

  return (
    <div className="w-full max-w-md space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="shrink-0 text-xs text-muted-foreground">타임라인</span>
        {changingPoints.map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => selectChangingPoint(cp.id === selectedChangingPointId ? null : cp.id)}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              cp.id === selectedChangingPointId
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {cp.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          title="지금 보이는 배치를 시점으로 저장"
          className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3 w-3" />
          시점
        </button>
      </div>

      {selected && (
        <div className="flex items-center gap-1.5">
          <Input
            value={selected.label}
            onChange={(e) => renameChangingPoint(selected.id, e.target.value)}
            className="h-7 flex-1 text-xs"
            aria-label="체인징 포인트 이름"
          />
          <button
            type="button"
            disabled={selectedIndex <= 0}
            onClick={() => moveChangingPoint(selected.id, 'left')}
            title="왼쪽으로 이동"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedIndex < 0 || selectedIndex >= changingPoints.length - 1}
            onClick={() => moveChangingPoint(selected.id, 'right')}
            title="오른쪽으로 이동"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => removeChangingPoint(selected.id)}
            title="이 시점 삭제"
            className="rounded-md p-1 text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {changingPoints.length === 0 && (
        <p className="text-xs text-muted-foreground">
          국면과 별개로 "전반 23분 추격 상황"처럼 특정 시점의 배치를 저장하고 싶을 때 "+ 시점"을 눌러보세요.
        </p>
      )}
    </div>
  )
}
