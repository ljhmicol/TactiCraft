import { clampCoord } from '@/lib/coords'
import { pressingLineLevel, type PressingLineLevel } from '@/lib/compactness'
import { circularRadius } from '@/lib/pitchMarkings'
import { positionInfoAt } from '@/lib/positions'
import { PLAYER_COLORS } from '@/lib/theme'
import type { Player, PlayerPosition } from '@/types/analysis'

/**
 * FM(풋볼매니저) 스타일로 압박 라인을 5단계 중 하나로 직접 지정한다
 * (2026-09-08 사용자 요청 — "포메이션과 공격 미들 수비 간격 비율은 유지
 * 하면서 압박 라인을 높이고 줄이게"). `pressingLineLevel`이 라인을 읽는
 * 데 쓰는 5단계 경계(62/69/76/83)와 같은 등급을 그대로 쓴다 — 그래야
 * "이 단계를 고르면 라벨도 그 단계로 보인다"가 항상 성립한다.
 *
 * 목표 y 2차 재조정(2026-09-16, "매우 높음을 높음 정도로 바꾸고 매우
 * 낮음은 낮음 정도로 바꿔줘. 그 사이 압박 라인들은 간격 균일하게") —
 * 예전엔 "매우 높음"(목표 40)·"매우 낮음"(목표 95)이 극단적으로 멀어서
 * 실전에서 잘 안 쓰였다. 양 끝을 옛 "높음"·"낮음" 자리(58/86)로 당기고,
 * 5단계를 그 구간 안에서 7 단위로 균등 배치했다 — 이제 중앙값이 아니라
 * 등차수열이다(예전엔 "매우 높음" 구간 폭이 넓어 중앙값을 피했던 이유
 * 자체가, 구간을 좁혀서 사라졌다).
 */
const STEP_TARGET_Y: Record<PressingLineLevel, number> = {
  '매우 높음': 58,
  높음: 65,
  보통: 72,
  낮음: 79,
  '매우 낮음': 86,
}

export const PRESSING_LINE_LEVELS: PressingLineLevel[] = ['매우 높음', '높음', '보통', '낮음', '매우 낮음']

// 선수 원(PLAYER_COLORS.own.radius를 축 보정한 ry) + 역할 라벨(원 위 -1.4)이
// 골라인에서 안 잘리게 최전방 선수가 못 넘어갈 최소 y(2026-09-08 사용자
// 리포트 — "공격수들이 반원 형태로 짤리더라". circularRadius(2.6).ry ≈
// 1.68 + 라벨 오프셋 1.4 ≈ 3.08 위까지 그려지므로 여유를 둬 4로 잡는다).
const OWN_RADIUS_Y = circularRadius(PLAYER_COLORS.own.radius).ry
const FORWARD_SAFE_MARGIN = Math.ceil(OWN_RADIUS_Y + 1.4) + 1

/** GK는 항상 players 배열의 0번(formations.ts 규약)이지만, 만일을 대비해 실제로 찾는다. */
export function findGkPlayerId(players: Player[], formation: string): string | undefined {
  const gkIndex = players.findIndex((_, i) => positionInfoAt(formation, i)?.line === 'GK')
  return gkIndex >= 0 ? players[gkIndex].id : undefined
}

/** GK를 뺀 출전 선수 중 가장 깊은(y 최댓값) 위치 — 이 국면의 "현재 수비 라인" 기준점. */
export function currentBackLineY(positions: PlayerPosition[], gkPlayerId: string | undefined): number | null {
  const outfield = positions.filter((p) => p.playerId !== gkPlayerId)
  if (outfield.length === 0) return null
  return Math.max(...outfield.map((p) => p.y))
}

/** 지금 이 국면의 압박 라인이 5단계 중 어디에 해당하는지 — Select의 현재 선택값으로 쓴다. */
export function currentPressingLineLevel(positions: PlayerPosition[], gkPlayerId: string | undefined): PressingLineLevel | null {
  const y = currentBackLineY(positions, gkPlayerId)
  return y == null ? null : pressingLineLevel(y)
}

/**
 * targetLevel에 맞는 y로 GK를 제외한 전원을 옮긴다. 두 단계로 시도한다:
 *
 * 1. **평행이동 우선** — 같은 델타를 전원에 더한다. 라인 사이 간격(절대값)이
 *    그대로 보존되는 가장 좋은 경우다. 이동 후에도 최전방이 안전선
 *    (`FORWARD_SAFE_MARGIN`) 아래로 안 내려가면 이걸로 끝낸다.
 * 2. **비율 유지 압축** — 평행이동하면 최전방이 골라인에 너무 붙어(원이
 *    잘림) 안전선을 넘어갈 때만 쓴다. 백라인은 목표 y에 정확히 맞추고,
 *    최전방은 안전선에 맞춘 뒤, 그 사이 나머지 선수는 **간격의 절대값이
 *    아니라 상대적 비율**을 유지한 채 압축한다(2026-09-08, 2차 요청 —
 *    "간격이 깨지면 그냥 비율만 유지하고 압박 라인을 높아지게, 간격은
 *    줄어들어도 되니까"). 그래야 "매우 높음"처럼 원래 대형 폭이 안전선
 *    안에 다 못 들어가는 극단적인 단계도 실제로 도달할 수 있다.
 *
 * GK는 어느 경우든 움직이지 않는다(압박 라인은 백라인 얘기지 GK 얘기가
 * 아니다).
 */
export function shiftPositionsToPressingLevel(
  positions: PlayerPosition[],
  gkPlayerId: string | undefined,
  targetLevel: PressingLineLevel,
): { positions: PlayerPosition[]; pressingLineY: number } | null {
  const outfield = positions.filter((p) => p.playerId !== gkPlayerId)
  if (outfield.length === 0) return null

  const currentBackY = Math.max(...outfield.map((p) => p.y))
  const currentFrontY = Math.min(...outfield.map((p) => p.y))
  const targetBackY = STEP_TARGET_Y[targetLevel]

  const shiftDelta = targetBackY - currentBackY
  const shiftedFrontY = currentFrontY + shiftDelta

  let mapY: (y: number) => number
  let resultBackY: number

  if (shiftedFrontY >= FORWARD_SAFE_MARGIN) {
    // 평행이동으로 충분하다 — 간격을 그대로 보존한다.
    mapY = (y) => clampCoord(y + shiftDelta)
    resultBackY = targetBackY
  } else {
    // 평행이동하면 최전방이 골라인에 너무 붙는다 — 백라인은 목표에 정확히
    // 맞추고 최전방은 안전선에 맞춘 뒤, 그 사이는 비율로 압축한다.
    const oldSpan = currentBackY - currentFrontY
    const newFrontY = FORWARD_SAFE_MARGIN
    const newSpan = targetBackY - newFrontY
    mapY =
      oldSpan < 1e-6
        ? () => clampCoord(targetBackY) // 전원이 같은 y였던 극단적 경우 — 다 같이 목표로
        : (y) => clampCoord(newFrontY + ((y - currentFrontY) / oldSpan) * newSpan)
    resultBackY = targetBackY
  }

  return {
    positions: positions.map((p) => (p.playerId === gkPlayerId ? p : { ...p, y: mapY(p.y) })),
    pressingLineY: resultBackY,
  }
}
