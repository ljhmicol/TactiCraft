import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { ANNOTATION_LINK_EPS, annotationSamplePoints, travelTimes } from '@/lib/annotations'
import { circularRadius } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { findTacticalRole } from '@/lib/tacticalRoles'
import { PLAYER_COLORS, POSITION_LINE_COLORS } from '@/lib/theme'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Annotation, Player, Point } from '@/types/analysis'

interface SharePlayerNodeProps {
  player: Player
  position: Point
  formation: string
  index: number
  /** 이 국면(또는 체인징 포인트)의 run 화살표만 — 기본 국면일 땐 호출부가
   * undefined를 넘겨 애초에 움직이지 않게 한다(에디터의 PlayerNode와 동일 규칙). */
  runAnnotations?: Annotation[]
}

const OWN_RADIUS = circularRadius(PLAYER_COLORS.own.radius)
const RUN_LOOP_DURATION = 0.9
const RUN_LOOP_DELAY = 0.5

/**
 * 공유 링크(`/share/:id`, TO-DO 8번) 전용 읽기 전용 노드. `PrintPlayerNode`
 * (GIF 프레임 캡처용, 완전 정지)와 달리 여기서는 run 화살표 반복 루프
 * 애니메이션을 그대로 재현한다 — "공유 링크에서는 화살표 방향으로 안
 * 움직이네" 피드백(2026-09-09). GIF 캡처는 프레임을 결정론적으로 정지시켜야
 * 해서 애니메이션이 있으면 안 되므로, 그 파일은 건드리지 않고 별도로 뒀다.
 *
 * 드래그·클릭 편집이 없다는 점만 빼면 `PlayerNode`의 run-loop 로직과
 * 같다(store 의존성만 제거 — 여긴 "지금 편집 중인 분석"이 아니라 남이 저장한
 * 분석을 보여준다).
 */
export function SharePlayerNode({ player, position, formation, index, runAnnotations }: SharePlayerNodeProps) {
  const transition = { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const }
  const info = positionInfoAt(formation, index)
  const lineColor = info ? POSITION_LINE_COLORS[info.line] : null
  const role = findTacticalRole(player.tacticalRole)
  const topLabel = role?.label ?? info?.label
  const topLabelFontSize = role ? 1.4 : 1.7

  const runMatchId = useMemo(() => {
    const arrow = runAnnotations?.find(
      (a) => a.type === 'run' && Math.hypot(a.from.x - position.x, a.from.y - position.y) <= ANNOTATION_LINK_EPS,
    )
    return arrow?.id ?? null
  }, [runAnnotations, position])

  const runPoints = useMemo(() => {
    const arrow = runAnnotations?.find((a) => a.id === runMatchId)
    if (!arrow) return null
    const [, ...rest] = annotationSamplePoints(arrow)
    return [position, ...rest]
  }, [runAnnotations, runMatchId, position])

  const [runArmed, setRunArmed] = useState(false)
  useEffect(() => {
    setRunArmed(false)
    if (!runMatchId) return
    const timer = setTimeout(() => setRunArmed(true), PHASE_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [runMatchId])

  const active = runArmed && runPoints
  const runTransition = active
    ? {
        duration: RUN_LOOP_DURATION,
        times: travelTimes(runPoints!),
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatDelay: RUN_LOOP_DELAY,
      }
    : null
  const activeTransition = runTransition ?? transition
  const cx = active ? runPoints!.map((p) => p.x) : position.x
  const cy = active ? runPoints!.map((p) => p.y) : position.y

  return (
    <g>
      <motion.ellipse
        initial={{ cx: position.x, cy: position.y }}
        animate={{ cx, cy }}
        transition={activeTransition}
        rx={OWN_RADIUS.rx}
        ry={OWN_RADIUS.ry}
        fill={lineColor?.fill ?? PLAYER_COLORS.own.fill}
        stroke={PLAYER_COLORS.own.stroke}
        strokeOpacity={PLAYER_COLORS.own.strokeOpacity}
        strokeWidth={0.3}
      />
      {topLabel && (
        <motion.text
          initial={{ x: position.x, y: position.y - OWN_RADIUS.ry - 1.4 }}
          animate={{
            x: cx,
            y: active ? runPoints!.map((p) => p.y - OWN_RADIUS.ry - 1.4) : position.y - OWN_RADIUS.ry - 1.4,
          }}
          transition={activeTransition}
          fill={PLAYER_COLORS.own.fill}
          fillOpacity={0.9}
          fontSize={topLabelFontSize}
          textAnchor="middle"
          style={{ userSelect: 'none' }}
        >
          {topLabel}
        </motion.text>
      )}
      <motion.text
        initial={{ x: position.x, y: position.y }}
        animate={{ x: cx, y: cy }}
        transition={activeTransition}
        fill={lineColor?.text ?? PLAYER_COLORS.own.text}
        fontSize={2.4}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ userSelect: 'none' }}
      >
        {player.number}
      </motion.text>
      <motion.text
        initial={{ x: position.x, y: position.y + OWN_RADIUS.ry + 3 }}
        animate={{
          x: cx,
          y: active ? runPoints!.map((p) => p.y + OWN_RADIUS.ry + 3) : position.y + OWN_RADIUS.ry + 3,
        }}
        transition={activeTransition}
        fill="#F8FAFC"
        fontSize={2}
        fontWeight={700}
        textAnchor="middle"
        style={{ userSelect: 'none', paintOrder: 'stroke' }}
        stroke="#0F172A"
        strokeWidth={0.35}
        strokeOpacity={0.55}
      >
        {player.name}
      </motion.text>
    </g>
  )
}
