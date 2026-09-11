import { circularRadius } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { findTacticalRole } from '@/lib/tacticalRoles'
import { PITCH_TEXT_FONT_FAMILY, PLAYER_COLORS, POSITION_LINE_COLORS } from '@/lib/theme'
import type { Player, Point } from '@/types/analysis'

interface PrintPlayerNodeProps {
  player: Player
  position: Point
  formation: string
  index: number
}

const OWN_RADIUS = circularRadius(PLAYER_COLORS.own.radius)

/**
 * GIF 내보내기(TO-DO 6) 전용 정지 노드. 편집 화면의 `PlayerNode`는
 * useAnalysisStore에서 현재 활성 분석의 formation·index·드래그 액션을
 * 끌어오고 Framer Motion으로 국면 전환을 실시간 애니메이션하는데, GIF
 * 캡처는 프레임마다 미리 계산한(보간 포함) 좌표를 그 순간 그대로 정지
 * 이미지로 찍어야 한다 — 라이브 애니메이션에 얹으면 캡처 타이밍이 실제
 * 화면 재생 속도에 좌우돼 프레임이 흔들린다(lib/exportGif.ts 참조).
 *
 * `StaticPlayerNode`(전술 대결 뷰 전용, 팀 단위 A/B 색상)와 같은 이유로
 * 분리했지만, 이쪽은 한 팀만 다루는 PNG 카드와 시각적으로 통일되도록
 * 포지션 라인 색상 + 전술 역할 라벨을 그대로 재현한다 — `PlayerNode`의
 * 정지 상태(애니메이션 없는 렌더 결과)와 픽셀 단위로 같아야 한다.
 */
export function PrintPlayerNode({ player, position, formation, index }: PrintPlayerNodeProps) {
  const info = positionInfoAt(formation, index)
  const lineColor = info ? POSITION_LINE_COLORS[info.line] : null
  const role = findTacticalRole(player.tacticalRole)
  const topLabel = role?.label ?? info?.label
  const topLabelFontSize = role ? 1.4 : 1.7

  return (
    <g>
      <ellipse
        cx={position.x}
        cy={position.y}
        rx={OWN_RADIUS.rx}
        ry={OWN_RADIUS.ry}
        fill={lineColor?.fill ?? PLAYER_COLORS.own.fill}
        stroke={PLAYER_COLORS.own.stroke}
        strokeOpacity={PLAYER_COLORS.own.strokeOpacity}
        strokeWidth={0.3}
      />
      {topLabel && (
        <text
          x={position.x}
          y={position.y - OWN_RADIUS.ry - 1.4}
          fill={PLAYER_COLORS.own.fill}
          fillOpacity={0.9}
          fontSize={topLabelFontSize}
          textAnchor="middle"
          style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
        >
          {topLabel}
        </text>
      )}
      <text
        x={position.x}
        y={position.y}
        fill={lineColor?.text ?? PLAYER_COLORS.own.text}
        fontSize={2.4}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ userSelect: 'none', fontFamily: PITCH_TEXT_FONT_FAMILY }}
      >
        {player.number}
      </text>
      <text
        x={position.x}
        y={position.y + OWN_RADIUS.ry + 3}
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
      </text>
    </g>
  )
}
