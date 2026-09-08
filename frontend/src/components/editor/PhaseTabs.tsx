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

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="inline-flex rounded-lg border border-border bg-muted p-1">
        {PHASES.map((phase) => (
          <button
            key={phase}
            type="button"
            disabled={isPlaying}
            onClick={() => switchPhase(phase)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              currentPhase === phase
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
              isPlaying && 'cursor-not-allowed opacity-50',
            )}
          >
            {PHASE_LABELS[phase]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsPlaying((v) => !v)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
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
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
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
