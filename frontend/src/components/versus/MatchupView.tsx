import { AdvantageBadge } from '@/components/versus/AdvantageBadge'
import { MatchupOverloadLayer } from '@/components/versus/MatchupOverloadLayer'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { LANDSCAPE_RADIUS, StaticPlayerNode } from '@/components/pitch/StaticPlayerNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { mirrorPoint, resolveDefendingPressingLineLevel, resolveDefendingPressingLineY, transposePoint } from '@/lib/coords'
import { resolveLabelOverlap, type LabelBox } from '@/lib/labelPlacement'
import { computeOverload } from '@/lib/overload'
import { positionInfoAt } from '@/lib/positions'
import type { Analysis, Annotation, PhaseData, PhaseType, Player, PlayerPosition, Point } from '@/types/analysis'

/**
 * 구역별 수적 우위(3:0 표시, TO-DO 36)에서 골키퍼는 뺀다 — 골키퍼는 필드
 * 플레이어 수적 우위와 무관하고, 항상 자기 진영 구역에 서 있어서 넣으면
 * 특정 구역 카운트가 실제 대형 우위와 무관하게 왜곡된다. 마커 자체는
 * (StaticPlayerNode) 이 필터와 별개로 GK를 계속 그린다 — 오버로드 집계
 * 에서만 빼는 것이지 화면에서 지우는 게 아니다.
 */
function excludeGoalkeepers(positions: PlayerPosition[], players: Player[], formation: string): PlayerPosition[] {
  const gkIds = new Set(
    players.flatMap((player, index) => (positionInfoAt(formation, index)?.line === 'GK' ? [player.id] : [])),
  )
  return positions.filter((p) => !gkIds.has(p.playerId))
}

/**
 * 각 분석의 런/패스 화살표(에디터에서 그린 것)를 대결 뷰 좌표계로 옮긴다
 * (TO-DO 28, 4번 "이동 벡터") — 새 데이터가 아니라 이미 있는 annotations를
 * 재사용한다. B팀은 선수 좌표와 같은 순서로 먼저 미러링(자팀 좌표계 →
 * 마주보는 배치)한 뒤 landscape면 transpose한다 — positionsB 계산과 같은
 * 순서를 지켜야 화살표가 실제 선수 위치와 어긋나지 않는다.
 */
function transformAnnotationsForMatchup(annotations: Annotation[], mirror: boolean, landscape: boolean): Annotation[] {
  return annotations.map((a) => {
    const from = mirror ? mirrorPoint(a.from) : a.from
    const to = mirror ? mirrorPoint(a.to) : a.to
    return { ...a, from: landscape ? transposePoint(from) : from, to: landscape ? transposePoint(to) : to }
  })
}

interface MatchupMarker {
  key: string
  player: Player
  formation: string
  index: number
  variant: 'A' | 'B'
  /** 원본(세로) 좌표계 — StaticPlayerNode에 그대로 넘긴다 */
  originalPosition: Point
  /** landscape 변환까지 끝난 위치 — 라벨 배치 계산 기준(마커 자체는 겹쳐도 그대로 둔다, 2026-09-09 사용자 결정) */
  landscapePoint: Point
}

// 라벨 한 칸 밀어낼 때 y 증가량 — 라벨 height(2.6)보다 작으면 한 칸 밀어도
// 잔여 겹침이 남는다(TO-DO 36, 이름 앞에 포지션 코드가 붙으며 너비가 늘어나
// 겹침 판정 쌍이 늘어서 이 여유 부족이 더 자주 드러남). height보다 살짝
// 크게 잡아 한 번만 밀어도 확실히 떨어지게 한다.
const LABEL_STEP = 2.8

interface MatchupViewProps {
  analysisA: Analysis
  analysisB: Analysis
  /** 어느 쪽이 공격 국면인지 — 나머지 한쪽은 자동으로 수비 국면이 된다 */
  attacker: 'A' | 'B'
  showChannelGrid: boolean
  showOverload: boolean
  showPressingLine: boolean
  showAnnotations: boolean
}

/**
 * 두 분석을 한 피치에 겹친다. A는 저장된 좌표 그대로(자팀 골 y=100), B는
 * 180도 회전(lib/coords.mirrorPoint)해서 B의 골문이 A가 공격하는 방향
 * (y=0)에 오도록 맞춘다 — 그래야 "A 공격이 B 수비를 어떻게 깨는지"가
 * 실제 마주 선 두 팀처럼 겹쳐 보인다. y만 뒤집으면 좌우 플랭크가 실제와
 * 반대로 그려지므로 x도 함께 뒤집는다.
 */
export function MatchupView({
  analysisA,
  analysisB,
  attacker,
  showChannelGrid,
  showOverload,
  showPressingLine,
  showAnnotations,
}: MatchupViewProps) {
  const phaseA: PhaseType = attacker === 'A' ? 'attack' : 'defense'
  const phaseB: PhaseType = attacker === 'B' ? 'attack' : 'defense'
  const dataA = analysisA.phases[phaseA]
  const dataB = analysisB.phases[phaseB]

  const positionsB: PlayerPosition[] = dataB.positions.map((p) => ({ playerId: p.playerId, ...mirrorPoint(p) }))

  // 오버로드는 기존 computeOverload(own vs opponentPositions)를 그대로 재사용한다 —
  // A를 own, 미러링한 B를 opponent로 두면 15구역 우위 계산이 그대로 맞아떨어진다.
  // 골키퍼는 양쪽 다 집계에서 뺀다(TO-DO 36, excludeGoalkeepers 참조).
  const syntheticPhase: PhaseData = {
    positions: excludeGoalkeepers(dataA.positions, analysisA.players, analysisA.formation),
    opponentPositions: excludeGoalkeepers(positionsB, analysisB.players, analysisB.formation).map(({ x, y }) => ({ x, y })),
    comment: '',
    annotations: [],
  }

  // 압박 라인은 "수비하는 쪽"의 것만 보여준다 — 이 뷰의 관심사는 그 블록이
  // 어디서 시작되는지다. 자동 산출은 항상 각 팀 고유(미러링 전) 좌표로
  // 계산한 뒤 B가 수비인 경우에만 결과를 미러링한다 — 미러링된 좌표에
  // 자동 산출을 직접 돌리면 GK 판별이 뒤집혀 버리는 실제 버그 이력은
  // resolveDefendingPressingLineY 참조.
  const defendingPositions = phaseA === 'defense' ? dataA.positions : positionsB
  const defendingPressingLineY = resolveDefendingPressingLineY(
    phaseA === 'defense',
    dataA.pressingLineY,
    dataB.pressingLineY,
    dataA.positions,
    dataB.positions,
  )
  // "매우 높음/낮음" 라벨은 그리기 위치(위 값, B면 미러링됨)와 별개로 항상
  // 그 팀 고유 좌표계 값으로 판정한다 — 미러링된 값을 그대로 라벨에 쓰면
  // 높낮이가 뒤집히는 실제 버그 이력은 resolveDefendingPressingLineLevel 참조.
  const defendingPressingLineLevel = resolveDefendingPressingLineLevel(
    phaseA === 'defense',
    dataA.pressingLineY,
    dataB.pressingLineY,
    dataA.positions,
    dataB.positions,
  )

  const labelA = analysisA.match.homeTeam
  const labelB = analysisB.match.homeTeam
  const zones = computeOverload(syntheticPhase)

  // 마커는 겹치면 그냥 겹치는 채로 둔다(2026-09-09 사용자 결정 — 스파이더파이어
  // 대신 예전처럼). 이름표만 겹치지 않게 위아래로 나눈다(TO-DO 28, 1번).
  const markersA: MatchupMarker[] = analysisA.players.flatMap((player, index) => {
    const pos = dataA.positions.find((p) => p.playerId === player.id)
    if (!pos) return []
    return [
      {
        key: `a-${player.id}`,
        player,
        formation: analysisA.formation,
        index,
        variant: 'A' as const,
        originalPosition: pos,
        landscapePoint: transposePoint(pos),
      },
    ]
  })
  const markersB: MatchupMarker[] = analysisB.players.flatMap((player, index) => {
    const pos = positionsB.find((p) => p.playerId === player.id)
    if (!pos) return []
    return [
      {
        key: `b-${player.id}`,
        player,
        formation: analysisB.formation,
        index,
        variant: 'B' as const,
        originalPosition: pos,
        landscapePoint: transposePoint(pos),
      },
    ]
  })
  const markers = [...markersA, ...markersB]

  const labelBoxes: LabelBox[] = markers.map((marker) => ({
    id: marker.key,
    x: marker.landscapePoint.x,
    defaultY: marker.landscapePoint.y + LANDSCAPE_RADIUS.ry + 3,
    // +2는 이름 앞에 붙는 포지션 코드(GK/DF/MF/FW, 항상 2글자, TO-DO 36) 몫이다.
    width: Math.max(6, (marker.player.name.length + 2) * 1.6),
    height: 2.6,
  }))
  const labelOffsets = resolveLabelOverlap(labelBoxes, LABEL_STEP)

  return (
    <div className="flex h-full flex-col gap-3">
      {showOverload && <AdvantageBadge zones={zones} labelA={labelA} labelB={labelB} />}
      <div className="min-h-0 flex-1">
        <Pitch orientation="landscape">
          {showChannelGrid && <ChannelGrid halfSpaces orientation="landscape" />}
          {showPressingLine && (
            <PressingLine
              positions={defendingPositions}
              pressingLineY={defendingPressingLineY}
              labelY={defendingPressingLineLevel}
              orientation="landscape"
            />
          )}
          {showOverload && <MatchupOverloadLayer zones={zones} orientation="landscape" />}
          {showAnnotations && (
            <g opacity={0.55}>
              <AnnotationLayer annotations={transformAnnotationsForMatchup(dataA.annotations, false, true)} loop />
              <AnnotationLayer annotations={transformAnnotationsForMatchup(dataB.annotations, true, true)} loop />
            </g>
          )}
          {markers.map((marker) => (
            <StaticPlayerNode
              key={marker.key}
              player={marker.player}
              position={marker.originalPosition}
              formation={marker.formation}
              index={marker.index}
              variant={marker.variant}
              orientation="landscape"
              labelYOffset={labelOffsets.get(marker.key) ?? 0}
            />
          ))}
        </Pitch>
      </div>
    </div>
  )
}
