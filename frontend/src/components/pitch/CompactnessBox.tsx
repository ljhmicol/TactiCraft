import { computeCompactness } from '@/lib/compactness'
import { LAYER_COLORS, PITCH_TEXT_FONT_FAMILY } from '@/lib/theme'
import type { PlayerPosition } from '@/types/analysis'

/** GK 제외 자팀 bounding box + m 환산 라벨 (2단계 §9, §12.3). */
export function CompactnessBox({ positions }: { positions: PlayerPosition[] }) {
  const result = computeCompactness(positions)
  if (!result) return null
  const { box, verticalM, horizontalM } = result

  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        fill="none"
        stroke={LAYER_COLORS.compactness.color}
        strokeWidth={0.35}
        strokeDasharray="1 1"
      />
      <text
        x={box.x + box.width / 2}
        y={box.y - 1.5 >= 0 ? box.y - 1.5 : box.y + box.height + 3}
        fill={LAYER_COLORS.compactness.color}
        fontSize={2}
        textAnchor="middle"
        style={{ fontFamily: PITCH_TEXT_FONT_FAMILY }}
      >
        세로 {verticalM}m × 가로 {horizontalM}m
      </text>
    </g>
  )
}
