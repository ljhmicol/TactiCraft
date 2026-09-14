import { PITCH_LENGTH_M, PITCH_WIDTH_M } from '@/lib/zones'

/**
 * 규정 치수(m)를 0~100 좌표계로 환산한다. Pitch는 preserveAspectRatio="none"으로
 * x/y를 독립적으로 늘리므로, 실제로는 원인 마킹(센터서클 등)도 각 축의 m 환산값을
 * 그대로 써야 화면에서 다시 원으로 보인다 (x축은 68m, y축은 105m 기준).
 */
const toX = (m: number) => (m / PITCH_WIDTH_M) * 100
const toY = (m: number) => (m / PITCH_LENGTH_M) * 100

const CENTER_CIRCLE_RADIUS_M = 9.15
const PENALTY_AREA_DEPTH_M = 16.5
const PENALTY_AREA_WIDTH_M = 40.32
const GOAL_AREA_DEPTH_M = 5.5
const GOAL_AREA_WIDTH_M = 18.32
const PENALTY_SPOT_DIST_M = 11

export const CENTER_CIRCLE = { rx: toX(CENTER_CIRCLE_RADIUS_M), ry: toY(CENTER_CIRCLE_RADIUS_M) }

export const PENALTY_AREA = {
  depth: toY(PENALTY_AREA_DEPTH_M),
  halfWidth: toX(PENALTY_AREA_WIDTH_M / 2),
}

export const GOAL_AREA = {
  depth: toY(GOAL_AREA_DEPTH_M),
  halfWidth: toX(GOAL_AREA_WIDTH_M / 2),
}

export const PENALTY_SPOT_Y = toY(PENALTY_SPOT_DIST_M)

/** 선수 노드 반지름(SVG 단위)을 화면상 원으로 보이도록 축별로 보정한다. */
export function circularRadius(rUnits: number) {
  return { rx: rUnits, ry: rUnits * (PITCH_WIDTH_M / PITCH_LENGTH_M) }
}

/**
 * 가로 모드(TO-DO 21)에서는 화면 x축이 원래 y축(105m, 긴 쪽) 역할을 하므로
 * 보정 비율의 rx/ry가 서로 바뀐다 — portrait용 {rx,ry}를 그대로 스왑하면 된다.
 */
export function swapForLandscape<T extends { rx: number; ry: number }>(r: T): T {
  return { ...r, rx: r.ry, ry: r.rx }
}

/**
 * 글자 가로 비율 보정(TO-DO 39, "선수이름들이 너무 가로로 펼쳐진 느낌").
 * `<text>`는 원(circularRadius)과 달리 rx/ry로 따로 보정할 수 없어서, 그
 * 대신 글자 앵커점에 `scale(LANDSCAPE_TEXT_X_SCALE, 1)`을 걸어 가로 방향만
 * 되돌린다. 세로 대결 뷰(landscape, x축이 105m 긴 쪽을 담당)에서는 보정 없이
 * 두면 글자가 약 1.54배(105/68) 옆으로 퍼져 보인다 — 실측(getBoundingClientRect
 * 종횡비)으로도 같은 문자열이 portrait 대비 landscape에서 약 3배 더 넓적하게
 * 나오는 걸 확인했다. portrait(에디터·공유 카드·GIF)는 MVP 때부터 지금
 * 모습 그대로 사용자가 계속 확인해 온 기준선이라 이번엔 손대지 않는다 —
 * 그래서 이 상수는 landscape 전용이고 portrait에서는 보정 계수 1(무보정)을
 * 쓴다(TO-DO 39 각 호출부 참조).
 */
export const LANDSCAPE_TEXT_X_SCALE = PITCH_WIDTH_M / PITCH_LENGTH_M
