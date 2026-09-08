import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import type { MouseEvent } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { ChangingPoint } from '@/types/analysis'

// 경기 시간축 범위 — 연장전까지 감안해 120분까지 그린다(2026-09-09, "타임라인이
// 나는 시간대도 있어야 할 것 같아" 요청으로 minute 필드 + 시간축 바 추가).
const AXIS_MAX_MINUTE = 120
const AXIS_TICKS = [0, 45, 90, 120]
const AXIS_LINES = [45, 90] // 전반/후반 종료선

/**
 * 타임라인(매치 체인징 포인트, TO-DO 5번). 기본/공격/수비 3국면과 완전히
 * 별개의 선택적 확장이다 — "전반 23분 추격 상황"처럼 경기 시간 축의 임의
 * 시점을 자유 라벨과 (선택적으로) 분 단위 시간과 함께 저장한다. 점을 고르면
 * 피치가 그 시점의 스냅샷을 보여주고(드래그·화살표·코멘트까지 그대로 편집
 * 가능), 국면 탭을 누르면 다시 평소 국면 보기로 돌아간다(analysisStore.switchPhase).
 *
 * minute이 있는 포인트는 0~120분 시간축 위에 실제 위치로 표시되고, 없는
 * 포인트는 그 아래 "시간 미정" 칩으로 따로 모아 보여준다 — 시간을 몰라도
 * 포인트 자체는 만들 수 있어야 하기 때문(구버전 데이터에도 minute이 없다).
 */
export function Timeline() {
  const changingPoints = useAnalysisStore((s) => s.analysis?.changingPoints ?? [])
  const selectedChangingPointId = useAnalysisStore((s) => s.selectedChangingPointId)
  const addChangingPoint = useAnalysisStore((s) => s.addChangingPoint)
  const renameChangingPoint = useAnalysisStore((s) => s.renameChangingPoint)
  const setChangingPointMinute = useAnalysisStore((s) => s.setChangingPointMinute)
  const removeChangingPoint = useAnalysisStore((s) => s.removeChangingPoint)
  const moveChangingPoint = useAnalysisStore((s) => s.moveChangingPoint)
  const selectChangingPoint = useAnalysisStore((s) => s.selectChangingPoint)

  const selected = changingPoints.find((cp) => cp.id === selectedChangingPointId) ?? null
  const selectedIndex = selected ? changingPoints.findIndex((cp) => cp.id === selected.id) : -1

  const timed = changingPoints.filter((cp) => cp.minute != null)
  const untimed = changingPoints.filter((cp) => cp.minute == null)

  const handleAdd = () => addChangingPoint(`체인징 포인트 ${changingPoints.length + 1}`)

  const toggleSelect = (cp: ChangingPoint) => selectChangingPoint(cp.id === selectedChangingPointId ? null : cp.id)

  // 시간축 바를 직접 클릭하면 그 위치의 분(minute)으로 새 시점을 만든다 — 점(버튼)을
  // 클릭한 경우는 선택 동작이라 여기서 무시한다(2026-09-09, "타임라인바에서 선택을
  // 하면 타임라인을 추가할 수 있게도 만들어줘" 요청).
  const handleTrackClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const minute = Math.round(ratio * AXIS_MAX_MINUTE)
    addChangingPoint(`체인징 포인트 ${changingPoints.length + 1}`, minute)
  }

  return (
    <div className="w-full max-w-md space-y-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">타임라인</span>
        <button
          type="button"
          onClick={handleAdd}
          title="지금 보이는 배치를 시점으로 저장"
          className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Plus className="h-3 w-3" />
          시점
        </button>
      </div>

      <div
        className="relative mx-1 mb-5 mt-4 cursor-pointer py-1.5"
        onClick={handleTrackClick}
        title="클릭하면 그 시간에 새 시점을 추가합니다"
      >
        <div className="h-1.5 rounded-full bg-muted" />
        {AXIS_LINES.map((m) => (
          <div
            key={m}
            className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-border"
            style={{ left: `${(m / AXIS_MAX_MINUTE) * 100}%` }}
          />
        ))}
        {AXIS_TICKS.map((m) => (
          <span
            key={m}
            className="absolute top-full mt-1 -translate-x-1/2 text-[10px] text-muted-foreground"
            style={{ left: `${(m / AXIS_MAX_MINUTE) * 100}%` }}
          >
            {m}&apos;
          </span>
        ))}
        {timed.map((cp) => (
          <button
            key={cp.id}
            type="button"
            title={`${cp.minute}' — ${cp.label}`}
            onClick={() => toggleSelect(cp)}
            style={{ left: `${Math.min(100, ((cp.minute ?? 0) / AXIS_MAX_MINUTE) * 100)}%` }}
            className={cn(
              'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-colors',
              cp.id === selectedChangingPointId
                ? 'border-primary bg-primary'
                : 'border-muted-foreground bg-background hover:border-foreground',
            )}
          />
        ))}
      </div>

      {untimed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[10px] text-muted-foreground">시간 미정</span>
          {untimed.map((cp) => (
            <button
              key={cp.id}
              type="button"
              onClick={() => toggleSelect(cp)}
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                cp.id === selectedChangingPointId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {cp.label}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            type="number"
            min={0}
            max={120}
            value={selected.minute ?? ''}
            placeholder="분"
            onChange={(e) =>
              setChangingPointMinute(selected.id, e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="h-7 w-14 shrink-0 text-xs"
            aria-label="경기 시간(분)"
          />
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
          국면과 별개로 "전반 23분 추격 상황"처럼 특정 시점의 배치를 시간(분)과 함께 저장하고 싶을 때 "+ 시점"을
          눌러보세요.
        </p>
      )}
    </div>
  )
}
