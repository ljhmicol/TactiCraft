import type { ReactNode } from 'react'

import {
  ChannelGridInfo,
  CompactnessInfo,
  OverloadInfo,
  PressingLineInfo,
} from '@/components/common/MetricInfoButtons'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { LayerToggles } from '@/types/analysis'

// 압박선 "레이어"(이 pressingLine 토글, 피치 위 시각적 라인 표시 여부)는
// EditorPage의 FM식 5단계 프리셋 Select("압박 라인" — 대형을 실제로
// 밀어올리는 편집 도구)와 이름은 비슷하지만 다른 기능이다.
//
// info(개선 로드맵 §7.5, "전술 지표 설명") — "하프"는 5채널 구분의 하위
// 개념이라 따로 설명을 달지 않고 ChannelGridInfo 안에서 함께 설명한다.
const LAYER_CHIPS: { key: keyof LayerToggles; label: string; info?: () => ReactNode }[] = [
  { key: 'channelGrid', label: '5채널', info: ChannelGridInfo },
  { key: 'halfSpaces', label: '하프' },
  { key: 'pressingLine', label: '압박', info: PressingLineInfo },
  { key: 'compactness', label: '콤팩', info: CompactnessInfo },
  { key: 'overload', label: '오버', info: OverloadInfo },
]

/** 레이어 토글 칩 — 피치 바로 아래 (2단계 §11.1, 색 규정은 §12.4). */
export function LayerToggleChips({ hasOpponent }: { hasOpponent: boolean }) {
  const layers = useAnalysisStore((s) => s.layers)
  const toggleLayer = useAnalysisStore((s) => s.toggleLayer)
  const chips = LAYER_CHIPS

  return (
    <div className="flex gap-2 overflow-x-auto">
      {chips.map(({ key, label, info: Info }) => {
        const disabled = key === 'overload' && !hasOpponent
        const on = layers[key]
        return (
          <span key={key} className="inline-flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={disabled}
              title={disabled ? '상대팀 위치를 입력하면 사용할 수 있습니다' : undefined}
              onClick={() => toggleLayer(key)}
              className={cn(
                'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                disabled
                  ? 'cursor-not-allowed bg-secondary text-slate-300'
                  : on
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
            {Info && <Info />}
          </span>
        )
      })}
    </div>
  )
}
