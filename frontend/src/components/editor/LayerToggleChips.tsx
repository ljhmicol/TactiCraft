import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { LayerToggles } from '@/types/analysis'

// 기본/고급 분리(개선 로드맵 §6.1, 2026-09-20) — 5채널·하프는 누구나 바로
// 쓰는 기본 시각화라 항상 보이고, 압박·콤팩·오버는 로드맵이 지목한 "고급
// 기능"이라 AdvancedFeaturesPanel 안에서만 보인다. 압박선 "레이어"(이
// pressingLine 토글, 피치 위 시각적 라인 표시 여부)는 EditorPage의 FM식
// 5단계 프리셋 Select("압박 라인" — 대형을 실제로 밀어올리는 편집 도구)와
// 이름은 비슷하지만 다른 기능이다 — 그 프리셋은 데이터를 직접 바꾸는
// 편집 동작이라 여기 "고급 기능"에 넣지 않았다(로드맵이 말하는 건
// 레이어/시각화 쪽이라고 해석했다).
const BASIC_CHIPS: { key: keyof LayerToggles; label: string }[] = [
  { key: 'channelGrid', label: '5채널' },
  { key: 'halfSpaces', label: '하프' },
]

const ADVANCED_CHIPS: { key: keyof LayerToggles; label: string }[] = [
  { key: 'pressingLine', label: '압박' },
  { key: 'compactness', label: '콤팩' },
  { key: 'overload', label: '오버' },
]

/** 레이어 토글 칩 — 피치 바로 아래 (2단계 §11.1, 색 규정은 §12.4).
 * variant="basic"은 EditorPage에 항상 보이고, "advanced"는
 * AdvancedFeaturesPanel 안에서만 렌더링된다. */
export function LayerToggleChips({
  hasOpponent,
  variant = 'basic',
}: {
  hasOpponent: boolean
  variant?: 'basic' | 'advanced'
}) {
  const layers = useAnalysisStore((s) => s.layers)
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer)
  const chips = variant === 'basic' ? BASIC_CHIPS : ADVANCED_CHIPS

  return (
    <div className="flex gap-2 overflow-x-auto">
      {chips.map(({ key, label }) => {
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
              'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
