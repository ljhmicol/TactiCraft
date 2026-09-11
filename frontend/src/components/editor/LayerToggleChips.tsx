import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { LayerToggles } from '@/types/analysis'

const CHIPS: { key: keyof LayerToggles; label: string }[] = [
  { key: 'channelGrid', label: '5채널' },
  { key: 'halfSpaces', label: '하프' },
  { key: 'pressingLine', label: '압박' },
  { key: 'compactness', label: '콤팩' },
  { key: 'overload', label: '오버' },
]

/** 레이어 토글 칩 — 피치 바로 아래 (2단계 §11.1, 색 규정은 §12.4). */
export function LayerToggleChips({ hasOpponent }: { hasOpponent: boolean }) {
  const layers = useAnalysisStore((s) => s.layers)
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer)

  return (
    <div className="flex gap-2 overflow-x-auto">
      {CHIPS.map(({ key, label }) => {
        const disabled = key === 'overload' && !hasOpponent
        const on = layers[key]
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            title={disabled ? '상대팀 위치를 입력하면 사용할 수 있습니다' : undefined}
            onClick={() => toggleLayer(key)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              disabled
                ? 'cursor-not-allowed bg-secondary text-slate-300'
                : on
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
