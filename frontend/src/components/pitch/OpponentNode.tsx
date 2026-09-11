import { motion, type PanInfo } from 'framer-motion'
import { useState } from 'react'

import { clampCoord, pagePointToPitch } from '@/lib/coords'
import { circularRadius } from '@/lib/pitchMarkings'
import { PLAYER_COLORS } from '@/lib/theme'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Point } from '@/types/analysis'

import { usePitchSvg } from './PitchContext'

interface OpponentNodeProps {
  slot: number
  position: Point
}

const OPP_RADIUS = circularRadius(PLAYER_COLORS.opponent.radius)

/**
 * 상대팀은 개별 식별자가 없으므로 slot 인덱스를 key로 쓴다 (4단계 §5.1의
 * 예외 규칙 — 자팀 PlayerNode와 달리 허용된다). 위치는 ellipse의 cx/cy를
 * 직접 animate한다 (PlayerNode와 동일한 이유 — g의 transform 대신).
 */
export function OpponentNode({ slot, position }: OpponentNodeProps) {
  const svgRef = usePitchSvg()
  const moveOpponent = useAnalysisStore((s) => s.moveOpponent)
  const [dragging, setDragging] = useState(false)
  const transition = dragging ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const }

  const handlePan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!svgRef.current) return
    const next = pagePointToPitch(svgRef.current, info.point.x, info.point.y)
    moveOpponent(slot, clampCoord(next.x), clampCoord(next.y))
  }

  return (
    <motion.g onPanStart={() => setDragging(true)} onPan={handlePan} onPanEnd={() => setDragging(false)} style={{ cursor: 'grab', touchAction: 'none' }}>
      <motion.ellipse
        initial={{ cx: position.x, cy: position.y }}
        animate={{ cx: position.x, cy: position.y }}
        transition={transition}
        rx={OPP_RADIUS.rx}
        ry={OPP_RADIUS.ry}
        fill={PLAYER_COLORS.opponent.fill}
        fillOpacity={PLAYER_COLORS.opponent.fillOpacity}
      />
    </motion.g>
  )
}
