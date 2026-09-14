import { describe, expect, it } from 'vitest'

import { computeMatchupAdvantage, computeSideAdvantage, suggestImprovement, THIRD_KOREAN, zoneLabel } from '@/lib/versusAdvantage'
import type { ZoneOverload } from '@/types/analysis'

function zone(diff: number, channel: ZoneOverload['channel'] = 'center', third: ZoneOverload['third'] = 'middle'): ZoneOverload {
  return { channel, third, own: Math.max(diff, 0), opp: Math.max(-diff, 0), diff, level: 'none' }
}

const third = THIRD_KOREAN('A팀', 'B팀')

describe('computeMatchupAdvantage', () => {
  it('splits positive diff zones into aZones, negative into bZones, zero as neutral', () => {
    const result = computeMatchupAdvantage([zone(2), zone(1), zone(0), zone(-1), zone(-3)])
    expect(result.aZones).toHaveLength(2)
    expect(result.bZones).toHaveLength(2)
    expect(result.neutralZoneCount).toBe(1)
    expect(result.totalZones).toBe(5)
  })

  it('sorts each side by |diff| descending and picks the top as aTopZone/bTopZone', () => {
    const result = computeMatchupAdvantage([
      zone(1, 'leftWing'),
      zone(3, 'center'),
      zone(-1, 'rightWing'),
      zone(-2, 'rightHalf'),
    ])
    expect(result.aZones.map((z) => z.channel)).toEqual(['center', 'leftWing'])
    expect(result.bZones.map((z) => z.channel)).toEqual(['rightHalf', 'rightWing'])
    expect(result.aTopZone?.diff).toBe(3)
    expect(result.bTopZone?.diff).toBe(-2)
  })

  it('returns null top zones and empty lists when nobody is ahead anywhere', () => {
    const result = computeMatchupAdvantage([zone(0), zone(0)])
    expect(result.aZones).toEqual([])
    expect(result.bZones).toEqual([])
    expect(result.aTopZone).toBeNull()
    expect(result.bTopZone).toBeNull()
  })

  it('handles an empty zone list', () => {
    const result = computeMatchupAdvantage([])
    expect(result).toEqual({
      aZones: [],
      bZones: [],
      neutralZoneCount: 0,
      totalZones: 0,
      aTopZone: null,
      bTopZone: null,
    })
  })
})

describe('zoneLabel', () => {
  it('always renders own:opp in A-first order regardless of which team the zone favors', () => {
    const aFavored = zone(2, 'leftWing', 'middle')
    const bFavored = zone(-2, 'rightWing', 'defensive')
    expect(zoneLabel(aFavored, third)).toBe('왼쪽 측면 · 중원(2:0)')
    expect(zoneLabel(bFavored, third)).toBe('오른쪽 측면 · A팀 골문 근처(0:2)')
  })
})

describe('suggestImprovement', () => {
  it('cites the concrete zone and score when a weakest zone exists', () => {
    const weak = zone(-3, 'leftHalf', 'defensive')
    expect(suggestImprovement(weak, third)).toBe(
      '왼쪽 하프스페이스 · A팀 골문 근처(0:3)에서 수적 열세 — 이 구역에 인원을 보강하는 재배치를 고려해보세요.',
    )
  })

  it('falls back to a neutral message when there is no weakest zone', () => {
    expect(suggestImprovement(null, third)).toBe('뚜렷한 열세 구역이 없어요 — 지금 배치를 유지해도 좋아 보입니다.')
  })
})

describe('computeSideAdvantage', () => {
  it('groups leftWing+leftHalf into left, center alone, rightHalf+rightWing into right', () => {
    const zones = [
      zone(2, 'leftWing'),
      zone(1, 'leftHalf'),
      zone(3, 'center'),
      zone(-1, 'rightHalf'),
      zone(-2, 'rightWing'),
    ]
    const result = computeSideAdvantage(zones)
    expect(result.left.totalZones).toBe(2)
    expect(result.left.aZones).toHaveLength(2)
    expect(result.center.totalZones).toBe(1)
    expect(result.center.aZones).toHaveLength(1)
    expect(result.right.totalZones).toBe(2)
    expect(result.right.bZones).toHaveLength(2)
  })

  it('does not leak zones from one side into another', () => {
    const zones = [zone(5, 'center')]
    const result = computeSideAdvantage(zones)
    expect(result.left.totalZones).toBe(0)
    expect(result.center.totalZones).toBe(1)
    expect(result.right.totalZones).toBe(0)
  })
})
