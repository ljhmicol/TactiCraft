import { describe, expect, it } from 'vitest'

import {
  computeMatchupAdvantage,
  computeSideAdvantage,
  computeThreatWeightedScore,
  suggestImprovement,
  THIRD_KOREAN,
  zoneLabel,
} from '@/lib/versusAdvantage'
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

describe('computeThreatWeightedScore', () => {
  it('flips the Ancelotti(A) vs 이정효 수원삼성(B) 2:2 tie toward B once zone danger is weighted', () => {
    // 안첼로티 브라질(A) vs 이정효 수원삼성(B) 실제 프리셋(A 공격×B 수비)을
    // 손으로 대조해서 나온 4개 비동률 구역 그대로다(TO-DO 45 대화 참조).
    // 단순 구역 개수로는 2:2 동률이지만, 브라질의 두 우위는 전부 자기
    // 진영(defensive)이고 수원의 두 우위는 middle·attacking(그중 하나는
    // 상대 박스 앞 중앙)이라 실제로는 수원 쪽이 훨씬 위협적이었다.
    const zones = [
      zone(2, 'leftHalf', 'defensive'), // 브라질 우위 — 자기 진영 구석
      zone(1, 'center', 'defensive'), // 브라질 우위 — 자기 진영 중앙
      zone(-1, 'leftWing', 'middle'), // 수원 우위 — 중원
      zone(-2, 'center', 'attacking'), // 수원 우위 — 상대(브라질) 박스 앞 중앙
    ]
    const equalWeightResult = computeMatchupAdvantage(zones)
    expect(equalWeightResult.aZones).toHaveLength(2)
    expect(equalWeightResult.bZones).toHaveLength(2) // 동률(2:2) — 단순 개수로는 이게 사용자가 봤던 "상쇄"

    const weighted = computeThreatWeightedScore(zones)
    expect(weighted.bScore).toBeGreaterThan(weighted.aScore) // 가중치를 곱하면 수원 쪽으로 뒤집힘
  })

  it('ignores tied zones and returns 0/0 when nobody is ahead anywhere', () => {
    expect(computeThreatWeightedScore([zone(0), zone(0)])).toEqual({ aScore: 0, bScore: 0 })
  })

  it('weighs leftWing/rightWing and leftHalf/rightHalf identically (no left/right bias in the score itself)', () => {
    const leftHeavy = computeThreatWeightedScore([zone(3, 'leftWing', 'attacking'), zone(2, 'leftHalf', 'middle')])
    const rightHeavy = computeThreatWeightedScore([zone(3, 'rightWing', 'attacking'), zone(2, 'rightHalf', 'middle')])
    expect(leftHeavy).toEqual(rightHeavy)
  })
})
