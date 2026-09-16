import { describe, expect, it } from 'vitest'

import { autoPressingLine, computeCompactness, outfieldPlayers, pressingLineLevel } from '@/lib/compactness'
import type { PlayerPosition } from '@/types/analysis'

const positions: PlayerPosition[] = [
  { playerId: 'gk', x: 50, y: 95 }, // y 최댓값 — GK로 간주되어 제외
  { playerId: 'df1', x: 20, y: 70 },
  { playerId: 'df2', x: 80, y: 70 },
  { playerId: 'fw', x: 50, y: 20 },
]

describe('outfieldPlayers', () => {
  it('y가 가장 큰 선수 1명(GK)을 제외한다', () => {
    const result = outfieldPlayers(positions)
    expect(result).toHaveLength(3)
    expect(result.some((p) => p.playerId === 'gk')).toBe(false)
  })
})

describe('autoPressingLine', () => {
  it('GK를 제외한 최대 y를 압박 라인으로 산출한다', () => {
    expect(autoPressingLine(positions)).toBe(70)
  })
})

describe('computeCompactness', () => {
  it('GK 제외 bounding box와 m 환산값을 계산한다 (y축 105m, x축 68m)', () => {
    const result = computeCompactness(positions)!
    expect(result.box).toEqual({ x: 20, y: 20, width: 60, height: 50 })
    // y축(세로) 50% -> 105m 기준, x축(가로) 60% -> 68m 기준. 축이 뒤바뀌면 이 값이 틀어진다.
    expect(result.verticalM).toBeCloseTo((50 * 105) / 100, 1)
    expect(result.horizontalM).toBeCloseTo((60 * 68) / 100, 1)
  })

  it('선수가 없으면 null을 반환한다', () => {
    expect(computeCompactness([])).toBeNull()
  })
})

describe('pressingLineLevel', () => {
  it('y=62 이내는 매우 높음으로 분류한다(2026-09-16 재조정 — 옛 "높음" 자리로 당김)', () => {
    expect(pressingLineLevel(0)).toBe('매우 높음')
    expect(pressingLineLevel(62)).toBe('매우 높음')
  })

  it('나머지 경계값도 7 단위 균등 간격(62/69/76/83)으로 분류한다', () => {
    expect(pressingLineLevel(63)).toBe('높음')
    expect(pressingLineLevel(69)).toBe('높음')
    expect(pressingLineLevel(70)).toBe('보통')
    expect(pressingLineLevel(76)).toBe('보통')
    expect(pressingLineLevel(77)).toBe('낮음')
    expect(pressingLineLevel(83)).toBe('낮음')
    expect(pressingLineLevel(84)).toBe('매우 낮음')
    expect(pressingLineLevel(100)).toBe('매우 낮음')
  })
})
