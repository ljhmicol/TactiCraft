import { computeCompactness } from '@/lib/compactness'
import { transposeRect } from '@/lib/coords'
import { LANDSCAPE_TEXT_X_SCALE } from '@/lib/pitchMarkings'
import { PITCH_TEXT_FONT_FAMILY, VERSUS_TEAM_COLORS } from '@/lib/theme'
import type { PlayerPosition } from '@/types/analysis'

interface MatchupCompactnessLayerProps {
  aPositions: PlayerPosition[]
  bPositions: PlayerPosition[]
  orientation?: 'portrait' | 'landscape'
}

interface TeamBoxProps {
  positions: PlayerPosition[]
  color: string
  orientation: 'portrait' | 'landscape'
  /** 라벨을 박스 위/아래 중 어디에 붙일지 — 두 팀 박스가 겹칠 때 라벨끼리
   * 겹치지 않게 반대쪽에 둔다. */
  labelSide: 'above' | 'below'
}

function TeamCompactnessBox({ positions, color, orientation, labelSide }: TeamBoxProps) {
  const result = computeCompactness(positions)
  if (!result) return null
  const { box, verticalM, horizontalM } = result
  const landscape = orientation === 'landscape'
  const rect = landscape
    ? transposeRect(box.x, box.x + box.width, box.y, box.y + box.height)
    : { x: box.x, y: box.y, width: box.width, height: box.height }
  const textScaleX = landscape ? LANDSCAPE_TEXT_X_SCALE : 1
  const labelY = labelSide === 'above' ? rect.y - 1.5 : rect.y + rect.height + 3
  const labelX = (rect.x + rect.width / 2) / textScaleX

  return (
    <g>
      <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke={color} strokeWidth={0.4} strokeDasharray="1.2 1.2" />
      <g transform={`scale(${textScaleX} 1)`}>
        <text
          x={labelX}
          y={labelY}
          fill={color}
          fontSize={2}
          fontWeight="bold"
          textAnchor="middle"
          style={{ paintOrder: 'stroke', fontFamily: PITCH_TEXT_FONT_FAMILY }}
          stroke="#0F172A"
          strokeWidth={0.35}
          strokeOpacity={0.6}
        >
          세로 {verticalM}m × 가로 {horizontalM}m
        </text>
      </g>
    </g>
  )
}

/**
 * "팀 폭/깊이 정면 비교"(versus-stat-features-backlog 4번, 마지막 항목) —
 * 에디터의 `CompactnessBox`(단일 팀 bounding box + m 환산 라벨)를 두 팀
 * 동시에 그려서 나란히 비교한다. 새 지표를 만들지 않고 기존
 * `computeCompactness`를 그대로 재사용한다 — GK 제외 판정(y 최댓값 1명)도
 * 그 함수가 이미 검증된 로직을 그대로 쓴다.
 *
 * 카드(AdvantageBadge류)를 새로 만들지 않고 피치 위 오버레이로만 구현했다
 * — 두 박스가 같은 피치에 겹쳐 그려지는 것 자체가 이미 "나란히 비교"이고,
 * 각 박스 라벨의 숫자가 곧 비교 수치라 별도 텍스트 패널이 군더더기다
 * (바로 앞서 만들었다 지워진 TiltGauge 카드처럼 화면에 패널을 계속
 * 얹기보다, 이번엔 피치 자체에 답을 그려 넣는 쪽을 택했다).
 */
export function MatchupCompactnessLayer({ aPositions, bPositions, orientation = 'portrait' }: MatchupCompactnessLayerProps) {
  return (
    <g>
      <TeamCompactnessBox positions={aPositions} color={VERSUS_TEAM_COLORS.A.fill} orientation={orientation} labelSide="above" />
      <TeamCompactnessBox positions={bPositions} color={VERSUS_TEAM_COLORS.B.fill} orientation={orientation} labelSide="below" />
    </g>
  )
}
