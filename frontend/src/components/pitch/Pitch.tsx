import { useLayoutEffect, useRef, type ReactNode } from 'react'

import { transposePoint, transposeRect } from '@/lib/coords'
import { CENTER_CIRCLE, GOAL_AREA, PENALTY_AREA, PENALTY_SPOT_Y, swapForLandscape } from '@/lib/pitchMarkings'
import { PITCH_COLORS } from '@/lib/theme'

import { PitchSvgProvider } from './PitchContext'

interface PitchProps {
  children?: ReactNode
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용 — 에디터는 항상 portrait. */
  orientation?: 'portrait' | 'landscape'
}

/**
 * SVG 루트. viewBox="0 0 100 100"에 좌표를 그대로 사용한다.
 *
 * preserveAspectRatio="none"을 쓴다: 컨테이너는 실제 피치 비율로 고정되어
 * 있고(portrait=68:105, landscape=105:68), viewBox는 정사각형(100x100)이라
 * "meet"을 쓰면 레터박스 여백이 생겨 피치가 프레임을 꽉 채우지 못한다.
 * "none"으로 x/y를 독립적으로 늘리면 여백 없이 채워지는 대신 x/y 축척이
 * 달라지므로, 원형이어야 하는 요소는 축별 m 환산값으로 rx/ry를 따로 계산해
 * 시각적으로 다시 원으로 보이게 한다 (lib/pitchMarkings.ts).
 *
 * landscape는 SVG transform으로 그룹을 회전시키지 않는다 — 회전은 그 안의
 * 텍스트(선수 이름·번호)까지 같이 돌려버린다. 대신 각 도형의 좌표 자체를
 * `transposePoint`/`transposeRect`로 미리 옮겨서 그린다(4단계 §3.1 확장).
 */
export function Pitch({ children, orientation = 'portrait' }: PitchProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const landscape = orientation === 'landscape'

  const outer = landscape ? transposeRect(0.5, 99.5, 0.5, 99.5) : { x: 0.5, y: 0.5, width: 99, height: 99 }
  const centerCircleR = landscape ? swapForLandscape(CENTER_CIRCLE) : CENTER_CIRCLE
  const spotR = landscape ? swapForLandscape({ rx: 0.35, ry: 0.35 * (68 / 105) }) : { rx: 0.35, ry: 0.35 * (68 / 105) }
  const centerSpot = landscape ? transposePoint({ x: 50, y: 50 }) : { x: 50, y: 50 }
  const oppSpot = landscape ? transposePoint({ x: 50, y: PENALTY_SPOT_Y }) : { x: 50, y: PENALTY_SPOT_Y }
  const ownSpot = landscape
    ? transposePoint({ x: 50, y: 100 - PENALTY_SPOT_Y })
    : { x: 50, y: 100 - PENALTY_SPOT_Y }

  const oppPenalty = landscape
    ? transposeRect(50 - PENALTY_AREA.halfWidth, 50 + PENALTY_AREA.halfWidth, 0, PENALTY_AREA.depth)
    : { x: 50 - PENALTY_AREA.halfWidth, y: 0, width: PENALTY_AREA.halfWidth * 2, height: PENALTY_AREA.depth }
  const oppGoal = landscape
    ? transposeRect(50 - GOAL_AREA.halfWidth, 50 + GOAL_AREA.halfWidth, 0, GOAL_AREA.depth)
    : { x: 50 - GOAL_AREA.halfWidth, y: 0, width: GOAL_AREA.halfWidth * 2, height: GOAL_AREA.depth }
  const ownPenalty = landscape
    ? transposeRect(50 - PENALTY_AREA.halfWidth, 50 + PENALTY_AREA.halfWidth, 100 - PENALTY_AREA.depth, 100)
    : {
        x: 50 - PENALTY_AREA.halfWidth,
        y: 100 - PENALTY_AREA.depth,
        width: PENALTY_AREA.halfWidth * 2,
        height: PENALTY_AREA.depth,
      }
  const ownGoal = landscape
    ? transposeRect(50 - GOAL_AREA.halfWidth, 50 + GOAL_AREA.halfWidth, 100 - GOAL_AREA.depth, 100)
    : {
        x: 50 - GOAL_AREA.halfWidth,
        y: 100 - GOAL_AREA.depth,
        width: GOAL_AREA.halfWidth * 2,
        height: GOAL_AREA.depth,
      }
  const halfwayLine = landscape ? { x1: 50, y1: 0, x2: 50, y2: 100 } : { x1: 0, y1: 50, x2: 100, y2: 50 }

  // html-to-image로 내보낼 때(ShareCard·ThumbnailCard 등)를 위한 안전장치
  // (2026-09-20, 실기기 Safari 리포트 "저장은 되는데 전술판이 안 보여") — 이
  // svg는 width/height 속성 없이 CSS(className="h-full w-full")만으로
  // 크기가 정해진다. html-to-image는 이 서브트리를 통째로 <foreignObject>
  // 안에 복제해 넣는데, 그 안에서 퍼센트 높이(h-full)가 기준으로 삼을
  // "정해진 크기의 부모"를 못 찾으면 CSS 스펙상 auto로 취급되고, auto인
  // svg는 자기 자신의 width/height 속성(없으면 기본값 300x150)으로
  // 되돌아간다 — Chromium은 이 상황에서도 대체로 잘 버티지만 Safari(WebKit)는
  // 실제로 찌부러뜨리는 걸로 보인다(피치만 안 보이고 카드의 나머지 텍스트는
  // 정상 캡처된 리포트와 일치하는 증상). 실제 렌더링된 픽셀 크기를
  // width/height 속성으로 직접 박아두면 위 퍼센트 계산이 실패해도 기댈 값이
  // 생긴다 — CSS(h-full w-full)가 항상 이 속성보다 우선하므로 평소 화면에는
  // 아무 영향이 없다. ResizeObserver를 쓰는 이유는 ShareCard의 ratio 전환처럼
  // Pitch 자신은 리마운트되지 않고 부모 컨테이너 크기만 바뀌는 경우도 있어서다.
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const applySize = () => {
      const rect = svg.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        svg.setAttribute('width', String(rect.width))
        svg.setAttribute('height', String(rect.height))
      }
    }
    applySize()
    const observer = new ResizeObserver(applySize)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      // landscape는 w-full을 뺀다(TO-DO 39) — w-full과 h-full을 동시에 주면
      // 두 축 다 "정해진 값"이 돼서 aspect-[105/68]가 개입할 자리가 없어져
      // 무시된다(둘 다 명시되면 aspect-ratio는 아무 효과가 없다). 그 결과
      // 대결 뷰(/versus)에 패널(오버로드 배지·개선방안 등)이 늘어날 때마다
      // flex-1 높이가 줄어드는 만큼 피치가 옆으로 뭉개졌다 — 선수 마커
      // (circularRadius로 원이어야 할 타원)와 글자가 가로로 퍼져 보인
      // 실제 원인이 여기였다. w-full을 빼면 높이(h-full)만 정해진 값이라
      // aspect-ratio가 그 높이에 맞는 너비를 계산해서 채우고, max-w-full은
      // (화면이 아주 넓을 때를 대비한) 상한선으로만 남는다. portrait는
      // MVP 때부터 지금 모습 그대로 사용자가 계속 확인해 온 기준선이라
      // 이번엔 건드리지 않는다.
      className={
        landscape ? 'mx-auto aspect-[105/68] h-full max-h-full max-w-full' : 'mx-auto aspect-[68/105] h-full max-h-full w-full max-w-full'
      }
    >
      <PitchSvgProvider value={svgRef}>
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full"
          style={{ background: PITCH_COLORS.background }}
        >
          <g
            fill="none"
            stroke={PITCH_COLORS.line}
            strokeOpacity={PITCH_COLORS.lineOpacity}
            strokeWidth={PITCH_COLORS.lineWidth}
          >
            <rect x={outer.x} y={outer.y} width={outer.width} height={outer.height} />
            <line {...halfwayLine} />
            <ellipse cx={centerSpot.x} cy={centerSpot.y} rx={centerCircleR.rx} ry={centerCircleR.ry} />

            {/* 상대 골문(공격 방향) 페널티/골 지역 */}
            <rect x={oppPenalty.x} y={oppPenalty.y} width={oppPenalty.width} height={oppPenalty.height} />
            <rect x={oppGoal.x} y={oppGoal.y} width={oppGoal.width} height={oppGoal.height} />

            {/* 자팀 골문 페널티/골 지역 */}
            <rect x={ownPenalty.x} y={ownPenalty.y} width={ownPenalty.width} height={ownPenalty.height} />
            <rect x={ownGoal.x} y={ownGoal.y} width={ownGoal.width} height={ownGoal.height} />
          </g>
          <g fill={PITCH_COLORS.line} fillOpacity={PITCH_COLORS.lineOpacity}>
            <ellipse cx={centerSpot.x} cy={centerSpot.y} rx={spotR.rx} ry={spotR.ry} />
            <ellipse cx={oppSpot.x} cy={oppSpot.y} rx={spotR.rx} ry={spotR.ry} />
            <ellipse cx={ownSpot.x} cy={ownSpot.y} rx={spotR.rx} ry={spotR.ry} />
          </g>

          {children}
        </svg>
      </PitchSvgProvider>
    </div>
  )
}
