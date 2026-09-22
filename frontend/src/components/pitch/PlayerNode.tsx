import { motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import { ANNOTATION_LINK_EPS, annotationSamplePoints, travelTimes } from '@/lib/annotations'
import { clampCoord, pagePointToPitch } from '@/lib/coords'
import { circularRadius } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { findTacticalRole } from '@/lib/tacticalRoles'
import { PITCH_TEXT_FONT_FAMILY, PLAYER_COLORS, POSITION_LINE_COLORS } from '@/lib/theme'
import { getActivePhaseData, PHASE_TRANSITION_MS, useAnalysisStore } from '@/store/analysisStore'
import type { Player, Point } from '@/types/analysis'

import { usePitchSvg } from './PitchContext'

interface PlayerNodeProps {
  player: Player
  position: Point
}

const OWN_RADIUS = circularRadius(PLAYER_COLORS.own.radius)
// 선수 수정 다이얼로그가 열려 있는 동안 그 선수를 표시하는 얇은 링(2026-09-11
// "선수 노드 주변에 생기는 검은색흰색 원이 너무 두툼해") — 브라우저 기본
// 포커스 아웃라인 대신 이 얇은 SVG 링으로 대체한다. 원인: Pan 제스처가 있는
// motion.g에 Framer Motion이 자동으로 tabindex=0을 붙이는데, 탭하는 순간
// 그 g가 포커스를 받아 Safari 기본 포커스 링(두꺼운 이중 테두리)이 그려졌다.
const SELECT_RING_RADIUS = circularRadius(PLAYER_COLORS.own.radius + 0.7)
const RUN_LOOP_DURATION = 0.9 // 오버랩 구간 전진에 걸리는 시간(초)
const RUN_LOOP_DELAY = 0.5 // 전진 끝점에서 리셋 전까지 머무는 시간(초)

/**
 * key는 항상 player.id여야 한다 (배열 인덱스 금지) — 2단계 §8, 4단계 §5.1.
 * 국면 전환 시 이 규칙이 깨지면 선수들이 서로 자리를 바꾸는 애니메이션이 나온다.
 *
 * 위치는 <motion.g>의 transform(x/y)이 아니라 각 도형의 네이티브 SVG 속성
 * (ellipse의 cx/cy, text의 x/y)을 직접 animate한다. g의 transform은 SVG
 * 좌표계가 아니라 렌더링된 CSS 픽셀 기준으로 적용되어(이 프로젝트처럼
 * viewBox와 실제 렌더 크기가 다른 경우) 화면 밖으로 어긋난다.
 *
 * onTap은 드래그(pan) 없이 짧게 누른 경우에만 발생한다 — 선수 클릭 편집
 * 다이얼로그(TO-DO 13번)의 입력점. 그리기 모드에서는 DrawOverlay가 입력을
 * 가로채 여기까지 오지 않는다.
 *
 * 노드 색은 포지션 라인별로 칠한다(2026-09-01 사용자 요청 — GK 노랑/DF 파랑/
 * MF 초록/FW 빨강). 라인·포지션 코드는 포메이션 이름과 players 순서에서
 * 자동 도출하며(lib/positions.ts), 도출 불가 시 기존 단색으로 폴백한다.
 *
 * 원 위 라벨은 전술 역할이 지정돼 있으면 역할 이름, 없으면 포지션 코드를
 * 보여준다(2026-09-07 — "필드에서도 역할이 한눈에 보이게"). 역할이 포지션도
 * 함축하므로 둘 다 표시하지 않는다.
 *
 * === run 화살표의 의미(2026-09-08, 5차 재정의) ===
 * 화살표는 "기본 포메이션에서 이 국면 포메이션으로 어떻게 이동했는가"가
 * 아니라, "이 국면의 포메이션 위치(position)에 도착한 뒤, 거기서 추가로
 * 어느 방향으로 움직이는가"를 나타낸다 — 예: 풀백이 윙백 자리(포메이션
 * 위치)까지 온 다음 거기서 더 높은 곳으로 오버래핑하거나, 미드필더가
 * 수비형 미드필더 자리까지 내려온 다음 센터백 사이로 더 내려가 빌드업에
 * 가담하는 것. 전진/후퇴 등 방향은 제한하지 않는다 — 화살표의 from이
 * position과 가까우면(ANNOTATION_LINK_EPS) 매칭한다(화살표는 선수에
 * 부착되지 않는 자유 좌표라 ID로 연결할 수 없다, 4단계 §5.1).
 *
 * 이 추가 움직임은 실제 포메이션 데이터(position)를 바꾸는 게 아니라
 * "이 자리에서 이런 패턴의 움직임을 보인다"는 예시 동작이므로, 국면이
 * 유지되는 동안 반복한다. 단, "왕복"(부드러운 역재생)은 명시적으로
 * 거부됐다 — 전진했다가 시작점으로 부드럽게 되감는 대신, 전진 → 끝점에서
 * 잠깐 머묾 → 순간적으로(역재생 없이) 시작점으로 리셋 → 다시 전진을
 * 반복한다(Framer Motion의 repeatType 기본값인 'loop'가 정확히 이 동작이다
 * — 'reverse'와 달리 매 반복을 keyframes[0]부터 다시 재생한다).
 *
 * 시퀀싱: 국면이 바뀌면 먼저 이 선수는 항상 position까지 평범하게 모프한다
 * (0.6초, PHASE_TRANSITION_MS와 동일 — 화살표가 있든 없든 모든 선수가
 * 거치는 공통 경로). 화살표가 매칭되면 그 모프가 끝나는 시점(같은
 * PHASE_TRANSITION_MS 뒤)에만 반복 루프를 "장전"해 cx/cy의 animate 대상을
 * 단일 값에서 좌표 배열로 바꾼다 — 정확히 position에 도착해 있는 상태에서
 * 배열 첫 값도 position이므로 전환 시 스냅(순간 이동)이 생기지 않는다.
 * 이렇게 두 단계로 나눈 이유: Framer Motion이 배열 target으로 바뀔 때
 * 배열의 첫 값을 "그 시점에 즉시 도달해야 하는 값"으로 취급하는 것으로
 * 보여(현재 렌더링 값과 다르면 순간이동할 위험), 배열로 전환하는 시점의
 * 실제 렌더링 값이 이미 position과 같도록 미리 모프를 끝내둔다.
 *
 * 압박 라인을 드래그하는 동안(2026-09-08)도 이 선수 자신을 드래그할 때와
 * 똑같이 즉시(0초) 반영한다 — `isPressingLineDragging`(스토어)이 켜져
 * 있으면 국면 전환 모프(0.6초)를 건너뛴다. 안 그러면 압박 라인을 당기는
 * 손가락/커서보다 선수가 한 박자 늦게 쫓아오는 것처럼 보인다(실측: 클릭
 * 400ms 뒤에도 아직 모프 중간값이었다).
 */
export function PlayerNode({ player, position }: PlayerNodeProps) {
  const svgRef = usePitchSvg()
  const prefersReducedMotion = useReducedMotion()
  const movePlayer = useAnalysisStore((s) => s.movePlayer)
  const setEditingPlayer = useAnalysisStore((s) => s.setEditingPlayer)
  const isEditing = useAnalysisStore((s) => s.editingPlayerId === player.id)
  const index = useAnalysisStore((s) => s.analysis?.players.findIndex((p) => p.id === player.id) ?? -1)
  const formation = useAnalysisStore((s) => s.analysis?.formation)
  const isPressingLineDragging = useAnalysisStore((s) => s.isPressingLineDragging)
  // "지금 보이는 곳"은 체인징 포인트가 선택돼 있으면 그쪽이 우선이다(국면 탭의
  // currentPhase는 체인징 포인트를 골라도 안 바뀐다) — getActivePhaseData가
  // EditorPage가 화면에 실제로 그리는 phase와 똑같이 판단한다. 예전엔
  // `s.analysis.phases[s.currentPhase]`만 봐서, 체인징 포인트를 보고 있을 땐
  // (currentPhase가 보통 'base'로 남아 있으므로) 아래 조건에 걸려 run 화살표가
  // 전혀 매칭되지 않는 버그가 있었다(2026-09-09 발견).
  const runAnnotations = useAnalysisStore((s) => {
    if (!s.analysis) return undefined
    // 기본 국면(체인징 포인트 미선택)은 포메이션만 보여주는 정지 상태여야
    // 하므로 애초에 조회하지 않는다 — "기본 국면에서는 화살표방향으로
    // 움직이지 않고... 가만히".
    if (s.currentPhase === 'base' && !s.selectedChangingPointId) return undefined
    return getActivePhaseData(s.analysis, s.currentPhase, s.selectedChangingPointId).annotations.filter(
      (a) => a.type === 'run',
    )
  })
  const [dragging, setDragging] = useState(false)
  const instant = dragging || isPressingLineDragging
  const transition = instant ? { duration: 0 } : { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const }
  const info = formation ? positionInfoAt(formation, index) : null
  const lineColor = info ? POSITION_LINE_COLORS[info.line] : null
  // 전술 역할이 지정돼 있으면 포지션 코드(LB, CB…) 대신 역할 이름을 원 위에
  // 보여준다 — "필드에서도 역할이 한눈에 보이게" 피드백(2026-09-07). 역할이
  // 포지션 정보를 이미 함축하므로(예: 타겟 포워드=ST) 코드와 나란히 두지
  // 않고 대체한다. 역할 라벨이 코드보다 길어서 폰트를 한 단계 줄인다.
  const role = findTacticalRole(player.tacticalRole)
  const topLabel = role?.label ?? info?.label
  const topLabelFontSize = role ? 1.4 : 1.7

  // 이 국면의 포메이션 위치(position)에서 시작하는 run 화살표 — from으로
  // 찾는다(도착이 아니라 "여기서부터 추가로 움직인다"는 뜻이므로).
  const runMatchId = useMemo(() => {
    const arrow = runAnnotations?.find((a) => Math.hypot(a.from.x - position.x, a.from.y - position.y) <= ANNOTATION_LINK_EPS)
    return arrow?.id ?? null
  }, [runAnnotations, position])

  const runPoints = useMemo(() => {
    const arrow = runAnnotations?.find((a) => a.id === runMatchId)
    if (!arrow) return null
    // 첫 점을 정확히 position으로 고정 — 손으로 그린 화살표의 from이 position과
    // 완벽히 일치하지 않을 수 있는데, 그대로 쓰면 루프가 장전되는 순간
    // 몇 유닛 순간이동하는 것처럼 보인다.
    const [, ...rest] = annotationSamplePoints(arrow)
    return [position, ...rest]
  }, [runAnnotations, runMatchId, position])

  // 화살표가 매칭되면 국면 전환 모프(PHASE_TRANSITION_MS)가 끝난 뒤에만
  // 반복 루프를 장전한다 — 위 문서 주석의 "시퀀싱" 참고.
  const [runArmed, setRunArmed] = useState(false)
  useEffect(() => {
    setRunArmed(false)
    if (!runMatchId || instant) return
    const timer = setTimeout(() => setRunArmed(true), PHASE_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [runMatchId, instant])

  const active = runArmed && runPoints && !instant
  // 왕복(부드러운 역재생) 대신 매 반복을 처음부터 다시 재생 — repeatType
  // 기본값 'loop'가 이 동작이다("전진하고 다시 깜빡해서 돌아왔다가 다시 전진").
  // prefers-reduced-motion(2026-09-22, 개선 로드맵 §6.4) — 반복 자체를
  // 없애지 않고 무한 반복(repeat: Infinity)만 뺀다. 이 애니메이션은 "이
  // 선수가 어디로 움직이는지"를 보여주는 정보 전달용이라, 한 번 재생은
  // 유지하는 쪽이 완전히 정지시키는 것보다 낫다 — 계속 반복되는 움직임만
  // 전정기관 문제를 유발할 수 있다는 reduced-motion의 취지에 맞춘다.
  const runTransition = active
    ? {
        duration: RUN_LOOP_DURATION,
        times: travelTimes(runPoints!),
        ease: 'easeInOut' as const,
        ...(prefersReducedMotion ? {} : { repeat: Infinity, repeatDelay: RUN_LOOP_DELAY }),
      }
    : null
  const activeTransition = instant ? { duration: 0 } : (runTransition ?? transition)
  const cx = active ? runPoints!.map((p) => p.x) : position.x
  const cy = active ? runPoints!.map((p) => p.y) : position.y

  const handlePan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!svgRef.current) return
    const next = pagePointToPitch(svgRef.current, info.point.x, info.point.y)
    movePlayer(player.id, clampCoord(next.x), clampCoord(next.y))
  }

  return (
    <motion.g
      onPanStart={() => setDragging(true)}
      onPan={handlePan}
      onPanEnd={() => setDragging(false)}
      onTap={() => setEditingPlayer(player.id)}
      style={{ cursor: 'grab', touchAction: 'none', outline: 'none' }}
    >
      {isEditing && (
        <motion.ellipse
          initial={{ cx: position.x, cy: position.y }}
          animate={{ cx, cy }}
          transition={activeTransition}
          rx={SELECT_RING_RADIUS.rx}
          ry={SELECT_RING_RADIUS.ry}
          fill="none"
          stroke="hsl(var(--ring))"
          strokeWidth={0.35}
        />
      )}
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
          style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
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
        style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
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
        style={{ userSelect: 'none', paintOrder: 'stroke', fontFamily: PITCH_TEXT_FONT_FAMILY }}
        stroke="#0F172A"
        strokeWidth={0.35}
        strokeOpacity={0.55}
      >
        {player.name}
      </motion.text>
    </motion.g>
  )
}
