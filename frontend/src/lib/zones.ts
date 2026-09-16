import type { Channel, Third } from '@/types/analysis'

// 2단계 §3.1 — 페널티 지역·골 지역 폭을 연장한 실제 기준선 (균등 20% 분할이 아님)
export const CHANNEL_BOUNDS: Record<Channel, [number, number]> = {
  leftWing: [0, 20],
  leftHalf: [20, 36.5],
  center: [36.5, 63.5],
  rightHalf: [63.5, 80],
  rightWing: [80, 100],
}

export const THIRD_BOUNDS: Record<Third, [number, number]> = {
  attacking: [0, 33.3],
  middle: [33.3, 66.7],
  defensive: [66.7, 100],
}

export const CHANNELS: Channel[] = ['leftWing', 'leftHalf', 'center', 'rightHalf', 'rightWing']
export const THIRDS: Third[] = ['attacking', 'middle', 'defensive']

/**
 * 위협 가중치(TO-DO 45) — 실제 경기 이벤트 데이터로 학습한 xT(Expected
 * Threat) 모델이 아니라 "중앙·전방일수록 더 위험하다"는 축구 상식을 고정
 * 값으로 반영한 것뿐이다. 15구역을 전부 동일하게 1표씩 세면(`computeOverload`
 * 기반 구역 우세) 자기 진영 구석에서 딴 우위와 상대 박스 앞 중앙에서 딴
 * 우위가 똑같이 1구역으로 상쇄돼 버린다(안첼로티 브라질 vs 이정효 수원삼성
 * 예시에서 실제로 2:2로 상쇄됐던 것) — `versusAdvantage.ts`의
 * `computeThreatWeightedScore`가 이 표를 곱해 그 문제를 줄인다. 골 확률
 * 예측이 아니므로(TO-DO 16/22 "가짜 확률 금지") 화면엔 %나 소수 확률이
 * 아니라 "가중 점수"로만 표기한다.
 *
 * leftWing/rightWing, leftHalf/rightHalf는 반드시 같은 값이어야 한다 —
 * 좌우 비대칭 가중치는 "왼쪽/오른쪽 헷갈림"을 설명하려던 43/44번 작업과
 * 정반대로 이 점수 자체에 좌우 편향을 몰래 집어넣는 셈이 된다.
 */
export const CHANNEL_THREAT_WEIGHT: Record<Channel, number> = {
  leftWing: 0.6,
  leftHalf: 1,
  center: 1.4,
  rightHalf: 1,
  rightWing: 0.6,
}

export const THIRD_THREAT_WEIGHT: Record<Third, number> = {
  attacking: 3,
  middle: 1,
  defensive: 0.3,
}

export function zoneThreatWeight(channel: Channel, third: Third): number {
  return CHANNEL_THREAT_WEIGHT[channel] * THIRD_THREAT_WEIGHT[third]
}

export type BottleneckLevel = 'none' | 'weak' | 'strong'

/**
 * "병목(Bottleneck)" 구역 판정(2차 4개 개선안 3번, "국면별 텐션 시각화" —
 * "어느 팀이 유리한지가 아니라... 두 포메이션이 겹치면서 가장 밀집되는
 * 압박 구역이 어디인지"). `computeOverload`의 `level`(diff 기준, 어느
 * 팀이 우세한지)과는 다른 판정 기준이다 — 병목은 우열과 무관하게 "양쪽
 * 다 사람이 몰려 있어서 부딪히는 구역"만 짚는다.
 *
 * own===0 또는 opp===0이면 "겹친다"고 볼 수 없다 — 한쪽만 몰려 있는
 * 구역(예: own=3, opp=0)은 이미 MatchupOverloadLayer의 색 타일이 보여주는
 * "그 팀이 우세한 구역"일 뿐, 두 포메이션이 충돌하는 지점이 아니다.
 * 양쪽 다 있을 때만 총원(own+opp)으로 세기를 매긴다 — own=1,opp=1(총 2)은
 * 이미 "고립 매치업"(1v1) 기능이 다루는 영역이라 여기서는 병목으로 안 친다.
 */
export function zoneBottleneckLevel(own: number, opp: number): BottleneckLevel {
  if (own === 0 || opp === 0) return 'none'
  const total = own + opp
  if (total >= 4) return 'strong'
  if (total === 3) return 'weak'
  return 'none'
}

/** 실측 환산 (105m x 68m) */
export const PITCH_LENGTH_M = 105 // y축 = 길이
export const PITCH_WIDTH_M = 68 // x축 = 폭
