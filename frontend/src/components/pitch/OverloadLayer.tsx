import { transposePoint, transposeRect } from '@/lib/coords'
import { computeOverload } from '@/lib/overload'
import { LAYER_COLORS, PITCH_TEXT_FONT_FAMILY } from '@/lib/theme'
import { CHANNEL_BOUNDS, THIRD_BOUNDS } from '@/lib/zones'
import type { PhaseData } from '@/types/analysis'

interface OverloadLayerProps {
  phase: PhaseData
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용. phase의 좌표는 항상 원본(세로)
   * 좌표계로 받는다 — computeOverload가 CHANNEL_BOUNDS/THIRD_BOUNDS로 구역을
   * 나누는 기준 자체가 세로 좌표계이기 때문이다. */
  orientation?: 'portrait' | 'landscape'
}

/**
 * 15구역 채색. strong/weak는 같은 색(노랑)의 농도 차이로만 구분하고, 색만으로
 * 구분하지 않도록 +2/+1 숫자 라벨을 함께 표기한다 (2단계 §12.3 — 색각 이상 대응).
 */
export function OverloadLayer({ phase, orientation = 'portrait' }: OverloadLayerProps) {
  const zones = computeOverload(phase)
  const landscape = orientation === 'landscape'

  return (
    <g>
      {zones
        .filter((z) => z.level !== 'none')
        .map((z) => {
          const [x0, x1] = CHANNEL_BOUNDS[z.channel]
          const [y0, y1] = THIRD_BOUNDS[z.third]
          const style = LAYER_COLORS.overload[z.level as 'strong' | 'weak']
          const rect = landscape ? transposeRect(x0, x1, y0, y1) : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
          const label = landscape
            ? transposePoint({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 })
            : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
          return (
            <g key={`${z.channel}-${z.third}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={style.color}
                fillOpacity={style.opacity}
                stroke={style.color}
                strokeOpacity={0.9}
                strokeWidth={0.5}
              />
              <text
                x={label.x}
                y={label.y}
                fill="#78350F"
                fontSize={2.6}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
                style={{ fontFamily: PITCH_TEXT_FONT_FAMILY }}
              >
                +{z.diff}
              </text>
            </g>
          )
        })}
    </g>
  )
}
