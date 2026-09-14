import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { computeMatchupData } from '@/lib/matchup'
import { analysisSchema } from '@/lib/schema'
import type { Analysis } from '@/types/analysis'

const here = path.dirname(fileURLToPath(import.meta.url))
const samplesDir = path.resolve(here, '../../public/samples/managers')

function loadFixture(name: string): Analysis {
  const json = JSON.parse(readFileSync(path.join(samplesDir, name), 'utf-8'))
  const result = analysisSchema.safeParse(json)
  if (!result.success) throw new Error(`fixture invalid: ${name}`)
  return result.data as Analysis
}

// guardiola.json(맨체스터 시티) vs arteta.json(아스널) — TO-DO 38-2에서
// Playwright로 브라우저 실제 렌더링과 대조 확인했던 것과 같은 조합. 그때
// 확인한 사실(키포인트 배지 "맨체스터 시티: 왼쪽 하프스페이스 · 중원(2:1)",
// "아스널: 왼쪽 측면 · 중원(0:1)")을 회귀 테스트로 고정해 둔다.
const guardiola = loadFixture('guardiola.json')
const arteta = loadFixture('arteta.json')

describe('computeMatchupData', () => {
  it('labels come from each analysis match.homeTeam', () => {
    const result = computeMatchupData(guardiola, arteta, 'A')
    expect(result.labelA).toBe('맨체스터 시티')
    expect(result.labelB).toBe('아스널')
  })

  it('phaseA/phaseB flip with the attacker toggle', () => {
    expect(computeMatchupData(guardiola, arteta, 'A')).toMatchObject({ phaseA: 'attack', phaseB: 'defense' })
    expect(computeMatchupData(guardiola, arteta, 'B')).toMatchObject({ phaseA: 'defense', phaseB: 'attack' })
  })

  it('produces all 15 zones when both sides have positions', () => {
    const result = computeMatchupData(guardiola, arteta, 'A')
    expect(result.zones).toHaveLength(15)
  })

  it('excludes goalkeepers from the zone counts (matches the browser-verified badge text)', () => {
    const result = computeMatchupData(guardiola, arteta, 'A')
    // City의 top zone: 왼쪽 하프스페이스 · 중원, own(City)=2 : opp(Arsenal)=1.
    // City GK(p1)는 attack 국면에서 (50, 90) — 중앙 채널·수비 서드라 이 구역과
    // 무관하지만, 집계에 GK가 포함됐다면 다른 구역들의 own 카운트가 하나씩
    // 밀려 이 조합 자체가 달라진다. 실제 브라우저로 이미 확인한 값과 같다.
    expect(result.matchupAdvantage.aTopZone).toMatchObject({ channel: 'leftHalf', third: 'middle', own: 2, opp: 1 })
    expect(result.matchupAdvantage.bTopZone).toMatchObject({ channel: 'leftWing', third: 'middle', own: 0, opp: 1 })
  })
})
