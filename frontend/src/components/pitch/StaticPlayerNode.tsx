import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { travelTimes } from '@/lib/annotations'
import { transposePoint } from '@/lib/coords'
import { circularRadius, LANDSCAPE_TEXT_X_SCALE, swapForLandscape } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { PITCH_TEXT_FONT_FAMILY, POSITION_LINE_COLORS, VERSUS_TEAM_COLORS } from '@/lib/theme'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Player, Point } from '@/types/analysis'

// PlayerNode(에디터)와 같은 지속시간·이징 — 공수 교대 버튼(TO-DO 28, 4번
// "부드러운 전환 효과")을 눌러도 마커가 순간이동하지 않고 모프한다.
const TRANSITION = { duration: PHASE_TRANSITION_MS / 1000, ease: [0.4, 0, 0.2, 1] as const }

// 에디터 PlayerNode(RUN_LOOP_DURATION 0.9초)보다 느리게 — "선수들이
// 천천히 계속 움직이면 좋겠어"(TO-DO 48). 대결 뷰는 22명이 동시에
// 도는 화면이라, 에디터 속도 그대로면 산만하다.
const RUN_LOOP_DURATION = 2.6
const RUN_LOOP_DELAY = 0.9

interface StaticPlayerNodeProps {
  player: Player
  position: Point
  formation: string
  index: number
  /** A=홈(파랑), B=원정(빨강) — lib/theme.ts VERSUS_TEAM_COLORS */
  variant: 'A' | 'B'
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용. position은 항상 원본(세로) 좌표계로 받는다. */
  orientation?: 'portrait' | 'landscape'
  /** 동적 라벨 배치(TO-DO 28, 1번)로 밀려난 만큼(기본 0) — 이름표 y에만 더해진다. 마커 자체는
   * 겹쳐도 그대로 둔다(2026-09-09 사용자 결정 — 스파이더파이어 대신 예전처럼). */
  labelYOffset?: number
  /** 이 선수 위치에서 시작하는 run 화살표의 반복 이동 경로(원본 좌표계,
   * lib/matchup.ts의 findRunPoints) — 없으면 정지. TO-DO 48. */
  runPoints?: Point[] | null
  /** 기본 true. false면 runPoints가 있어도 애니메이션하지 않는다 — PNG 카드
   * (VersusShareCard)는 고정 프레임 한 장이라, 도는 도중 한 프레임을 그대로
   * 찍으면 라벨이 궤적 중간 어딘가에 떠 있는 것처럼 보일 수 있다(패스 공은
   * "경로 위 어딘가"가 자연스럽지만, 선수 마커+글자는 궤적에서 떨어져
   * 보이면 렌더링 버그처럼 읽힐 위험이 있어 export에서는 껐다). */
  animated?: boolean
}

// 22명이 한 피치에 겹치는 대결 뷰 전용 축소 반지름(TO-DO 36) — 에디터의
// PLAYER_COLORS.own.radius(2.6)와는 별개로 이 파일에서만 줄인다.
const PORTRAIT_RADIUS = circularRadius(2.1)
// 라벨 배치 계산(MatchupView, TO-DO 28)이 이 마커 반지름과 일치해야 해서
// export한다 — 값이 어긋나면 라벨 겹침 판정이 실제 렌더링과 안 맞게 된다.
export const LANDSCAPE_RADIUS = swapForLandscape(PORTRAIT_RADIUS)
const GK_RING_RADIUS_PORTRAIT = circularRadius(2.6)
const GK_RING_RADIUS_LANDSCAPE = swapForLandscape(GK_RING_RADIUS_PORTRAIT)

/**
 * 전술 대결 뷰(16번) 전용 읽기 전용 노드. PlayerNode/OpponentNode는
 * useAnalysisStore에서 현재 활성 분석의 formation/index/드래그 액션을
 * 끌어오는데, 대결 뷰의 두 분석은 둘 다 "활성 분석"이 아니므로 그 훅들을
 * 재사용하면 조용히 엉뚱한 데이터(또는 흰색 폴백)를 그리게 된다. 그래서
 * formation·index를 props로 직접 받는다.
 *
 * 색은 포지션 라인이 아니라 팀 단위로 칠한다 — 두 팀 다 같은 포지션
 * 팔레트(GK 노랑/DF 파랑…)를 쓰면 "다 같은 팀 선수 같다"는 문제가 생겼다
 * (2026-09-07 사용자 피드백). 실제 골키퍼 유니폼이 필드 플레이어와 다른
 * 것처럼, GK만 팀 색 위에 흰 링을 하나 더 둘러 구분한다.
 *
 * (TO-DO 36) 위 결정은 "마커 색"에 한정된다 — 이름표 앞에 붙는 포지션
 * 코드(FW/MF/…)는 POSITION_LINE_COLORS로 칠한다. 마커 자체는 여전히 팀
 * 색이라 두 팀 구분은 그대로 유지되고, 라벨의 포지션 코드만 어느 라인
 * 선수인지 한눈에 보여주는 별개의 추가 정보다.
 */
export function StaticPlayerNode({
  player,
  position,
  formation,
  index,
  variant,
  orientation = 'portrait',
  labelYOffset = 0,
  runPoints = null,
  animated = true,
}: StaticPlayerNodeProps) {
  const info = positionInfoAt(formation, index)
  const isGK = info?.line === 'GK'
  const team = VERSUS_TEAM_COLORS[variant]
  const landscape = orientation === 'landscape'
  const RADIUS = landscape ? LANDSCAPE_RADIUS : PORTRAIT_RADIUS
  const GK_RING_RADIUS = landscape ? GK_RING_RADIUS_LANDSCAPE : GK_RING_RADIUS_PORTRAIT
  const p = landscape ? transposePoint(position) : position
  // 글자 가로 비율 보정(TO-DO 39) — <text>는 rx/ry 같은 축별 보정이 없어서
  // 대신 앵커를 감싼 <g>에 scale(textScaleX, 1)을 걸고, 그만큼 넓어지거나
  // 좁아질 x를 미리 나눠서(textX) 최종 화면 위치는 그대로 유지한다.
  // portrait에서는 textScaleX가 1이라 사실상 무보정(lib/pitchMarkings.ts 참조).
  const textScaleX = landscape ? LANDSCAPE_TEXT_X_SCALE : 1
  const textX = p.x / textScaleX

  // run 반복 이동(TO-DO 48, "선수들이 천천히 계속 움직이면 좋겠어") —
  // 에디터 PlayerNode와 같은 두 단계 장전: 국면 전환 모프(TRANSITION)가
  // 끝난 뒤에만 배열 target으로 바꿔야, 그 시점의 실제 렌더링 값이 이미
  // position과 같아서 순간이동이 안 생긴다.
  const [runArmed, setRunArmed] = useState(false)
  useEffect(() => {
    setRunArmed(false)
    if (!animated || !runPoints) return
    const timer = setTimeout(() => setRunArmed(true), PHASE_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [animated, runPoints])

  const active = animated && runArmed && !!runPoints
  // runPoints는 원본(세로) 좌표계로 온다 — landscape면 각 점을 개별 transpose한다.
  const pPoints = active ? (landscape ? runPoints!.map(transposePoint) : runPoints!) : null
  const runTransition = active
    ? {
        duration: RUN_LOOP_DURATION,
        times: travelTimes(pPoints!),
        ease: 'easeInOut' as const,
        // 왕복(부드러운 역재생) 대신 매 반복을 처음부터 다시 재생 — PlayerNode와
        // 같은 이유(repeatType 기본값 'loop'가 이 동작).
        repeat: Infinity,
        repeatDelay: RUN_LOOP_DELAY,
      }
    : null
  const activeTransition = runTransition ?? TRANSITION
  const cx = active ? pPoints!.map((pt) => pt.x) : p.x
  const cy = active ? pPoints!.map((pt) => pt.y) : p.y
  const xArr = active ? pPoints!.map((pt) => pt.x / textScaleX) : textX
  const labelYArr = active ? pPoints!.map((pt) => pt.y + RADIUS.ry + 3 + labelYOffset) : p.y + RADIUS.ry + 3 + labelYOffset

  return (
    <g>
      {isGK && (
        <motion.ellipse
          initial={{ cx: p.x, cy: p.y }}
          animate={{ cx, cy }}
          transition={activeTransition}
          rx={GK_RING_RADIUS.rx}
          ry={GK_RING_RADIUS.ry}
          fill="#F8FAFC"
          fillOpacity={0.9}
        />
      )}
      <motion.ellipse
        initial={{ cx: p.x, cy: p.y }}
        animate={{ cx, cy }}
        transition={activeTransition}
        rx={RADIUS.rx}
        ry={RADIUS.ry}
        fill={team.fill}
        stroke="#0F172A"
        strokeOpacity={0.4}
        strokeWidth={0.3}
      />
      <g transform={`scale(${textScaleX} 1)`}>
        <motion.text
          initial={{ x: textX, y: p.y }}
          animate={{ x: xArr, y: cy }}
          transition={activeTransition}
          fill={team.text}
          fontSize={2}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
        >
          {player.number}
        </motion.text>
      </g>
      <g transform={`scale(${textScaleX} 1)`}>
        <motion.text
          initial={{ x: textX, y: p.y + RADIUS.ry + 3 + labelYOffset }}
          animate={{ x: xArr, y: labelYArr }}
          transition={activeTransition}
          fontSize={1.7}
          fontWeight={700}
          textAnchor="middle"
          style={{ userSelect: 'none', paintOrder: 'stroke', fontFamily: PITCH_TEXT_FONT_FAMILY }}
          stroke="#0F172A"
          strokeWidth={0.35}
          strokeOpacity={0.55}
        >
          {info && <tspan fill={POSITION_LINE_COLORS[info.line].fill}>{info.line}</tspan>}
          <tspan fill="#F8FAFC">{player.name}</tspan>
        </motion.text>
      </g>
    </g>
  )
}
