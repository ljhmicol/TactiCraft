import { describe, expect, it } from 'vitest'

import { zoneBottleneckLevel } from '@/lib/zones'

describe('zoneBottleneckLevel', () => {
  it('is none when either side has nobody in the zone (no overlap, not a clash)', () => {
    expect(zoneBottleneckLevel(3, 0)).toBe('none')
    expect(zoneBottleneckLevel(0, 4)).toBe('none')
    expect(zoneBottleneckLevel(0, 0)).toBe('none')
  })

  it('is none for a bare 1v1 (that is the isolation-matchup feature\'s territory, not a bottleneck)', () => {
    expect(zoneBottleneckLevel(1, 1)).toBe('none')
  })

  it('is weak when both sides overlap and total is exactly 3', () => {
    expect(zoneBottleneckLevel(2, 1)).toBe('weak')
    expect(zoneBottleneckLevel(1, 2)).toBe('weak')
  })

  it('is strong when both sides overlap and total is 4 or more', () => {
    expect(zoneBottleneckLevel(2, 2)).toBe('strong')
    expect(zoneBottleneckLevel(3, 2)).toBe('strong')
    expect(zoneBottleneckLevel(4, 4)).toBe('strong')
  })
})
