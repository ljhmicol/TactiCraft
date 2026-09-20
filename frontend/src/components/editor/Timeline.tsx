import { ChevronLeft, ChevronRight, Combine, Maximize2, Minimize2, Plus, X } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { axisMinuteAt, axisRatio, clusterByAxis, formatMinute, FULL_AXIS, timelineAxis } from '@/lib/timelineAxis'
import { useAnalysisStore } from '@/store/analysisStore'
import type { ChangingPoint } from '@/types/analysis'

// changingPoints가 없는 분석(대부분의 프리셋)에서 `s.analysis?.changingPoints ?? []`을
// 셀렉터 안에 인라인으로 쓰면 렌더마다 새 배열이 생겨 아래 useEffect(line 93 부근,
// [changingPoints] 의존)가 매 렌더 재실행 → setState → 재렌더가 무한 반복된다
// (2026-09-11, 모바일 실기기에서 "전술판이 안 보여" 리포트로 발견 — 헤드리스
// Chromium 콘솔의 "Maximum update depth exceeded" 경고로 원인 확인). 참조가
// 안정적인 모듈 스코프 상수로 폴백해 해결한다.
const EMPTY_CHANGING_POINTS: ChangingPoint[] = []

// 축 범위·눈금은 lib/timelineAxis가 정한다 — 보통은 0~120분(2026-09-09,
// "타임라인이 나는 시간대도 있어야 할 것 같아" 요청)이지만, 시점들이 좁은
// 구간에 몰려 있으면 그 구간으로 확대한다(2026-09-10).

// PhaseTabs의 국면 자동재생(TO-DO 2번)과 같은 간격 — 모프(600ms)가 끝난 뒤에도
// 잠깐 눈에 보일 정도로(2026-09-09, "타임라인이 자동재생 되게 해줘" 요청).
const AUTO_PLAY_INTERVAL_MS = 1800

/**
 * 타임라인(매치 체인징 포인트, TO-DO 5번). 기본/공격/수비 3국면과 완전히
 * 별개의 선택적 확장이다 — "전반 23분 추격 상황"처럼 경기 시간 축의 임의
 * 시점을 자유 라벨과 (선택적으로) 분 단위 시간과 함께 저장한다. 점을 고르면
 * 피치가 그 시점의 스냅샷을 보여주고(드래그·화살표·코멘트까지 그대로 편집
 * 가능), 국면 탭을 누르면 다시 평소 국면 보기로 돌아간다(analysisStore.switchPhase).
 *
 * minute이 있는 포인트는 시간축 위에 실제 위치로 표시되고, 없는 포인트는 그
 * 아래 "시간 미정" 칩으로 따로 모아 보여준다 — 시간을 몰라도 포인트 자체는
 * 만들 수 있어야 하기 때문(구버전 데이터에도 minute이 없다).
 */
export function Timeline() {
  const changingPoints = useAnalysisStore((s) => s.analysis?.changingPoints ?? EMPTY_CHANGING_POINTS)
  const selectedChangingPointId = useAnalysisStore((s) => s.selectedChangingPointId)
  const addChangingPoint = useAnalysisStore((s) => s.addChangingPoint)
  const renameChangingPoint = useAnalysisStore((s) => s.renameChangingPoint)
  const setChangingPointMinute = useAnalysisStore((s) => s.setChangingPointMinute)
  const removeChangingPoint = useAnalysisStore((s) => s.removeChangingPoint)
  const moveChangingPoint = useAnalysisStore((s) => s.moveChangingPoint)
  const mergeChangingPoints = useAnalysisStore((s) => s.mergeChangingPoints)
  const selectChangingPoint = useAnalysisStore((s) => s.selectChangingPoint)
  // 병합된 시점을 고르면 스토어가 steps를 자동 재생한다(null이 아닌 동안) —
  // 재생 중엔 이 시점의 이름/시간 수정·이동·삭제를 막아 재생을 방해하지
  // 않게 한다(2026-09-09, isPlaying과 같은 패턴).
  const mergedStepIndex = useAnalysisStore((s) => s.mergedStepIndex)
  const isReplaying = mergedStepIndex !== null
  // 재생 on/off는 store에 있다(2026-09-20, 고급 기능 패널이 이 컴포넌트를
  // 접어 숨길 수 있게 되면서 — 패널 쪽에서도 "재생 중"을 알아야 접기를
  // 막을 수 있다. analysisStore.ts의 timelineAutoplay 주석 참조).
  const isPlaying = useAnalysisStore((s) => s.timelineAutoplay)
  const setIsPlaying = useAnalysisStore((s) => s.setTimelineAutoplay)

  const selected = changingPoints.find((cp) => cp.id === selectedChangingPointId) ?? null
  const selectedIndex = selected ? changingPoints.findIndex((cp) => cp.id === selected.id) : -1

  const timed = changingPoints.filter((cp) => cp.minute != null)
  const untimed = changingPoints.filter((cp) => cp.minute == null)
  // 좁은 구간이면 자동으로 확대하되, 경기 전체에서 어디쯤인지 보고 싶을 때를
  // 위해 사용자가 0~120분 전체 축으로 되돌릴 수 있다(2026-09-10 요청).
  const [showFullAxis, setShowFullAxis] = useState(false)
  const autoAxis = timelineAxis(timed.map((cp) => cp.minute as number))
  const axis = showFullAxis ? FULL_AXIS : autoAxis
  // 점(12px)이 트랙(약 380px)에서 차지하는 비율 — 이보다 가까우면 겹쳐 보인다.
  const clusters = clusterByAxis(axis, timed, 3.2)

  // 타임라인 자동재생 — 실제 경기에서 패스가 이어지듯 시점을 순서대로(배열
  // 순서 = order_index) 넘긴다. PhaseTabs의 국면 자동재생과 같은 패턴:
  // 재생 중엔 처음으로 되감지 않고 "지금 선택된 곳에서 한 칸씩" 전진한다.

  useEffect(() => {
    if (!isPlaying) return
    if (changingPoints.length === 0) return

    const step = () => {
      const { analysis, selectedChangingPointId: currentId, selectChangingPoint: select } = useAnalysisStore.getState()
      const points = analysis?.changingPoints ?? []
      if (points.length === 0) return
      const currentIndex = points.findIndex((cp) => cp.id === currentId)
      const nextIndex = (currentIndex + 1) % points.length
      select(points[nextIndex].id)
    }

    step()
    const timer = setInterval(step, AUTO_PLAY_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step은 항상 최신 store를 직접 읽어온다
  }, [isPlaying])

  // 재생 중 시점이 1개 이하로 줄면(삭제 또는 다른 분석 로드) 자동으로 정지한다.
  useEffect(() => {
    if (isPlaying && changingPoints.length <= 1) setIsPlaying(false)
  }, [isPlaying, changingPoints.length, setIsPlaying])

  // 시점 병합 — "명장면은 여러 시점을 모아 하나의 장면으로 만드는 것"이라는
  // 요청(2026-09-09)으로 추가. 병합 모드에서는 점/칩을 눌러도 보기 선택이 아니라
  // 병합 대상 체크로 동작한다. 2개 이상 고른 뒤 "병합" 버튼을 눌러 확정한다.
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelected, setMergeSelected] = useState<string[]>([])

  useEffect(() => {
    // 시점이 사라지면(삭제) 이미 고른 병합 대상에서도 지운다
    setMergeSelected((prev) => prev.filter((id) => changingPoints.some((cp) => cp.id === id)))
  }, [changingPoints])

  const exitMergeMode = () => {
    setMergeMode(false)
    setMergeSelected([])
  }

  const toggleMergeCandidate = (id: string) =>
    setMergeSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const handleMergeConfirm = () => {
    if (mergeSelected.length < 2) return
    mergeChangingPoints(mergeSelected)
    exitMergeMode()
  }

  const handleAdd = () => addChangingPoint(`시점 ${changingPoints.length + 1}`)

  const toggleSelect = (cp: ChangingPoint) => {
    if (mergeMode) {
      toggleMergeCandidate(cp.id)
      return
    }
    selectChangingPoint(cp.id === selectedChangingPointId ? null : cp.id)
  }

  /**
   * 겹쳐서 한 덩어리로 그려진 점을 누르면 그 안의 시점을 차례로 넘어간다 —
   * 축소 상태에서도 덩어리 안의 모든 시점에 닿을 수 있어야 하기 때문이다.
   * 병합 모드에서는 덩어리 전체를 한 번에 체크/해제한다.
   */
  const handleClusterClick = (items: ChangingPoint[]) => {
    if (items.length === 1) {
      toggleSelect(items[0])
      return
    }
    if (mergeMode) {
      const allChecked = items.every((cp) => mergeSelected.includes(cp.id))
      items.forEach((cp) => {
        if (mergeSelected.includes(cp.id) === allChecked) toggleMergeCandidate(cp.id)
      })
      return
    }
    const current = items.findIndex((cp) => cp.id === selectedChangingPointId)
    selectChangingPoint(items[(current + 1) % items.length].id)
  }

  // 시간축 바를 직접 클릭하면 그 위치의 분(minute)으로 새 시점을 만든다 — 점(버튼)을
  // 클릭한 경우는 선택 동작이라 여기서 무시한다(2026-09-09, "타임라인바에서 선택을
  // 하면 타임라인을 추가할 수 있게도 만들어줘" 요청).
  const handleTrackClick = (e: MouseEvent<HTMLDivElement>) => {
    if (isPlaying || mergeMode) return
    if ((e.target as HTMLElement).closest('button')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    addChangingPoint(`시점 ${changingPoints.length + 1}`, axisMinuteAt(axis, ratio))
  }

  return (
    <div className="w-full max-w-md space-y-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">타임라인</span>
        <div className="flex items-center gap-1.5">
          {changingPoints.length > 1 && !mergeMode && (
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                'whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                isPlaying ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {isPlaying ? '⏸ 시점 정지' : '▶ 시점 자동재생'}
            </button>
          )}
          {changingPoints.length > 1 && !isPlaying && (
            <button
              type="button"
              onClick={() => (mergeMode ? exitMergeMode() : setMergeMode(true))}
              title="여러 시점을 하나로 합치기"
              className={cn(
                'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mergeMode ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              <Combine className="h-3 w-3" />
              병합
            </button>
          )}
          {autoAxis.zoomed && (
            <button
              type="button"
              onClick={() => setShowFullAxis((v) => !v)}
              title={
                showFullAxis
                  ? '시점이 몰려 있는 구간만 확대해서 봅니다'
                  : '0~120분 경기 전체 시간축으로 봅니다'
              }
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {showFullAxis ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              {showFullAxis ? '구간 확대' : '전체 보기'}
            </button>
          )}
          <button
            type="button"
            disabled={isPlaying || mergeMode}
            onClick={handleAdd}
            title="지금 보이는 배치를 시점으로 저장"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            시점
          </button>
        </div>
      </div>

      {mergeMode && (
        <div className="flex items-center justify-between rounded-md bg-accent/60 px-2 py-1 text-xs text-accent-foreground">
          <span>합칠 시점을 눌러 고르세요 ({mergeSelected.length}개 선택됨)</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={mergeSelected.length < 2}
              onClick={handleMergeConfirm}
              className="shrink-0 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              병합하기
            </button>
            <button
              type="button"
              onClick={exitMergeMode}
              className="shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/*
        space-y-1(부모)의 자식 간격 규칙(.space-y-1 > :not([hidden]) ~ :not([hidden]))이
        일반 mb-* 유틸리티보다 우선순위(specificity)가 높아서, 이 축 div가 부모의
        직계 자식이면 어떤 mb-* 값을 줘도 0으로 덮어써진다(2026-09-09 사용자 리포트
        — "0'과 시간 미정이 겹쳐" 디버깅 중 발견). 한 겹 더 감싸 직계 자식 관계를
        끊어야 아래 mb-6가 실제로 적용된다.
      */}
      <div>
        <div
          className="relative mx-1 mb-6 mt-4 cursor-pointer py-1.5"
          onClick={handleTrackClick}
          title="클릭하면 그 시간에 새 시점을 추가합니다"
        >
          <div className="h-1.5 rounded-full bg-muted" />
          {axis.lines.map((m) => (
            <div
              key={m}
              className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-border"
              style={{ left: `${axisRatio(axis, m)}%` }}
            />
          ))}
          {axis.ticks.map((m, i) => (
            <span
              key={`${m}-${i}`}
              className="absolute top-full mt-1 -translate-x-1/2 text-[10px] text-muted-foreground"
              style={{ left: `${axisRatio(axis, m)}%` }}
            >
              {formatMinute(m)}
            </span>
          ))}
          {clusters.map((cluster) => {
            const single = cluster.items.length === 1
            const active = cluster.items.some((cp) =>
              mergeMode ? mergeSelected.includes(cp.id) : cp.id === selectedChangingPointId,
            )
            return (
              <button
                key={cluster.items.map((cp) => cp.id).join('-')}
                type="button"
                disabled={isPlaying}
                title={
                  single
                    ? `${formatMinute(cluster.items[0].minute as number)} — ${cluster.items[0].label}`
                    : [
                        `시점 ${cluster.items.length}개`,
                        ...cluster.items.map(
                          (cp) => `${formatMinute(cp.minute as number)} — ${cp.label}`,
                        ),
                      ].join('\n')
                }
                onClick={() => handleClusterClick(cluster.items)}
                style={{ left: `${cluster.ratio}%` }}
                className={cn(
                  'absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                  single ? 'h-3 w-3' : 'h-4 min-w-4 px-0.5 text-[9px] font-semibold leading-none',
                  mergeMode
                    ? active
                      ? 'border-amber-500 bg-amber-500 text-white'
                      : 'border-muted-foreground bg-background hover:border-foreground'
                    : active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground bg-background text-muted-foreground hover:border-foreground',
                )}
              >
                {!single && cluster.items.length}
              </button>
            )
          })}
        </div>
      </div>

      {untimed.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[10px] text-muted-foreground">시간 미정</span>
          {untimed.map((cp) => (
            <button
              key={cp.id}
              type="button"
              disabled={isPlaying}
              onClick={() => toggleSelect(cp)}
              className={cn(
                'whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                mergeMode
                  ? mergeSelected.includes(cp.id)
                    ? 'bg-amber-500 text-white'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                  : cp.id === selectedChangingPointId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
                isPlaying && 'cursor-not-allowed opacity-60',
              )}
            >
              {cp.label}
            </button>
          ))}
        </div>
      )}

      {selected && !mergeMode && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            type="number"
            min={0}
            max={120}
            // 명장면 프리셋처럼 초 단위로 쪼갠 시점은 분이 소수(68.52)다.
            step="any"
            value={selected.minute ?? ''}
            placeholder="분"
            disabled={isPlaying || isReplaying}
            onChange={(e) =>
              setChangingPointMinute(selected.id, e.target.value === '' ? undefined : Number(e.target.value))
            }
            className="h-7 w-14 shrink-0 text-xs"
            aria-label="경기 시간(분)"
          />
          <Input
            value={selected.label}
            disabled={isPlaying || isReplaying}
            onChange={(e) => renameChangingPoint(selected.id, e.target.value)}
            className="h-7 flex-1 text-xs"
            aria-label="시점 이름"
          />
          <button
            type="button"
            disabled={isPlaying || isReplaying || selectedIndex <= 0}
            onClick={() => moveChangingPoint(selected.id, 'left')}
            title="왼쪽으로 이동"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isPlaying || isReplaying || selectedIndex < 0 || selectedIndex >= changingPoints.length - 1}
            onClick={() => moveChangingPoint(selected.id, 'right')}
            title="오른쪽으로 이동"
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isPlaying || isReplaying}
            onClick={() => removeChangingPoint(selected.id)}
            title="이 시점 삭제"
            className="rounded-md p-1 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-30"
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
