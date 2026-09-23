import { motion, type PanInfo } from 'framer-motion'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'

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
const SELECT_RING_RADIUS = circularRadius(PLAYER_COLORS.opponent.radius + 0.7)
// 키보드 이동(개선 로드맵 §6.4, 2026-09-22) — PlayerNode.tsx와 같은 값.
const KEYBOARD_STEP_FINE = 1
const KEYBOARD_STEP_COARSE = 5

/**
 * 상대팀은 개별 식별자가 없으므로 slot 인덱스를 key로 쓴다 (4단계 §5.1의
 * 예외 규칙 — 자팀 PlayerNode와 달리 허용된다). 위치는 ellipse의 cx/cy를
 * 직접 animate한다 (PlayerNode와 동일한 이유 — g의 transform 대신).
 *
 * PlayerNode와 달리 편집 다이얼로그가 없다(상대 선수는 이름·역할 같은
 * 편집 가능한 정보 자체가 없음) — 그래서 키보드 지원도 이동만 있고
 * Enter로 여는 동작은 없다.
 */
export function OpponentNode({ slot, position }: OpponentNodeProps) {
  const svgRef = usePitchSvg()
  const moveOpponent = useAnalysisStore((s) => s.moveOpponent)
  const announce = useAnalysisStore((s) => s.announce)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const transition = dragging ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const }

  const handlePan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!svgRef.current) return
    const next = pagePointToPitch(svgRef.current, info.point.x, info.point.y)
    moveOpponent(slot, clampCoord(next.x), clampCoord(next.y))
  }

  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    const step = e.shiftKey ? KEYBOARD_STEP_COARSE : KEYBOARD_STEP_FINE
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else return
    e.preventDefault()
    const nx = clampCoord(position.x + dx)
    const ny = clampCoord(position.y + dy)
    moveOpponent(slot, nx, ny)
    announce(`상대 선수 ${slot + 1}, x ${nx.toFixed(1)}, y ${ny.toFixed(1)}로 이동`)
  }

  return (
    <motion.g
      tabIndex={0}
      role="button"
      aria-label={`상대 선수 ${slot + 1}. 방향키로 이동, Shift+방향키로 크게 이동.`}
      onKeyDown={handleKeyDown}
      // :focus-visible로 걸러야 한다 — PlayerNode.tsx와 같은 이유(드래그만
      // 해도 브라우저가 포커스를 줘서 링이 눌어붙는 문제, 2026-09-23).
      onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      onPanStart={() => setDragging(true)}
      onPan={handlePan}
      onPanEnd={() => setDragging(false)}
      style={{ cursor: 'grab', touchAction: 'none', outline: 'none' }}
    >
      {focused && (
        <motion.ellipse
          initial={{ cx: position.x, cy: position.y }}
          animate={{ cx: position.x, cy: position.y }}
          transition={transition}
          rx={SELECT_RING_RADIUS.rx}
          ry={SELECT_RING_RADIUS.ry}
          fill="none"
          stroke="hsl(var(--ring))"
          strokeWidth={0.35}
        />
      )}
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
