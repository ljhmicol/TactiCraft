import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import {
  axisMinuteAt,
  axisRatio,
  clusterByAxis,
  formatMinute,
  FULL_AXIS,
  timelineAxis,
} from '@/lib/timelineAxis'

describe('timelineAxis', () => {
  it('시점이 없거나 하나뿐이면 0~120분 전체 축이다', () => {
    expect(timelineAxis([])).toMatchObject({ min: 0, max: 120, zoomed: false })
    expect(timelineAxis([69])).toMatchObject({ min: 0, max: 120, zoomed: false })
  })

  it('넓게 퍼진 시점은 확대하지 않는다 — 경기 전체 맥락이 더 중요하다', () => {
    expect(timelineAxis([12, 40, 88])).toMatchObject({ min: 0, max: 120, zoomed: false })
    expect(timelineAxis([20, 25.1])).toMatchObject({ zoomed: false })
  })

  it('전부 같은 분이면 확대해도 겹침이 안 풀리므로 전체 축을 쓴다', () => {
    expect(timelineAxis([35, 35, 35])).toMatchObject({ zoomed: false })
  })

  it('좁은 구간에 몰려 있으면 그 구간으로 확대하고 눈금도 그 범위로 바뀐다', () => {
    const axis = timelineAxis([68.52, 68.85])
    expect(axis.zoomed).toBe(true)
    expect(axis.min).toBeGreaterThan(68.4)
    expect(axis.max).toBeLessThan(69)
    expect(axis.min).toBeLessThan(68.52)
    expect(axis.max).toBeGreaterThan(68.85)
    expect(axis.ticks).toHaveLength(4)
    expect(axis.ticks[0]).toBeCloseTo(axis.min)
    expect(axis.ticks[3]).toBeCloseTo(axis.max)
    // 전/후반 종료선은 범위 밖이라 그리지 않는다
    expect(axis.lines).toEqual([])
  })

  it('확대 축에서도 범위 밖으로 새지 않는다', () => {
    const axis = timelineAxis([0, 0.2])
    expect(axis.min).toBeGreaterThanOrEqual(0)
    expect(axisRatio(axis, -5)).toBe(0)
    expect(axisRatio(axis, 999)).toBe(100)
  })

  it('축 클릭 → 분 변환은 확대 축에서 초 단위를 살린다', () => {
    const zoomed = timelineAxis([68.52, 68.85])
    const mid = axisMinuteAt(zoomed, 0.5)
    expect(mid).toBeGreaterThan(68.5)
    expect(mid).toBeLessThan(68.9)
    expect(Number.isInteger(mid)).toBe(false)
    // 전체 축에서는 예전처럼 정수 분
    expect(Number.isInteger(axisMinuteAt(timelineAxis([]), 0.5))).toBe(true)
  })
})

describe('formatMinute', () => {
  it('정수 분은 69\' 꼴로, 소수는 분:초로 쓴다', () => {
    expect(formatMinute(69)).toBe("69'")
    expect(formatMinute(68.52)).toBe('68:31')
    expect(formatMinute(35.2)).toBe('35:12')
  })

  it('초가 60으로 반올림되면 다음 분으로 올린다', () => {
    expect(formatMinute(68.999)).toBe("69'")
  })
})

describe('명장면 프리셋이 실제로 확대 축에 올라가는지', () => {
  const dir = path.resolve(__dirname, '../../public/samples/matches')
  // 점(12px)이 서로 다른 중심을 갖도록 최소한 이만큼은 떨어져야 한다.
  // 폭 380px(max-w-md 트랙) 기준 백분율.
  const MIN_GAP_PX = 8
  const TRACK_PX = 380

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    it(`${file} — 모든 시점에 minute이 있고 점이 개별 클릭 가능하다`, () => {
      const d = JSON.parse(readFileSync(path.join(dir, file), 'utf-8'))
      const minutes: number[] = (d.changingPoints ?? []).map((cp: { minute?: number }) => cp.minute)
      expect(minutes.length).toBeGreaterThan(0)
      expect(minutes.every((m) => typeof m === 'number')).toBe(true)

      const axis = timelineAxis(minutes)
      expect(axis.zoomed).toBe(true)
      const xs = minutes.map((m) => (axisRatio(axis, m) / 100) * TRACK_PX).sort((a, b) => a - b)
      const gaps = xs.slice(1).map((x, i) => x - xs[i])
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(MIN_GAP_PX)
    })
  }
})

describe('clusterByAxis', () => {
  const pt = (id: string, minute: number) => ({ id, minute })

  it('멀리 떨어진 점은 각자 하나짜리 덩어리다', () => {
    const clusters = clusterByAxis(FULL_AXIS, [pt('a', 10), pt('b', 60), pt('c', 100)], 3.2)
    expect(clusters).toHaveLength(3)
    expect(clusters.every((c) => c.items.length === 1)).toBe(true)
  })

  it('축소하면 명장면 프리셋의 시점들이 한 덩어리로 묶인다', () => {
    const minutes = [68.52, 68.55, 68.6, 68.63, 68.77, 68.82, 68.83, 68.85]
    const clusters = clusterByAxis(FULL_AXIS, minutes.map((m, i) => pt(`p${i}`, m)), 3.2)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].items).toHaveLength(8)
  })

  it('확대 축에서는 대부분 풀린다 — 그게 확대하는 이유다', () => {
    const minutes = [68.52, 68.55, 68.6, 68.63, 68.77, 68.82, 68.83, 68.85]
    const axis = timelineAxis(minutes)
    const clusters = clusterByAxis(axis, minutes.map((m, i) => pt(`p${i}`, m)), 3.2)
    expect(clusters.length).toBeGreaterThanOrEqual(7)
  })

  it('시간 없는 시점은 빠지고, 덩어리 위치는 첫 점 기준이라 연쇄 병합되지 않는다', () => {
    const items: { id: string; minute?: number }[] = [
      pt('a', 10),
      { id: 'x' }, // 시간 없는 시점
      pt('b', 10.5),
      pt('c', 14),
      pt('d', 14.4),
    ]
    const clusters = clusterByAxis(FULL_AXIS, items, 3.2)
    expect(clusters.map((c) => c.items.map((i) => i.id))).toEqual([['a', 'b'], ['c', 'd']])
    expect(clusters[0].ratio).toBeCloseTo(axisRatio(FULL_AXIS, 10))
  })
})
