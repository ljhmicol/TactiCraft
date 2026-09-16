import { motion } from 'framer-motion'

import { transposePoint, transposeRect } from '@/lib/coords'
import type { MatchupHighlight } from '@/lib/matchup'
import { LANDSCAPE_TEXT_X_SCALE } from '@/lib/pitchMarkings'
import { PITCH_TEXT_FONT_FAMILY, VERSUS_TEAM_COLORS } from '@/lib/theme'
import { CHANNEL_BOUNDS, THIRD_BOUNDS } from '@/lib/zones'
import type { ZoneOverload } from '@/types/analysis'

interface MatchupOverloadLayerProps {
  zones: ZoneOverload[]
  orientation?: 'portrait' | 'landscape'
  /** 구역별 "N:M" 숫자 텍스트를 끌 수 있는 옵션(TO-DO 50-2, "피치 내부 시각적
   * 복잡도" 피드백). 색 타일(rect)은 그대로 둬서 어느 팀이 우세한지는 계속
   * 한눈에 보이고, 겹쳐 읽히던 숫자만 줄어든다. 기본값 true — 기존 화면과
   * 동일하게 유지. */
  showNumbers?: boolean
  /** 상단 배지 클릭으로 지정된 구역(TO-DO 50-3). 일치하는 타일에 깜빡이는
   * 테두리를 덧그린다 — 팀 색(A/B)과 헷갈리지 않도록 중립색(amber)을 쓴다. */
  highlight?: MatchupHighlight
}

/**
 * 전술 대결 뷰(TO-DO 22) 전용 — 단일 팀용 `OverloadLayer`(항상 amber 한 색)와
 * 달리, 어느 팀이 앞선 구역인지 팀 색(VERSUS_TEAM_COLORS)으로 구분해 칠한다.
 * "수원삼성을 선택하면 어느 구역에서 우세한지 보여줘야 한다"는 피드백
 * (2026-09-07) — 클릭으로 고르는 대신 두 팀의 우세 구역을 항상 동시에
 * 색으로 보여준다. zones는 항상 원본(세로) 좌표계로 받는다 —
 * CHANNEL_BOUNDS/THIRD_BOUNDS로 이미 구역이 나뉜 결과라 좌표 재계산이
 * 필요 없고, 렌더링 시점에만 가로 변환한다(OverloadLayer와 같은 패턴).
 */
export function MatchupOverloadLayer({
  zones,
  orientation = 'portrait',
  showNumbers = true,
  highlight = null,
}: MatchupOverloadLayerProps) {
  const landscape = orientation === 'landscape'
  // 글자 가로 비율 보정(TO-DO 39) — StaticPlayerNode와 같은 이유·같은 방식.
  const textScaleX = landscape ? LANDSCAPE_TEXT_X_SCALE : 1

  return (
    <g>
      {zones
        .filter((z) => z.diff !== 0)
        .map((z) => {
          const [x0, x1] = CHANNEL_BOUNDS[z.channel]
          const [y0, y1] = THIRD_BOUNDS[z.third]
          const rect = landscape ? transposeRect(x0, x1, y0, y1) : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
          const label = landscape
            ? transposePoint({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 })
            : { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
          const color = z.diff > 0 ? VERSUS_TEAM_COLORS.A.fill : VERSUS_TEAM_COLORS.B.fill
          const opacity = Math.abs(z.diff) >= 2 ? 0.32 : 0.16
          const isHighlighted = highlight?.kind === 'zone' && highlight.channel === z.channel && highlight.third === z.third
          return (
            <g key={`${z.channel}-${z.third}`}>
              <rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                fill={color}
                fillOpacity={opacity}
                stroke={color}
                strokeOpacity={0.9}
                strokeWidth={0.5}
              />
              {isHighlighted && (
                <motion.rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  fill="none"
                  stroke="#FACC15"
                  strokeWidth={1.2}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {showNumbers && (
                <g transform={`scale(${textScaleX} 1)`}>
                  <text
                    x={label.x / textScaleX}
                    y={label.y}
                    fill="#F8FAFC"
                    fontSize={2.4}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ paintOrder: 'stroke', fontFamily: PITCH_TEXT_FONT_FAMILY }}
                    stroke="#0F172A"
                    strokeWidth={0.4}
                    strokeOpacity={0.6}
                  >
                    {z.own}:{z.opp}
                  </text>
                </g>
              )}
            </g>
          )
        })}
    </g>
  )
}
