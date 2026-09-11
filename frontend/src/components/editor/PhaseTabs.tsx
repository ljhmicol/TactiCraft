import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = {
  base: '기본',
  attack: '공격',
  defense: '수비',
}

const PHASES: PhaseType[] = ['base', 'attack', 'defense']

// 국면 전환(600ms 모프) 후 다음 전환까지 대기 — 시연용으로 눈에 보일 정도의 간격(TO-DO 2번).
const AUTO_PLAY_INTERVAL_MS = 1800

/** 국면 전환 UI. 피치 바로 위, Ghost View 토글은 우측에 붙인다 (2단계 §11.1). */
export function PhaseTabs() {
  const currentPhase = useAnalysisStore((s) => s.currentPhase)
  const switchPhase = useAnalysisStore((s) => s.switchPhase)
  const ghostView = useAnalysisStore((s) => s.layers.ghostView)
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer)
  // 타임라인에서 체인징 포인트를 보는 중이면 국면 탭 3개 중 어느 것도
  // "활성"으로 보이지 않는다 — 국면 탭을 누르면 switchPhase가 이 선택을 해제한다.
  const selectedChangingPointId = useAnalysisStore((s) => s.selectedChangingPointId)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (!isPlaying) return

    const step = () => {
      const phase = useAnalysisStore.getState().currentPhase
      const nextIndex = (PHASES.indexOf(phase) + 1) % PHASES.length
      switchPhase(PHASES[nextIndex])
    }

    step()
    const timer = setInterval(step, AUTO_PLAY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isPlaying, switchPhase])

  // 모바일 실기기 리포트(2026-09-11, "글자크기들도 안 맞아서 튀어나오고")로
  // 발견 — 좁은 화면에서 이 줄이 justify-between으로 양쪽에 붙은 두 그룹을
  // 한 줄에 욱여넣으려다 flex-shrink 기본값 때문에 버튼이 눌려 "기\n본"처럼
  // 글자 단위로 줄바꿈됐다(App.tsx 내비 모바일 수정과 같은 원인·같은 패턴).
  // flex-wrap으로 안 맞으면 두 그룹이 줄바꿈되게 하고, 각 버튼엔
  // whitespace-nowrap·shrink-0을 줘서 버튼 안의 글자 자체는 절대 안 깨지게 한다.
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="inline-flex shrink-0 rounded-lg border border-border bg-muted p-1">
        {PHASES.map((phase) => (
          <button
            key={phase}
            type="button"
            disabled={isPlaying}
            onClick={() => switchPhase(phase)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              currentPhase === phase && !selectedChangingPointId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
              isPlaying && 'cursor-not-allowed opacity-50',
            )}
          >
            {PHASE_LABELS[phase]}
          </button>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying((v) => !v)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            isPlaying ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          {isPlaying ? '⏸ 정지' : '▶ 자동재생'}
        </button>
        <button
          type="button"
          disabled={isPlaying}
          onClick={() => toggleLayer('ghostView')}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            ghostView ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground',
            isPlaying && 'cursor-not-allowed opacity-50',
          )}
        >
          ⟳ Ghost
        </button>
      </div>
    </div>
  )
}
