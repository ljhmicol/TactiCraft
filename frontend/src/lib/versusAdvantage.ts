import { zoneThreatWeight } from '@/lib/zones'
import type { Channel, Third, ZoneOverload } from '@/types/analysis'

/**
 * 전술 대결 뷰의 "우위" 표시(TO-DO 22) — 실제 경기 결과 예측이 아니라 오버로드
 * 15구역 계산을 A/B 양쪽 기준으로 다시 센 것뿐이다. 확률(%)처럼 보이는 숫자는
 * 일부러 만들지 않는다(TO-DO-LIST.md 16번 "범위 밖" 참조) — 실제 시뮬레이션
 * 없이 승률을 보여주면 진짜 예측처럼 오해되기 쉽다.
 *
 * computeOverload는 "own(A) 기준으로 own이 앞선 구역"만 strong/weak로
 * 표시하도록 만들어져 있다(단일 팀 에디터 뷰용) — 여기서는 그 결과의
 * diff 부호를 그대로 이용해 B가 앞선 구역도 대칭적으로 센다.
 *
 * aZones/bZones는 |diff| 내림차순으로 정렬해서 돌려준다 — 가장 격차가 큰
 * 구역부터 보여주는 게(배지 문장·피치 강조 둘 다) 자연스럽다.
 */
export interface MatchupAdvantage {
  aZones: ZoneOverload[]
  bZones: ZoneOverload[]
  neutralZoneCount: number
  totalZones: number
  aTopZone: ZoneOverload | null
  bTopZone: ZoneOverload | null
}

export const CHANNEL_KOREAN: Record<Channel, string> = {
  leftWing: '왼쪽 측면',
  leftHalf: '왼쪽 하프스페이스',
  center: '중앙',
  rightHalf: '오른쪽 하프스페이스',
  rightWing: '오른쪽 측면',
}

/** third는 own(A) 기준 y좌표라 A/B 공수와 무관하게 "누구 골문 근처인지"로 표기한다. */
export const THIRD_KOREAN: (labelA: string, labelB: string) => Record<Third, string> = (labelA, labelB) => ({
  attacking: `${labelB} 골문 근처`,
  middle: '중원',
  defensive: `${labelA} 골문 근처`,
})

export function computeMatchupAdvantage(zones: ZoneOverload[]): MatchupAdvantage {
  const aZones = zones.filter((z) => z.diff > 0).sort((a, b) => b.diff - a.diff)
  const bZones = zones.filter((z) => z.diff < 0).sort((a, b) => a.diff - b.diff)
  const neutralZoneCount = zones.length - aZones.length - bZones.length

  return {
    aZones,
    bZones,
    neutralZoneCount,
    totalZones: zones.length,
    aTopZone: aZones[0] ?? null,
    bTopZone: bZones[0] ?? null,
  }
}

/** "왼쪽 하프스페이스 · 중원(2:1)" — own/opp는 항상 A 기준(own=A, opp=B)이다.
 * B 우세 구역을 설명할 때도 순서를 안 뒤집는다 — AdvantageBadge가 처음부터
 * 이 순서로 써 왔고(2026-09-07~), 화면에 이미 이 표기로 나가고 있어서
 * 새 컴포넌트만 다르게 쓰면 같은 구역이 문구마다 다르게 읽힌다. */
export function zoneLabel(z: ZoneOverload, third: Record<Third, string>): string {
  return `${CHANNEL_KOREAN[z.channel]} · ${third[z.third]}(${z.own}:${z.opp})`
}

/**
 * 전술 개선방안(TO-DO 38 후속, "각 팀의 전술 개선방안"). 확률·승률과 달리
 * 이건 지금 그려진 좌표를 그대로 센 사실이라 "가짜 예측" 금지 원칙(파일
 * 상단 docstring)에 안 걸린다 — 시뮬레이션이 아니라 "이 구역은 인원이
 * 적다"는 관찰이다.
 *
 * A팀의 약점 구역은 B팀이 가장 크게 앞선 구역과 같다(제로섬이라 diff
 * 부호만 다를 뿐 같은 구역) — 그래서 호출부는 A팀 제안에 `bTopZone`을,
 * B팀 제안에 `aTopZone`을 넘긴다(반대로 넘기는 게 아니라 "상대가 가장
 * 앞선 구역 = 내가 가장 뒤진 구역"이라는 뜻).
 */
// "열세"(승패 지향) 대신 "공간이 열려 있다"(중립적 분석 용어)로 쓴다
// (2026-09-15, "우세/열세 프레임에서 공간/밀집 프레임으로" 피드백) —
// 판정이 아니라 지금 배치에서 상대적으로 인원이 비어 관찰되는 사실이다.
export function suggestImprovement(weakestZone: ZoneOverload | null, third: Record<Third, string>): string {
  if (!weakestZone) return '뚜렷하게 공간이 열린 구역이 없어요 — 지금 배치를 유지해도 좋아 보입니다.'
  return `${zoneLabel(weakestZone, third)}에 공간이 열려 있음 — 이 구역에 인원을 보강하는 재배치를 고려해보세요.`
}

/**
 * "왼쪽/중앙/오른쪽 3구역으로 나눠서... 게이지바로"(TO-DO 40) — 기존
 * AdvantageBadge의 게이지 바(전체 15구역 중 A/B 우세 비율)는 5채널×3서드를
 * 전부 합친 하나의 숫자라 "왼쪽은 누가 우세한지"처럼 좌우로 나눠 보기엔
 * 너무 뭉뚱그려져 있었다. 5채널(leftWing/leftHalf/center/rightHalf/
 * rightWing)을 3구역으로 묶어(왼쪽=leftWing+leftHalf, 중앙=center,
 * 오른쪽=rightHalf+rightWing) 각각 같은 computeMatchupAdvantage를
 * 재사용해서 구한다 — 새로운 판정 기준이 아니라 기존 15구역 집계를
 * 다른 묶음으로 다시 나눈 것뿐이다.
 */
export type PitchSide = 'left' | 'center' | 'right'

export const SIDE_KOREAN: Record<PitchSide, string> = {
  left: '왼쪽',
  center: '중앙',
  right: '오른쪽',
}

const SIDE_CHANNELS: Record<PitchSide, Channel[]> = {
  left: ['leftWing', 'leftHalf'],
  center: ['center'],
  right: ['rightHalf', 'rightWing'],
}

export function computeSideAdvantage(zones: ZoneOverload[]): Record<PitchSide, MatchupAdvantage> {
  return {
    left: computeMatchupAdvantage(zones.filter((z) => SIDE_CHANNELS.left.includes(z.channel))),
    center: computeMatchupAdvantage(zones.filter((z) => SIDE_CHANNELS.center.includes(z.channel))),
    right: computeMatchupAdvantage(zones.filter((z) => SIDE_CHANNELS.right.includes(z.channel))),
  }
}

export interface ThreatWeightedScore {
  aScore: number
  bScore: number
}

/**
 * 위협 가중 점수(TO-DO 45) — "왼쪽/중앙/오른쪽으로 세면 1:1인데, 실제로는
 * 한쪽은 자기 진영 구석 우위고 한쪽은 상대 박스 앞 중앙 우위라 훨씬
 * 위험한데 똑같이 상쇄돼 안 보인다"는 지적(안첼로티 브라질 vs 이정효
 * 수원삼성 예시로 확인)에서 나왔다. `computeOverload`가 이미 낸 15구역
 * own/opp 차이(diff)에 `zoneThreatWeight`(중앙·전방일수록 큼)를 곱해
 * 합산한다 — 새 판정 기준이 아니라 기존 구역 우세 집계에 가중치만 얹은
 * 것이다. 동률(diff=0) 구역은 애초에 어느 쪽에도 기여하지 않는다.
 *
 * 기존 "N구역 우세" 카운트를 대체하지 않는다 — 둘 다 같이 보여줘야 이
 * 점수가 어디서 나왔는지 사용자가 검증할 수 있다(AdvantageBadge 참조).
 * 반올림은 소수 첫째 자리까지만 — 확률처럼 보일 정도로 정밀하게 보이지
 * 않게 한다.
 */
export function computeThreatWeightedScore(zones: ZoneOverload[]): ThreatWeightedScore {
  let aScore = 0
  let bScore = 0
  for (const z of zones) {
    if (z.diff === 0) continue
    const weight = zoneThreatWeight(z.channel, z.third)
    if (z.diff > 0) aScore += z.diff * weight
    else bScore += -z.diff * weight
  }
  return { aScore: Math.round(aScore * 10) / 10, bScore: Math.round(bScore * 10) / 10 }
}

export interface ZoneThreatContribution {
  channel: Channel
  third: Third
  /** diff(own−opp) × zoneThreatWeight, 부호 있음 — 양수는 A, 음수는 B 쪽
   * 기여를 뜻한다. computeThreatWeightedScore의 aScore/bScore는 이 값을
   * 부호별로 합산한 총점이다. */
  contribution: number
}

/**
 * 위협 가중 점수를 구역별로 쪼갠다(TO-DO 50번대, "위협 가중 점수 옆 ⓘ
 * 버튼 안에 히트맵" 피드백) — `computeThreatWeightedScore`는 합계만 내서
 * "그 점수가 어느 구역에서 왔는지"를 보여줄 수 없다. 같은 diff×weight
 * 계산을 구역 단위로 남겨서 피치 위에 그라데이션으로 칠할 때 쓴다.
 */
export function computeZoneThreatContributions(zones: ZoneOverload[]): ZoneThreatContribution[] {
  return zones.map((z) => ({
    channel: z.channel,
    third: z.third,
    contribution: z.diff * zoneThreatWeight(z.channel, z.third),
  }))
}
