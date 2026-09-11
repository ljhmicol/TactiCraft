import { motion, type PanInfo } from 'framer-motion'

import { autoPressingLine, pressingLineLevel } from '@/lib/compactness'
import { clampCoord, pagePointToPitch } from '@/lib/coords'
import { LAYER_COLORS } from '@/lib/theme'
import type { PlayerPosition } from '@/types/analysis'

import { usePitchSvg } from './PitchContext'

interface PressingLineProps {
  positions: PlayerPosition[]
  pressingLineY?: number
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용. positions는 항상 원본(세로) 좌표계로 받는다 —
   * autoPressingLine이 y값(공격 방향 거리)을 기준으로 계산하기 때문이다. */
  orientation?: 'portrait' | 'landscape'
  /**
   * "매우 높음/낮음" 라벨을 계산할 때 쓸 값 — 생략하면 pressingLineY(또는
   * 자동 산출값)를 그대로 쓴다. 전술 대결 뷰(MatchupView)에서 B팀은 그리기
   * 위치를 위해 180도 미러링된 y를 pressingLineY로 넘기는데, 그 미러링된
   * 값을 그대로 라벨 판정에 쓰면 "높다/낮다"의 의미가 뒤집힌다(2026-09-08
   * 실제 버그 — B팀의 평범한 백라인 깊이가 미러링 후 y가 작아져서 "매우
   * 높음"으로 표시됐다. 미러링은 화면에서 어디에 그릴지만 바꿀 뿐, B팀
   * 자신에게는 여전히 낮은/깊은 라인이다). 이런 경우 호출부가 미러링 전
   * 원본(그 팀 고유 좌표계) 값을 labelY로 따로 넘겨 라벨만 올바르게
   * 판정하게 한다 — 그리기 위치(y)와 라벨 판정(labelY)을 분리한다.
   */
  labelY?: number
  /**
   * 편집기 전용(portrait만 지원) — 주어지면 라인을 위아래로 드래그할 수
   * 있게 된다(2026-09-08 사용자 요청: "라인을 위아래로 드래그해서 압박
   * 수준을 수정"). 드래그 중 매 순간의 피치 y좌표를 그대로 콜백에 넘긴다 —
   * 호출부(EditorPage)가 `pressingLineLevel(y)`로 가장 가까운 5단계를
   * 찾아 `setPressingLineLevel`을 호출하므로, 드래그하는 동안 포인터가
   * 단계 경계(50/65/80/90)를 넘을 때마다 대형 전체가 그 단계로 스냅된다 —
   * FM 슬라이더의 "딸깍" 걸리는 느낌과 같다. PNG/GIF 카드·전술 대결처럼
   * 읽기 전용인 곳에는 이 prop을 넘기지 않는다(드래그 핸들 자체가 안 그려짐).
   */
  onDragY?: (pitchY: number) => void
  /**
   * onDragY와 함께 쓴다 — 드래그 시작/끝을 알려준다. 위치 변경은 보통
   * `PlayerNode`가 0.6초짜리 국면-전환 모프 애니메이션으로 부드럽게
   * 따라가는데, 드래그 중에도 그 딜레이가 그대로 적용되면 손가락/커서보다
   * 선수가 한 박자 늦게 쫓아오는 것처럼 보인다(2026-09-08 실제 버그 —
   * 400ms 뒤에 값을 읽었더니 아직 모프 중간값이었다). 호출부가 이 콜백으로
   * 스토어의 `isPressingLineDragging`을 켜/꺼서 그동안은 `PlayerNode`가
   * 자기 자신을 드래그할 때처럼 즉시(0초) 위치를 반영하게 한다.
   */
  onDragStart?: () => void
  onDragEnd?: () => void
}

/**
 * pressingLineY가 수동 지정돼 있으면 그 값을 그대로 쓰고, 없으면 자동 산출한다
 * (GK 제외 최대 y). 사용자가 수동 지정한 경우 자동 산출은 호출되지 않는다.
 */
export function PressingLine({
  positions,
  pressingLineY,
  orientation = 'portrait',
  labelY,
  onDragY,
  onDragStart,
  onDragEnd,
}: PressingLineProps) {
  const svgRef = usePitchSvg()
  const y = pressingLineY ?? autoPressingLine(positions)
  const landscape = orientation === 'landscape'
  const line = landscape ? { x1: 100 - y, y1: 0, x2: 100 - y, y2: 100 } : { x1: 0, y1: y, x2: 100, y2: y }
  // 세로 모드는 라인이 항상 우측(x=98)에 붙어 end 정렬만 쓰면 되지만, 가로
  // 모드는 라인이 화면 어느 쪽 끝에나 올 수 있어(공수 교대) 화면 밖으로
  // 잘리지 않도록 라인 위치에 따라 정렬을 바꾼다.
  const landscapeX = 100 - y
  const label = landscape
    ? landscapeX < 12
      ? { x: landscapeX + 1.5, y: 3, anchor: 'start' as const }
      : landscapeX > 88
        ? { x: landscapeX - 1.5, y: 3, anchor: 'end' as const }
        : { x: landscapeX, y: 3, anchor: 'middle' as const }
    : { x: 98, y: y - 1.2, anchor: 'end' as const }

  const handlePan = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (!onDragY || !svgRef.current) return
    const next = pagePointToPitch(svgRef.current, info.point.x, info.point.y)
    onDragY(clampCoord(next.y))
  }

  return (
    <g>
      <line {...line} stroke={LAYER_COLORS.pressingLine.color} strokeWidth={LAYER_COLORS.pressingLine.width} />
      {onDragY && (
        // 시각적 라인(위)은 얇아서 잡기 어렵다 — 훨씬 굵은 투명 라인을 위에
        // 겹쳐 드래그 히트 영역을 넓힌다(AnnotationLayer의 클릭 판정 라인과
        // 같은 방식).
        <motion.line
          {...line}
          stroke="transparent"
          strokeWidth={4}
          style={{ cursor: 'ns-resize', touchAction: 'none' }}
          onPanStart={onDragStart}
          onPan={handlePan}
          onPanEnd={onDragEnd}
        />
      )}
      <text x={label.x} y={label.y} fill={LAYER_COLORS.pressingLine.color} fontSize={2} textAnchor={label.anchor}>
        압박 라인 {pressingLineLevel(labelY ?? y)}
      </text>
    </g>
  )
}
