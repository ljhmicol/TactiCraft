import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

import {
  ANNOTATION_STYLES,
  arrowGeometry,
  arrowMidpoint,
  buildPassChains,
  chainBallDuration,
  chainSamplePoints,
  curvedArrowGeometry,
  travelTimes,
} from '@/lib/annotations'
import { PITCH_TEXT_FONT_FAMILY, PLAYER_COLORS } from '@/lib/theme'
import { circularRadius } from '@/lib/pitchMarkings'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Annotation } from '@/types/analysis'

interface AnnotationLayerProps {
  annotations: Annotation[]
  /** 편집기에서만 전달 — 클릭 선택/삭제. ShareCard 등 정적 렌더링은 생략한다 */
  interactive?: {
    selectedId: string | null
    onSelect: (id: string) => void
    onRemove: (id: string) => void
  }
  /**
   * 기본 true — false면 패스 공(PassChainBall)을 그리지 않고 화살표만
   * 정적으로 그린다. GIF 내보내기(TO-DO 6) 전용: 공 애니메이션은 실제
   * 벽시계 시간을 따라 도는데, GIF는 프레임을 실시간 재생이 아니라
   * 가상 시간으로 하나씩 캡처하다 보니(GifExportRunner) 캡처 사이사이
   * 공이 계속 따로 움직여서 "중간에 멈추거나 다음 국면으로 그대로
   * 넘어가 버리는" 것처럼 보였다(2026-09-08 사용자 리포트) — 애니메이션
   * 자체를 아예 렌더링하지 않는 쪽이 가상 시간 스테핑과 맞다.
   *
   * EditorPage는 병합된 시점의 스텝 재생이 끝나 요약 프레임에 정착했을 때도
   * false를 넘긴다 — 그 프레임의 annotations는 스텝들을 전부 이어붙인 하나의
   * 긴 체인이라, 공을 다시 애니메이션하면 이미 도착한 선수와 달리 공만
   * 전체 경로를 처음부터 다시 흐른다(2026-09-10 사용자 리포트).
   */
  animated?: boolean
  /**
   * 기본 false(한 번만 움직이고 도착점에 멈춤) — true면 공이 계속 반복해서
   * 흐른다(2026-09-14, "전술 대결에서 패스길에 공이 계속 움직이면 좋겠어").
   * 한 번만 재생하는 기본값은 2026-09-10에 편집기에서 발견된 두 가지 어긋남
   * (드리블 구간에서 선수는 멈췄는데 공만 왕복, 병합 시점 재생 사이 정지 중
   * 공만 왕복) 때문에 정착한 것인데, 둘 다 **살아있는 선수 모프·시점 스텝
   * 재생이 있는 컨텍스트**(편집기)에서만 나는 문제다. 전술 대결 뷰
   * (MatchupView)의 선수는 두 분석의 고정 스냅샷이라 이런 어긋남 자체가
   * 생길 수 없어서, 이 컨텍스트에서는 반복 재생이 안전하다 — 그래서 이
   * 스코프를 편집기 나머지 사용처(EditorPage/SharePage/ShareCard 등)는
   * 그대로 두고 MatchupView 호출부에서만 켠다.
   */
  loop?: boolean
}

const BADGE_RADIUS = circularRadius(1.7)
const DELETE_OFFSET = 2.2 // 선분 중점에서 화살표 진행 방향의 수직으로 치울 거리
const BALL_RADIUS = circularRadius(1.1)
// PlayerNode의 run 반복 루프(RUN_LOOP_DELAY)와 같은 값 — 도착점에서 잠깐
// 머문 뒤에 처음부터 다시 흐른다. 부드럽게 역재생(왕복)하지 않는 이유도
// 같다: 패스는 방향성이 있어서 거꾸로 흐르면 어색하다.
const BALL_LOOP_DELAY = 0.5

/**
 * 국면의 화살표(움직임/패스)를 그린다. 편집 화면과 PNG 카드(ShareCard)가 같은
 * 컴포넌트를 쓴다 — 데이터 기반 재렌더링이라 export에 자동으로 포함된다.
 *
 * 선분·화살촉은 preserveAspectRatio="none" 왜곡을 피하기 위해 lib/annotations의
 * 균일 축척 기하를 쓴다. 굵기는 기존 레이어(압박라인 0.5)와 같은 user-unit 관례를
 * 따른다 — 화면·카드 크기에 비례해 보인다.
 *
 * pass 화살표는 끝점이 이어지면(수비수→미드필더→공격수처럼) 하나의 공이
 * 전체 경로를 순서대로 흐르게 한다(buildPassChains, 2026-09-07 — "패스가
 * 수비수에서 미드필더로 가고, 공격수로 이어지게").
 *
 * run 화살표는 여기서 별도 유령을 그리지 않는다(2026-09-07, 2차 — "투명한
 * 원 말고 선수 노드 자체가 움직이게") — 실제 선수 노드(PlayerNode)가 자기
 * 시작점 근처에서 시작하는 run 화살표를 찾아 스스로 그 방향으로 왕복한다.
 * 화살표는 여기서 모양·클릭 판정만 그린다.
 */
export function AnnotationLayer({ annotations, interactive, animated = true, loop = false }: AnnotationLayerProps) {
  const passChains = useMemo(
    () => (animated ? buildPassChains(annotations.filter((a) => a.type === 'pass')) : []),
    [annotations, animated],
  )

  return (
    <g>
      {annotations.map((ann) => {
        const style = ANNOTATION_STYLES[ann.type]
        const curvedGeo = ann.curved ? curvedArrowGeometry(ann.from, ann.to) : null
        const straightGeo = curvedGeo ? null : arrowGeometry(ann.from, ann.to)
        const head = curvedGeo ? curvedGeo.head : straightGeo!.head
        const selected = interactive?.selectedId === ann.id
        return (
          <g key={ann.id} className={interactive ? 'cursor-pointer' : undefined}>
            {/* 클릭 판정용 투명 굵은 선 — 곡선도 대충 직선으로 잡아도 클릭 판정엔 충분하다 */}
            {interactive && (
              <line
                x1={ann.from.x}
                y1={ann.from.y}
                x2={ann.to.x}
                y2={ann.to.y}
                stroke="transparent"
                strokeWidth={3.5}
                pointerEvents="stroke"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  interactive.onSelect(ann.id)
                }}
              />
            )}
            {curvedGeo ? (
              <path
                d={curvedGeo.path}
                fill="none"
                stroke={style.stroke}
                strokeWidth={selected ? 0.7 : 0.5}
                strokeLinecap="round"
                strokeDasharray={style.dashed ? '1.6 1.2' : undefined}
                opacity={0.95}
                pointerEvents="none"
              />
            ) : (
              <line
                x1={ann.from.x}
                y1={ann.from.y}
                x2={straightGeo!.shaftEnd.x}
                y2={straightGeo!.shaftEnd.y}
                stroke={style.stroke}
                strokeWidth={selected ? 0.7 : 0.5}
                strokeLinecap="round"
                strokeDasharray={style.dashed ? '1.6 1.2' : undefined}
                opacity={0.95}
                pointerEvents="none"
              />
            )}
            <polygon
              points={head.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={style.stroke}
              opacity={0.95}
              pointerEvents="none"
            />
            {selected && interactive && <DeleteBadge annotation={ann} onRemove={interactive.onRemove} />}
          </g>
        );
      })}
      {passChains.map((chain) => (
        <PassChainBall key={chain.map((a) => a.id).join('-')} chain={chain} loop={loop} />
      ))}
    </g>
  )
}

/**
 * 연결된 패스 체인을 따라 흐르는 공 — "패스가 실제로 연결되는 걸 보여지게".
 * cx/cy를 직접 animate하는 방식은 PlayerNode와 같다 — preserveAspectRatio=
 * "none" 환경에서 g의 transform 대신 도형 고유 속성을 animate해야 어긋나지
 * 않는다. 구간마다 소요 시간을 실제 거리 비례로 배분한다(`travelTimes`) —
 * 안 그러면 짧은 구간과 긴 구간을 같은 시간에 지나가버려 부자연스럽다.
 * 구간이 2개 이상(체인)이면 각 꼭짓점에서 갑자기 느려지지 않도록 linear로,
 * 단일 구간이면 easeInOut으로 부드럽게 시작·끝난다.
 *
 * 딱 한 번만 움직이고 도착점에 멈춘다(2026-09-10, 이전엔 repeat: Infinity로
 * 계속 왕복했는데, 드리블(carry) 구간에서 선수는 한 번만 모프하고 멈추는데
 * 공만 계속 왕복해 "선수는 도착했는데 공이 한 번 더 움직인다"는 리포트,
 * 그리고 병합된 시점을 연속 재생할 때 각 스텝의 0.6~1.8초 사이 동안 선수는
 * 이미 멈춰 있는데 공만 계속 왕복해 "이후엔 선수는 가만히 있고 공만
 * 움직인다"는 리포트의 공통 원인이었다). PNG 캡처(ShareCard)는 애니메이션
 * 완료를 기다리지 않고 그 순간 상태를 그대로 찍는다(lib/exportImage.ts) —
 * "경로 위 어딘가(도착 직후엔 도착점)"는 정적 이미지로도 자연스러워 별도
 * 처리하지 않는다.
 *
 * 시퀀싱(2026-09-09, "패스 받을 선수가 미리 움직여져있고 받게" 요청 —
 * 시점을 잘게 쪼개는 대신 전환 애니메이션 자체를 늦추는 쪽으로 정정):
 * 시점(체인징 포인트)이 바뀌면 이 체인은 새 key로 다시 마운트되는데, 받는
 * 선수(PlayerNode)도 같은 순간부터 국면 전환 모프(PHASE_TRANSITION_MS)를
 * 시작한다. 공이 즉시 출발하면 "선수는 아직 이동 중인데 공이 먼저 도착"하는
 * 것처럼 보이므로, PlayerNode의 runArmed와 같은 패턴으로 공도
 * PHASE_TRANSITION_MS만큼 정지해 있다가(시작점에 가만히) 그 뒤에 출발한다 —
 * 받을 선수가 자리를 잡은 뒤에 패스가 오는 순서가 된다.
 */
function PassChainBall({ chain, loop }: { chain: Annotation[]; loop: boolean }) {
  const points = chainSamplePoints(chain)
  // 드리블(carry)로 시작하는 체인은 기다리지 않는다 — 공을 몰고 가는 선수
  // 자신이 같은 순간 같은 방향으로 모프하므로, 대기를 두면 선수가 먼저
  // 도착한 뒤에 공이 따라가 "자기한테 패스하는" 모양이 된다(2026-09-10).
  const carried = chain[0]?.carry === true
  const [armed, setArmed] = useState(carried)

  useEffect(() => {
    if (carried) {
      setArmed(true)
      return
    }
    setArmed(false)
    const timer = setTimeout(() => setArmed(true), PHASE_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [carried])

  if (points.length < 2) return null
  // 구간 수는 점 개수가 아니라 화살표 개수다 — 곡선 화살표는 베지어 8점으로
  // 샘플링되므로 점으로 세면 곡선 패스 하나가 8배 느려진다(chainBallDuration).
  const segments = chain.length

  return (
    <motion.ellipse
      rx={BALL_RADIUS.rx}
      ry={BALL_RADIUS.ry}
      fill="#F8FAFC"
      stroke="#0F172A"
      strokeWidth={0.25}
      strokeOpacity={0.6}
      pointerEvents="none"
      initial={{ cx: points[0].x, cy: points[0].y }}
      animate={armed ? { cx: points.map((p) => p.x), cy: points.map((p) => p.y) } : { cx: points[0].x, cy: points[0].y }}
      transition={
        armed
          ? {
              duration: chainBallDuration(chain),
              times: travelTimes(points),
              ease: segments > 1 ? 'linear' : 'easeInOut',
              // loop=false(기본)면 딱 한 번만 재생하고 도착점에 멈춘다 — 위
              // 함수 doc 참고. loop=true면 도착점에서 잠깐 머물다 처음부터
              // 다시 흐른다(repeatType 기본값 'loop' — PlayerNode의 run
              // 반복과 같은 패턴, 역재생 없이 매번 처음부터).
              ...(loop ? { repeat: Infinity, repeatDelay: BALL_LOOP_DELAY } : {}),
            }
          : { duration: 0 }
      }
    />
  )
}

/** 선택된 화살표 중점 옆의 ✕ 배지 — 누르면 삭제한다. */
function DeleteBadge({ annotation, onRemove }: { annotation: Annotation; onRemove: (id: string) => void }) {
  const mid = arrowMidpoint(annotation)
  // 진행 방향의 수직 방향으로 치워 화살대를 가리지 않는다
  const dx = annotation.to.x - annotation.from.x
  const dy = annotation.to.y - annotation.from.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const cx = mid.x + nx * DELETE_OFFSET
  const cy = mid.y + ny * DELETE_OFFSET

  return (
    <g
      onPointerDown={(e) => {
        e.stopPropagation()
        onRemove(annotation.id)
      }}
      style={{ cursor: 'pointer' }}
    >
      <ellipse
        cx={cx}
        cy={cy}
        rx={BADGE_RADIUS.rx}
        ry={BADGE_RADIUS.ry}
        fill={PLAYER_COLORS.ghost.pathStroke}
        fillOpacity={0.9}
      />
      <text
        x={cx}
        y={cy}
        fontSize={2.4}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0F172A"
        style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
      >
        ✕
      </text>
    </g>
  )
}
