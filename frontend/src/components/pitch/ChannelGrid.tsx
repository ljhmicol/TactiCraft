import { transposePoint, transposeRect } from '@/lib/coords'
import { LANDSCAPE_TEXT_X_SCALE } from '@/lib/pitchMarkings'
import { CHANNEL_BOUNDS } from '@/lib/zones'
import { LAYER_COLORS, PITCH_TEXT_FONT_FAMILY } from '@/lib/theme'

const INNER_BOUNDARIES = [
  CHANNEL_BOUNDS.leftWing[1], // 20
  CHANNEL_BOUNDS.leftHalf[1], // 36.5
  CHANNEL_BOUNDS.center[1], // 63.5
  CHANNEL_BOUNDS.rightHalf[1], // 80
]

/** 왼쪽(leftWing+leftHalf)/중앙(center)/오른쪽(rightHalf+rightWing) 3묶음 —
 * `versusAdvantage.ts`의 `SIDE_CHANNELS`(게이지 바가 쓰는 묶음)와 같은 기준. */
const SIDE_BANDS: { letter: 'L' | 'C' | 'R'; x0: number; x1: number }[] = [
  { letter: 'L', x0: CHANNEL_BOUNDS.leftWing[0], x1: CHANNEL_BOUNDS.leftHalf[1] },
  { letter: 'C', x0: CHANNEL_BOUNDS.center[0], x1: CHANNEL_BOUNDS.center[1] },
  { letter: 'R', x0: CHANNEL_BOUNDS.rightHalf[0], x1: CHANNEL_BOUNDS.rightWing[1] },
]

/** 라벨을 놓는 y(골 방향) 앵커 — 페널티 박스 깊이(~15.7)를 벗어나면서, 서드별
 * "3:0" 구역 숫자(MatchupOverloadLayer)가 앉는 서드 중심(16.65/50/83.35)과도
 * 안 겹치는 자리를 골랐다. */
const LABEL_Y = 30

interface ChannelGridProps {
  halfSpaces: boolean
  /** landscape는 전술 대결 뷰(TO-DO 21) 전용 — 채널 경계가 세로 띠 대신 가로 띠로 바뀐다. */
  orientation?: 'portrait' | 'landscape'
  /** "왼쪽/오른쪽이 화면 좌우가 아니라 위아래로 표시돼서 헷갈린다"(TO-DO 43
   * 후속)는 피드백 — 피치 위에 L/C/R 한 글자 라벨을 직접 찍어 축을 눈으로
   * 바로 확인하게 한다. 기본 false — 단일 팀 에디터/공유 카드는 세로
   * 모드라 이미 x축이 화면 좌우와 일치해서 헷갈릴 일이 없어 그대로 둔다. */
  sideLabels?: boolean
}

/** 5채널 경계선(점선) + 하프스페이스(채널 2·4) 강조 채움 (2단계 §3.1, §12.3). */
export function ChannelGrid({ halfSpaces, orientation = 'portrait', sideLabels = false }: ChannelGridProps) {
  const landscape = orientation === 'landscape'
  const [leftHalfX0, leftHalfX1] = CHANNEL_BOUNDS.leftHalf
  const [rightHalfX0, rightHalfX1] = CHANNEL_BOUNDS.rightHalf

  const halfSpaceRects = landscape
    ? [transposeRect(leftHalfX0, leftHalfX1, 0, 100), transposeRect(rightHalfX0, rightHalfX1, 0, 100)]
    : [
        { x: leftHalfX0, y: 0, width: leftHalfX1 - leftHalfX0, height: 100 },
        { x: rightHalfX0, y: 0, width: rightHalfX1 - rightHalfX0, height: 100 },
      ]

  return (
    <g>
      {halfSpaces && (
        <g fill={LAYER_COLORS.halfSpaces.color} fillOpacity={LAYER_COLORS.halfSpaces.opacity}>
          {halfSpaceRects.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} />
          ))}
        </g>
      )}
      <g stroke={LAYER_COLORS.channelGrid.color} strokeOpacity={LAYER_COLORS.channelGrid.opacity} strokeWidth={0.25}>
        {INNER_BOUNDARIES.map((x) =>
          landscape ? (
            <line key={x} x1={0} y1={x} x2={100} y2={x} strokeDasharray="0.6 0.8" />
          ) : (
            <line key={x} x1={x} y1={0} x2={x} y2={100} strokeDasharray="0.6 0.8" />
          ),
        )}
      </g>
      {sideLabels && (
        <g fill="#F8FAFC" fillOpacity={0.75} style={{ fontFamily: PITCH_TEXT_FONT_FAMILY }}>
          {SIDE_BANDS.map(({ letter, x0, x1 }) => {
            const mid = (x0 + x1) / 2
            const p = landscape ? transposePoint({ x: mid, y: LABEL_Y }) : { x: mid, y: LABEL_Y }
            const textScaleX = landscape ? LANDSCAPE_TEXT_X_SCALE : 1
            return (
              <g key={letter} transform={`scale(${textScaleX} 1)`}>
                <text
                  x={p.x / textScaleX}
                  y={p.y}
                  fontSize={3}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ paintOrder: 'stroke' }}
                  stroke="#0F172A"
                  strokeWidth={0.5}
                  strokeOpacity={0.6}
                >
                  {letter}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </g>
  )
}
