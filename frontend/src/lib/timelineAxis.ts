/**
 * 타임라인 시간축의 범위·눈금 계산 (2026-09-10).
 *
 * 원래 축은 0~120분 고정이었다. 그런데 실제 경기 명장면 프리셋(TO-DO 9번)처럼
 * 한 골 장면을 초 단위로 쪼갠 시점들은 20초 안에 다 몰려 있어서, 120분 축에
 * 올리면 점이 전부 1px 안에 겹쳐 어느 걸 눌러도 맨 위에 그려진 점만 잡힌다.
 * 그래서 그 프리셋들은 `minute`을 아예 비워 "시간 미정" 칩으로 표시했는데,
 * 라벨에는 "68:31"처럼 시간이 그대로 적혀 있어서 모순이었다(사용자 리포트).
 *
 * 해결: 시점들이 좁은 구간에 몰려 있으면 축 범위를 그 구간으로 좁힌다. 넓게
 * 퍼진 보통의 분석은 예전처럼 0~120분 축을 그대로 쓴다.
 */

export const AXIS_FULL_MIN = 0
export const AXIS_FULL_MAX = 120
const FULL_TICKS = [0, 45, 90, 120]
const HALF_TIME_LINES = [45, 90] // 전반/후반 종료선

/**
 * 전체 폭이 이보다 좁으면 확대한다(분). 120분 축에서 5분은 전체 폭의 4%라
 * 점(12px)들이 서로 붙어버리는 구간이다.
 */
const ZOOM_SPAN_THRESHOLD = 5

/**
 * 확대했을 때 양옆 여백(구간 길이 대비). 여백은 작을수록 좋다 — 여백만큼
 * 축이 넓어져 점 사이 간격이 다시 좁아진다. 비야 프리셋에는 1초(0.017분)
 * 간격의 이웃한 두 시점이 있어서, 이 값이 커지면 그 둘이 곧바로 겹친다.
 */
const ZOOM_PAD_RATIO = 0.06
/** 여백 최소값(분) — 구간이 아주 짧아도 첫/마지막 점이 축 끝에 붙지 않게 한다. */
const ZOOM_PAD_MIN = 0.02

export interface TimelineAxis {
  min: number
  max: number
  /** 좁은 구간으로 확대된 축인지 — true면 눈금이 분:초로 표시된다. */
  zoomed: boolean
  ticks: number[]
  /** 전/후반 종료선 중 현재 축 범위 안에 들어오는 것만. */
  lines: number[]
}

export const FULL_AXIS: TimelineAxis = {
  min: AXIS_FULL_MIN,
  max: AXIS_FULL_MAX,
  zoomed: false,
  ticks: FULL_TICKS,
  lines: HALF_TIME_LINES,
}

/** 시점들의 분 값으로 축 범위를 정한다. 시간이 없는 시점(undefined)은 넘기지 않는다. */
export function timelineAxis(minutes: number[]): TimelineAxis {
  const valid = minutes.filter((m) => Number.isFinite(m))
  if (valid.length < 2) return FULL_AXIS

  const lo = Math.min(...valid)
  const hi = Math.max(...valid)
  const span = hi - lo
  // span이 0이면(전부 같은 분) 확대해도 겹침이 안 풀리므로 전체 축을 쓴다.
  if (span <= 0 || span >= ZOOM_SPAN_THRESHOLD) return FULL_AXIS

  const pad = Math.max(span * ZOOM_PAD_RATIO, ZOOM_PAD_MIN)
  const min = Math.max(AXIS_FULL_MIN, lo - pad)
  const max = Math.min(AXIS_FULL_MAX, hi + pad)

  return {
    min,
    max,
    zoomed: true,
    ticks: [0, 1, 2, 3].map((i) => min + ((max - min) * i) / 3),
    lines: HALF_TIME_LINES.filter((m) => m > min && m < max),
  }
}

/** 축 범위 안에서의 위치(0~100%). */
export function axisRatio(axis: TimelineAxis, minute: number): number {
  const width = axis.max - axis.min
  if (width <= 0) return 0
  return Math.min(100, Math.max(0, ((minute - axis.min) / width) * 100))
}

/** 0~100% 위치를 분으로 되돌린다 — 축을 클릭해 새 시점을 만들 때 쓴다. */
export function axisMinuteAt(axis: TimelineAxis, ratio: number): number {
  const minute = axis.min + (axis.max - axis.min) * Math.min(1, Math.max(0, ratio))
  // 확대 축에서는 초 단위가 의미 있으므로 소수점 2자리까지 남긴다.
  return axis.zoomed ? Math.round(minute * 100) / 100 : Math.round(minute)
}

/**
 * 분 값을 사람이 읽는 문자열로. 정수에 가까우면 `68'`, 아니면 `68:31`.
 * 초가 60으로 반올림되는 경우(예: 68.999)는 다음 분으로 올린다.
 */
export function formatMinute(minute: number): string {
  let whole = Math.floor(minute)
  let seconds = Math.round((minute - whole) * 60)
  if (seconds >= 60) {
    whole += 1
    seconds -= 60
  }
  return seconds === 0 ? `${whole}'` : `${whole}:${String(seconds).padStart(2, '0')}`
}

/**
 * 축 위에서 서로 붙어 보이는 점들을 한 덩어리로 묶는다.
 *
 * 축을 축소(0~120분)하면 명장면 프리셋처럼 초 단위로 쪼갠 시점들이 다시
 * 겹치는데, 그때 점을 11개 겹쳐 그리는 대신 "시점 5개"짜리 덩어리 하나로
 * 보여주기 위한 것이다(2026-09-10 사용자 제안). 덩어리를 누르면 그 안의
 * 시점들을 차례로 넘어간다.
 */
export function clusterByAxis<T extends { minute?: number }>(
  axis: TimelineAxis,
  points: T[],
  minGapPct: number,
): { ratio: number; items: T[] }[] {
  const sorted = points
    .filter((p): p is T & { minute: number } => typeof p.minute === 'number')
    .map((p) => ({ p, ratio: axisRatio(axis, p.minute) }))
    .sort((a, b) => a.ratio - b.ratio)

  const clusters: { ratio: number; items: T[] }[] = []
  for (const { p, ratio } of sorted) {
    const last = clusters[clusters.length - 1]
    // 덩어리의 "첫" 점 기준으로 재므로, 점이 촘촘히 이어져도 덩어리가 무한정
    // 길어지지 않는다(연쇄 병합 방지).
    if (last && ratio - last.ratio <= minGapPct) {
      last.items.push(p)
      continue
    }
    clusters.push({ ratio, items: [p] })
  }
  return clusters
}
