import { LANDSCAPE_RADIUS } from '@/components/pitch/StaticPlayerNode'
import { ANNOTATION_LINK_EPS, annotationSamplePoints } from '@/lib/annotations'
import { mirrorPoint, resolveDefendingPressingLineLevel, resolveDefendingPressingLineY, transposePoint } from '@/lib/coords'
import { resolveLabelOverlap, type LabelBox } from '@/lib/labelPlacement'
import { computeOverload, within } from '@/lib/overload'
import { LANDSCAPE_TEXT_X_SCALE } from '@/lib/pitchMarkings'
import { positionInfoAt, type PositionLine } from '@/lib/positions'
import { computeMatchupAdvantage, type MatchupAdvantage } from '@/lib/versusAdvantage'
import { CHANNEL_BOUNDS, THIRD_BOUNDS, zoneThreatWeight } from '@/lib/zones'
import type { Analysis, Annotation, Channel, PhaseData, PhaseType, Player, PlayerPosition, Point, Third, ZoneOverload } from '@/types/analysis'

/**
 * 전술 대결(MatchupView, TO-DO 16/21/36/38)의 핵심 파생 데이터 계산 —
 * `MatchupView.tsx`에 있던 로직을 분리했다(TO-DO 41, "전술 대결 PNG 내보내기"
 * 요청으로 새 카드 컴포넌트가 같은 계산이 필요해짐). 압박 라인 미러링·GK
 * 판별처럼 과거 실제 버그를 겪고 고친 부분이 섞여 있어서, 화면(MatchupView)과
 * 내보내기 카드(VersusShareCard)가 각자 다시 구현하면 똑같은 버그가 한쪽에만
 * 재발할 위험이 있다 — 그래서 순수 함수 하나로 묶어 양쪽이 공유한다.
 */
/** 전술 대결 뷰 전용 패스 공 속도 배율(TO-DO 49, "패스 속도 좀 줄이고") —
 * `AnnotationLayer`의 `ballDurationScale`에 그대로 넘긴다. 에디터 속도
 * (BALL_SEGMENT_DURATION=0.55초/구간)는 2026-09-08에 두 차례 사용자
 * 피드백으로 맞춰 둔 값이라 건드리지 않고, 대결 뷰(MatchupView·
 * VersusShareCard)만 이 배율로 ~1초/구간까지 늦춘다. */
export const VERSUS_BALL_DURATION_SCALE = 1.8

/**
 * 상단 텍스트 패널(구역 배지·고립 매치업 행)을 클릭했을 때 피치 위에서
 * 하이라이트할 대상(TO-DO 50-3, "상단 바와 피치 간의 인터랙션 연결"
 * 피드백). 두 종류뿐이다 — 구역 하나(채널×서드)를 켜거나, 선수 마커
 * 몇 명(marker.key 목록, buildMatchupMarkers의 `a-${playerId}`/`b-${playerId}`
 * 형식)을 켠다. 같은 걸 다시 누르면 꺼야 하므로(토글) MatchupView가 이
 * 타입으로 현재 상태를 들고 있다가 같은 target인지 비교한다.
 */
export type MatchupHighlight = { kind: 'zone'; channel: Channel; third: Third } | { kind: 'players'; keys: string[] } | null

export interface MatchupData {
  phaseA: PhaseType
  phaseB: PhaseType
  dataA: PhaseData
  dataB: PhaseData
  /** B팀 좌표를 180도 미러링한 것 — 그리기 위치 기준(자기 고유 좌표계 아님) */
  positionsB: PlayerPosition[]
  labelA: string
  labelB: string
  zones: ZoneOverload[]
  matchupAdvantage: MatchupAdvantage
  defendingPositions: PlayerPosition[]
  defendingPressingLineY: number
  defendingPressingLineLevel: number
}

/**
 * 구역별 수적 우위(TO-DO 36)에서 골키퍼는 뺀다 — 골키퍼는 필드 플레이어
 * 수적 우위와 무관하고, 항상 자기 진영 구역에 서 있어서 넣으면 특정 구역
 * 카운트가 실제 대형 우위와 무관하게 왜곡된다. 마커 자체(StaticPlayerNode)는
 * 이 필터와 별개로 GK를 계속 그린다 — 오버로드 집계에서만 빼는 것이지
 * 화면에서 지우는 게 아니다.
 */
function excludeGoalkeepers(positions: PlayerPosition[], players: Player[], formation: string): PlayerPosition[] {
  const gkIds = new Set(
    players.flatMap((player, index) => (positionInfoAt(formation, index)?.line === 'GK' ? [player.id] : [])),
  )
  return positions.filter((p) => !gkIds.has(p.playerId))
}

export interface ZonePlayer {
  player: Player
  line: PositionLine
}

/**
 * "키포인트 포지션에도 버튼을 만들어서... 지금 현재로는 이 선수가 있다"(TO-DO
 * 46) — 키포인트 구역(가장 격차 큰 구역)에 실제로 누가 서 있는지 알려주려면
 * 좌표만으로는 부족하고 선수 신원이 필요하다. `computeOverload`가 세는
 * own/opp 숫자와 정확히 같은 선수 집합이 나와야 하므로, 경계 판정은
 * `computeOverload`와 똑같이 `within`(하한 포함·상한 배제, 마지막 구간만
 * 100 포함)을 그대로 재사용하고, 골키퍼도 같은 `excludeGoalkeepers`로 뺀다
 * — 안 그러면 배지의 "2:0"과 여기 나열되는 선수 수가 어긋나 보인다.
 */
export function playersInZone(
  positions: PlayerPosition[],
  players: Player[],
  formation: string,
  channel: Channel,
  third: Third,
): ZonePlayer[] {
  const [x0, x1] = CHANNEL_BOUNDS[channel]
  const [y0, y1] = THIRD_BOUNDS[third]
  const inZone = excludeGoalkeepers(positions, players, formation).filter(
    (p) => within(p.x, x0, x1) && within(p.y, y0, y1),
  )
  return inZone.flatMap((pos) => {
    const index = players.findIndex((pl) => pl.id === pos.playerId)
    const player = players[index]
    const info = index >= 0 ? positionInfoAt(formation, index) : null
    return player && info ? [{ player, line: info.line }] : []
  })
}

export interface IsolationMatchup {
  zone: ZoneOverload
  aPlayer: ZonePlayer
  bPlayer: ZonePlayer
  weight: number
}

/** `zoneThreatWeight`가 middle-third wide 채널에 매기는 값(TO-DO 45) — 이보다
 * 낮은 구역(자기 진영 전체, defensive third)의 1v1은 위험한 고립이 아니라
 * 그냥 서로 근처에 서 있는 것뿐이라 걸러낸다. */
const ISOLATION_MIN_WEIGHT = 0.6

/**
 * 고립 매치업 탐지(TO-DO 47, "우선순위대로 진행" 백로그 2번) — "과부하로
 * 상대를 고립시킨다"(overload-to-isolate)는 실제 코칭 용어에서 착안했다.
 * own===1 && opp===1인 15구역을 찾아 그 구역에 실제로 서 있는 두 선수를
 * `playersInZone`으로 짚어준다 — own/opp 숫자는 이미 `computeOverload`가
 * 내는 사실이고, `playersInZone`도 TO-DO 46에서 만든 함수라 새 판정 기준이
 * 아니라 기존 두 조각을 조합한 것뿐이다.
 *
 * 이 기능의 가치는 정확히 **동률(diff=0) 구역**에 있다는 게 다른 패널과
 * 다른 점이다 — `MatchupOverloadLayer`(diff!==0만 그림)도, 위협 가중 점수
 * (diff=0 구역은 애초에 기여가 0)도 1v1 구역을 구조적으로 안 보여준다.
 * 그래서 KeyZoneCallout·위협 가중 점수와 겹치는 정보가 아니다.
 *
 * `ISOLATION_MIN_WEIGHT`로 위험한 구역만 거른다 — 자기 진영 구석에서 흔히
 * 생기는 1v1(예: 수비수 대 수비수)까지 다 보여주면 "실용성"이 없다.
 * `zoneThreatWeight` 내림차순으로 정렬해서 가장 위험한 고립부터 보여준다.
 */
export function computeIsolationMatchups(
  zones: ZoneOverload[],
  dataA: PhaseData,
  analysisA: Analysis,
  positionsB: PlayerPosition[],
  analysisB: Analysis,
): IsolationMatchup[] {
  const results: IsolationMatchup[] = []
  for (const zone of zones) {
    if (zone.own !== 1 || zone.opp !== 1) continue
    const weight = zoneThreatWeight(zone.channel, zone.third)
    if (weight < ISOLATION_MIN_WEIGHT) continue
    const aPlayers = playersInZone(dataA.positions, analysisA.players, analysisA.formation, zone.channel, zone.third)
    const bPlayers = playersInZone(positionsB, analysisB.players, analysisB.formation, zone.channel, zone.third)
    if (aPlayers.length !== 1 || bPlayers.length !== 1) continue
    results.push({ zone, aPlayer: aPlayers[0], bPlayer: bPlayers[0], weight })
  }
  return results.sort((a, b) => b.weight - a.weight)
}

/**
 * 각 분석의 런/패스 화살표(에디터에서 그린 것)를 대결 뷰 좌표계로 옮긴다
 * (TO-DO 28, 4번 "이동 벡터") — 새 데이터가 아니라 이미 있는 annotations를
 * 재사용한다. B팀은 선수 좌표와 같은 순서로 먼저 미러링(자팀 좌표계 →
 * 마주보는 배치)한 뒤 landscape면 transpose한다 — positionsB 계산과 같은
 * 순서를 지켜야 화살표가 실제 선수 위치와 어긋나지 않는다.
 */
export function transformAnnotationsForMatchup(annotations: Annotation[], mirror: boolean, landscape: boolean): Annotation[] {
  return annotations.map((a) => {
    const from = mirror ? mirrorPoint(a.from) : a.from
    const to = mirror ? mirrorPoint(a.to) : a.to
    return { ...a, from: landscape ? transposePoint(from) : from, to: landscape ? transposePoint(to) : to }
  })
}

/**
 * 두 분석을 한 피치에 겹치기 위한 파생 데이터를 계산한다. A는 저장된 좌표
 * 그대로(자팀 골 y=100), B는 180도 회전(mirrorPoint)해서 B의 골문이 A가
 * 공격하는 방향(y=0)에 오도록 맞춘다 — 그래야 "A 공격이 B 수비를 어떻게
 * 깨는지"가 실제 마주 선 두 팀처럼 겹쳐 보인다.
 */
/**
 * 오버로드는 기존 computeOverload(own vs opponentPositions)를 그대로 재사용한다 —
 * A를 own, 미러링한 B를 opponent로 두면 15구역 우위 계산이 그대로 맞아떨어진다.
 * `computeMatchupData`(고정 국면)와 `computeTransitionPositions`로 보간한
 * 좌표(TO-DO 50번대, 공수 전환 슬라이더) 둘 다 이 헬퍼로 구역을 계산한다 —
 * 같은 계산을 두 곳에서 따로 하면 한쪽만 고치는 실수가 나기 쉽다.
 */
export function computeZonesFromPositions(
  aPositions: PlayerPosition[],
  analysisA: Analysis,
  bPositions: PlayerPosition[],
  analysisB: Analysis,
): ZoneOverload[] {
  const syntheticPhase: PhaseData = {
    positions: excludeGoalkeepers(aPositions, analysisA.players, analysisA.formation),
    opponentPositions: excludeGoalkeepers(bPositions, analysisB.players, analysisB.formation).map(({ x, y }) => ({ x, y })),
    comment: '',
    annotations: [],
  }
  return computeOverload(syntheticPhase)
}

export function computeMatchupData(analysisA: Analysis, analysisB: Analysis, attacker: 'A' | 'B'): MatchupData {
  const phaseA: PhaseType = attacker === 'A' ? 'attack' : 'defense'
  const phaseB: PhaseType = attacker === 'B' ? 'attack' : 'defense'
  const dataA = analysisA.phases[phaseA]
  const dataB = analysisB.phases[phaseB]

  const positionsB: PlayerPosition[] = dataB.positions.map((p) => ({ playerId: p.playerId, ...mirrorPoint(p) }))

  // 압박 라인은 "수비하는 쪽"의 것만 보여준다. 자동 산출은 항상 각 팀 고유
  // (미러링 전) 좌표로 계산한 뒤 B가 수비인 경우에만 결과를 미러링한다 —
  // 미러링된 좌표에 자동 산출을 직접 돌리면 GK 판별이 뒤집혀 버리는 실제
  // 버그 이력은 resolveDefendingPressingLineY 참조.
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
  const zones = computeZonesFromPositions(dataA.positions, analysisA, positionsB, analysisB)
  const matchupAdvantage = computeMatchupAdvantage(zones)

  return {
    phaseA,
    phaseB,
    dataA,
    dataB,
    positionsB,
    labelA,
    labelB,
    zones,
    matchupAdvantage,
    defendingPositions,
    defendingPressingLineY,
    defendingPressingLineLevel,
  }
}

/**
 * `from`→`to`를 `playerId`로 매칭해 선형 보간한다(TO-DO 50번대, "공수 전환
 * 슬라이더" — 4번 개선안 중 축소판). 배열 인덱스로 짝짓지 않는 이유는
 * B팀 좌표가 `computeMatchupData`에서 이미 `mirrorPoint`를 거쳐 순서가
 * 보장되지 않기 때문이다. 한쪽 배열에만 있는 선수(현재 데이터 모델에선
 * 국면마다 같은 11명이라 실제로는 안 생기지만)는 보간하지 않고 원래
 * 좌표를 그대로 돌려준다 — 조용히 NaN을 만드는 대신.
 */
export function lerpPositions(from: PlayerPosition[], to: PlayerPosition[], t: number): PlayerPosition[] {
  const toById = new Map(to.map((p) => [p.playerId, p]))
  return from.map((f) => {
    const target = toById.get(f.playerId)
    if (!target) return f
    return { playerId: f.playerId, x: f.x + (target.x - f.x) * t, y: f.y + (target.y - f.y) * t }
  })
}

/**
 * 공수 전환 슬라이더가 보여주는 중간 상태의 좌표(TO-DO 50번대) — "빌드업
 * 시/파이널서드 진입 시/수비 블록 형성 시" 같은 새 스냅샷을 저장하는 대신,
 * 이미 있는 공격↔수비 두 국면 사이를 보간해서 "지금 공수가 전환된다면"을
 * 미리 보여주는 축소판이다(advisor 조언 — 턴오버 순간을 보여주는 게 유일하게
 * 앞뒤가 맞는 해석: A가 공격→수비로 내려가는 동안 B는 수비→공격으로
 * 올라간다, 둘이 각자 반대 방향으로 동시에 움직인다).
 *
 * t=0이면 지금 화면과 완전히 같은 상태(각 팀의 현재 국면)를 반환한다 —
 * 호출하는 쪽(MatchupView)이 t=0일 때 이 함수 자체를 안 부르고 기존
 * dataA.positions/positionsB를 그대로 쓰게 하는 게 더 안전하지만(불필요한
 * 재계산·참조 변경을 피하려고), 이 함수만 따로 테스트하기 위해 t=0 엣지
 * 케이스도 정확한 값을 내도록 만들어 둔다.
 */
export function computeTransitionPositions(
  analysisA: Analysis,
  analysisB: Analysis,
  phaseA: PhaseType,
  dataA: PhaseData,
  positionsB: PlayerPosition[],
  t: number,
): { aPositions: PlayerPosition[]; bPositions: PlayerPosition[] } {
  const otherPhase: PhaseType = phaseA === 'attack' ? 'defense' : 'attack'
  const aTo = analysisA.phases[otherPhase].positions
  // B의 목표 국면은 "전환이 끝나면 phaseA였던 이름을 B가 갖게 된다" — 항상
  // phaseA/phaseB가 서로 반대(computeMatchupData)이므로 B의 현재 국면은
  // otherPhase이고, 목표는 지금 A가 있는 국면(phaseA)이다.
  const bTo = analysisB.phases[phaseA].positions.map((p) => ({ playerId: p.playerId, ...mirrorPoint(p) }))
  return {
    aPositions: lerpPositions(dataA.positions, aTo, t),
    bPositions: lerpPositions(positionsB, bTo, t),
  }
}

export interface MatchupMarker {
  key: string
  player: Player
  formation: string
  index: number
  variant: 'A' | 'B'
  /** 원본(세로) 좌표계 — StaticPlayerNode에 그대로 넘긴다 */
  originalPosition: Point
  /** landscape 변환까지 끝난 위치 — 라벨 배치 계산 기준(마커 자체는 겹쳐도 그대로 둔다, 2026-09-09 사용자 결정) */
  landscapePoint: Point
  /** 이 선수의 현재 위치에서 시작하는 run 화살표가 있으면 반복 이동 경로
   * (원본 좌표계, 첫 점 = originalPosition), 없으면 null — TO-DO 48. */
  runPoints: Point[] | null
}

/**
 * "run" 화살표의 from이 이 선수의 현재 위치와 가까우면(ANNOTATION_LINK_EPS)
 * 매칭한다 — 에디터 PlayerNode(components/pitch/PlayerNode.tsx)의 같은
 * 판정을 전술 대결 뷰(TO-DO 48, "선수들이 천천히 계속 움직이면 좋겠어")에
 * 재사용한 것뿐이다. 화살표는 선수에 부착되지 않는 자유 좌표라 ID로
 * 연결할 수 없다(4단계 §5.1) — 좌표 근접으로만 판정한다.
 */
function findRunPoints(position: Point, runAnnotations: Annotation[]): Point[] | null {
  const arrow = runAnnotations.find((a) => Math.hypot(a.from.x - position.x, a.from.y - position.y) <= ANNOTATION_LINK_EPS)
  if (!arrow) return null
  // 첫 점을 정확히 position으로 고정 — 손으로 그린 화살표의 from이 position과
  // 완벽히 일치하지 않을 수 있는데, 그대로 쓰면 루프가 장전되는 순간 몇
  // 유닛 순간이동하는 것처럼 보인다(PlayerNode와 같은 이유).
  const [, ...rest] = annotationSamplePoints(arrow)
  return [{ x: position.x, y: position.y }, ...rest]
}

/**
 * 마커는 겹치면 그냥 겹치는 채로 둔다(2026-09-09 사용자 결정 — 스파이더파이어
 * 대신 예전처럼). MatchupView·VersusShareCard(TO-DO 41) 둘 다 같은 구성이
 * 필요해서 분리했다 — positionsB는 computeMatchupData의 결과를 그대로 받는다.
 * dataB는 B팀 run 화살표(annotations)만 쓴다 — positionsB와 같은 순서로
 * 미러링(landscape=false, positionsB 자체가 아직 landscape 변환 전이라)해서
 * 좌표 판정 기준을 맞춘다.
 */
export function buildMatchupMarkers(
  analysisA: Analysis,
  analysisB: Analysis,
  dataA: PhaseData,
  dataB: PhaseData,
  positionsB: PlayerPosition[],
): MatchupMarker[] {
  const runAnnotationsA = dataA.annotations.filter((a) => a.type === 'run')
  const runAnnotationsB = transformAnnotationsForMatchup(dataB.annotations, true, false).filter((a) => a.type === 'run')

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
        runPoints: findRunPoints(pos, runAnnotationsA),
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
        runPoints: findRunPoints(pos, runAnnotationsB),
      },
    ]
  })
  return [...markersA, ...markersB]
}

// 라벨 한 칸 밀어낼 때 y 증가량 — 라벨 height(2.6)보다 작으면 한 칸 밀어도
// 잔여 겹침이 남는다(TO-DO 36, 이름 앞에 포지션 코드가 붙으며 너비가 늘어나
// 겹침 판정 쌍이 늘어서 이 여유 부족이 더 자주 드러남). height보다 살짝
// 크게 잡아 한 번만 밀어도 확실히 떨어지게 한다.
const LABEL_STEP = 2.8

/** `buildMatchupMarkers`의 결과로 이름표 겹침 회피 오프셋(marker.key → y 오프셋)을 계산한다. */
export function computeMatchupLabelOffsets(markers: MatchupMarker[]): Map<string, number> {
  const labelBoxes: LabelBox[] = markers.map((marker) => ({
    id: marker.key,
    x: marker.landscapePoint.x,
    defaultY: marker.landscapePoint.y + LANDSCAPE_RADIUS.ry + 3,
    // +2는 이름 앞에 붙는 포지션 코드(GK/DF/MF/FW, 항상 2글자, TO-DO 36) 몫이다.
    // 1.6은 글자당 대략 추정한 너비(구 렌더링 기준)였는데, TO-DO 39에서 landscape
    // 글자가 LANDSCAPE_TEXT_X_SCALE(≈0.648)만큼 가로로 좁아지도록 보정해서
    // 실제 렌더링 너비도 그만큼 줄었다 — 겹침 판정이 실제보다 너무 넉넉하게
    // "겹친다"고 오판하지 않도록 같은 비율로 낮춘다.
    width: Math.max(6, (marker.player.name.length + 2) * 1.6 * LANDSCAPE_TEXT_X_SCALE),
    height: 2.6,
  }))
  return resolveLabelOverlap(labelBoxes, LABEL_STEP)
}
