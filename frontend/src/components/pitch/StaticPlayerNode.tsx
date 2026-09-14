import { motion } from 'framer-motion'

import { transposePoint } from '@/lib/coords'
import { circularRadius, swapForLandscape } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { PITCH_TEXT_FONT_FAMILY, POSITION_LINE_COLORS, VERSUS_TEAM_COLORS } from '@/lib/theme'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Player, Point } from '@/types/analysis'

// PlayerNode(에디터)와 같은 지속시간·이징 — 공수 교대 버튼(TO-DO 28, 4번
// "부드러운 전환 효과")을 눌러도 마커가 순간이동하지 않고 모프한다.
const TRANSITION = { duration: PHASE_TRANSITION_MS / 1000, ease: [0.4, 0, 0.2, 1] as const }

interface StaticPlayerNodeProps {
  player: Player
  position: Point
  formation: string
  index: number
  /** A=홈(파랑), B=원정(마젠타) — lib/theme.ts VERSUS_TEAM_COLORS */
  variant: 'A' | 'B'
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용. position은 항상 원본(세로) 좌표계로 받는다. */
  orientation?: 'portrait' | 'landscape'
  /** 동적 라벨 배치(TO-DO 28, 1번)로 밀려난 만큼(기본 0) — 이름표 y에만 더해진다. 마커 자체는
   * 겹쳐도 그대로 둔다(2026-09-09 사용자 결정 — 스파이더파이어 대신 예전처럼). */
  labelYOffset?: number
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
}: StaticPlayerNodeProps) {
  const info = positionInfoAt(formation, index)
  const isGK = info?.line === 'GK'
  const team = VERSUS_TEAM_COLORS[variant]
  const landscape = orientation === 'landscape'
  const RADIUS = landscape ? LANDSCAPE_RADIUS : PORTRAIT_RADIUS
  const GK_RING_RADIUS = landscape ? GK_RING_RADIUS_LANDSCAPE : GK_RING_RADIUS_PORTRAIT
  const p = landscape ? transposePoint(position) : position

  return (
    <g>
      {isGK && (
        <motion.ellipse
          initial={{ cx: p.x, cy: p.y }}
          animate={{ cx: p.x, cy: p.y }}
          transition={TRANSITION}
          rx={GK_RING_RADIUS.rx}
          ry={GK_RING_RADIUS.ry}
          fill="#F8FAFC"
          fillOpacity={0.9}
        />
      )}
      <motion.ellipse
        initial={{ cx: p.x, cy: p.y }}
        animate={{ cx: p.x, cy: p.y }}
        transition={TRANSITION}
        rx={RADIUS.rx}
        ry={RADIUS.ry}
        fill={team.fill}
        stroke={variant === 'A' ? '#0F172A' : '#F8FAFC'}
        strokeOpacity={variant === 'A' ? 0.4 : 0.8}
        strokeWidth={variant === 'A' ? 0.3 : 0.5}
      />
      <motion.text
        initial={{ x: p.x, y: p.y }}
        animate={{ x: p.x, y: p.y }}
        transition={TRANSITION}
        fill={team.text}
        fontSize={2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
      >
        {player.number}
      </motion.text>
      <motion.text
        initial={{ x: p.x, y: p.y + RADIUS.ry + 3 + labelYOffset }}
        animate={{ x: p.x, y: p.y + RADIUS.ry + 3 + labelYOffset }}
        transition={TRANSITION}
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
  )
}
