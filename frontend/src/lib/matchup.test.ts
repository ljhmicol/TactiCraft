import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  buildMatchupMarkers,
  computeIsolationMatchups,
  computeMatchupData,
  computeTransitionPositions,
  lerpPositions,
  playersInZone,
} from '@/lib/matchup'
import { mirrorPoint } from '@/lib/coords'
import { analysisSchema } from '@/lib/schema'
import type { Analysis, PlayerPosition } from '@/types/analysis'

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
const ancelotti = loadFixture('ancelotti.json')
const suwon = loadFixture('lee_jeonghyo_suwon.json')

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

describe('playersInZone', () => {
  it('returns exactly as many players as the zone own/opp count for the browser-verified top zones (TO-DO 46)', () => {
    const result = computeMatchupData(guardiola, arteta, 'A')
    const { aTopZone, bTopZone } = result.matchupAdvantage
    const aPlayers = playersInZone(result.dataA.positions, guardiola.players, guardiola.formation, aTopZone!.channel, aTopZone!.third)
    const bPlayers = playersInZone(result.positionsB, arteta.players, arteta.formation, bTopZone!.channel, bTopZone!.third)
    expect(aPlayers).toHaveLength(aTopZone!.own) // City: 2
    expect(bPlayers).toHaveLength(bTopZone!.opp) // Arsenal: 1
    expect(aPlayers.every((p) => p.line !== 'GK')).toBe(true)
  })

  it('excludes goalkeepers even when a GK would geometrically fall inside the zone bounds', () => {
    const result = computeMatchupData(guardiola, arteta, 'A')
    // City GK(attack 국면 x=50,y=90)는 center/defensive 구역에 기하학적으로
    // 들어간다 — 그 구역을 직접 조회해도 목록에 GK가 나오면 안 된다.
    const players = playersInZone(result.dataA.positions, guardiola.players, guardiola.formation, 'center', 'defensive')
    expect(players.every((p) => p.line !== 'GK')).toBe(true)
  })
})

describe('computeIsolationMatchups', () => {
  it('finds the two winger isolations in the Ancelotti(A) vs 이정효 수원삼성(B) case (TO-DO 47)', () => {
    // TO-DO 45 대화에서 손으로 대조해 둔 좌표 그대로다: 브라질 비니시우스
    // 주니오르(LW, attack 8,20)와 수원 정동윤(RB, defense 84,78 →
    // 미러링 16,22)가 왼쪽 측면·attacking 서드에서 1:1, 브라질 하양(RW,
    // attack 90,18)과 수원 김민우(LB, defense 16,78 → 미러링 84,22)가
    // 오른쪽 측면·attacking 서드에서 1:1 — 둘 다 diff=0이라
    // MatchupOverloadLayer도 위협 가중 점수(TO-DO 45)도 안 보여주는,
    // 이 기능이 아니면 화면 어디에도 안 나타나는 구역이다.
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const isolations = computeIsolationMatchups(result.zones, result.dataA, ancelotti, result.positionsB, suwon)

    const leftWingAttacking = isolations.find((iso) => iso.zone.channel === 'leftWing' && iso.zone.third === 'attacking')
    expect(leftWingAttacking?.aPlayer.player.name).toBe('비니시우스 주니오르')
    expect(leftWingAttacking?.bPlayer.player.name).toBe('정동윤')

    const rightWingAttacking = isolations.find((iso) => iso.zone.channel === 'rightWing' && iso.zone.third === 'attacking')
    expect(rightWingAttacking?.aPlayer.player.name).toBe('하양')
    expect(rightWingAttacking?.bPlayer.player.name).toBe('김민우')
  })

  it('filters out low-danger 1v1s below the threat-weight floor (e.g. own-half duels)', () => {
    // 가짜 15구역으로 defensive third 1v1(가중치 0.18~0.42, 전부 0.6 미만)을
    // 만들면 결과에서 빠져야 한다 — "자기 진영 구석 1v1"까지 다 보여주면
    // "실용성"이 없다는 advisor 지적을 그대로 회귀 가드로 남긴다.
    const zones = [
      { channel: 'leftWing' as const, third: 'defensive' as const, own: 1, opp: 1, diff: 0, level: 'none' as const },
      { channel: 'center' as const, third: 'defensive' as const, own: 1, opp: 1, diff: 0, level: 'none' as const },
    ]
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const isolations = computeIsolationMatchups(zones, result.dataA, ancelotti, result.positionsB, suwon)
    expect(isolations).toEqual([])
  })

  it('sorts by threat weight descending so the most dangerous isolation comes first', () => {
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const isolations = computeIsolationMatchups(result.zones, result.dataA, ancelotti, result.positionsB, suwon)
    for (let i = 1; i < isolations.length; i++) {
      expect(isolations[i - 1].weight).toBeGreaterThanOrEqual(isolations[i].weight)
    }
  })
})

describe('lerpPositions (TO-DO 50번대, 공수 전환 슬라이더)', () => {
  const from: PlayerPosition[] = [
    { playerId: 'p1', x: 10, y: 20 },
    { playerId: 'p2', x: 50, y: 50 },
  ]
  const to: PlayerPosition[] = [
    { playerId: 'p1', x: 30, y: 60 },
    { playerId: 'p2', x: 90, y: 10 },
  ]

  it('returns exactly the from-endpoint at t=0', () => {
    expect(lerpPositions(from, to, 0)).toEqual(from)
  })

  it('returns exactly the to-endpoint at t=1', () => {
    expect(lerpPositions(from, to, 1)).toEqual([
      { playerId: 'p1', x: 30, y: 60 },
      { playerId: 'p2', x: 90, y: 10 },
    ])
  })

  it('interpolates linearly at t=0.5', () => {
    expect(lerpPositions(from, to, 0.5)).toEqual([
      { playerId: 'p1', x: 20, y: 40 },
      { playerId: 'p2', x: 70, y: 30 },
    ])
  })

  it('leaves a player missing from the target set at its original point instead of producing NaN', () => {
    const partialTo: PlayerPosition[] = [{ playerId: 'p1', x: 30, y: 60 }]
    const result = lerpPositions(from, partialTo, 0.5)
    expect(result.find((p) => p.playerId === 'p2')).toEqual({ playerId: 'p2', x: 50, y: 50 })
    expect(result.some((p) => Number.isNaN(p.x) || Number.isNaN(p.y))).toBe(false)
  })
})

describe('computeTransitionPositions (TO-DO 50번대, 공수 전환 슬라이더)', () => {
  it('at t=0 matches the current resting state exactly (A attacking)', () => {
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const transition = computeTransitionPositions(ancelotti, suwon, result.phaseA, result.dataA, result.positionsB, 0)
    expect(transition.aPositions).toEqual(result.dataA.positions)
    expect(transition.bPositions).toEqual(result.positionsB)
  })

  it('at t=1, A has fully swapped into its other phase and B into A’s starting phase (mirrored)', () => {
    const result = computeMatchupData(ancelotti, suwon, 'A') // phaseA='attack'
    const transition = computeTransitionPositions(ancelotti, suwon, result.phaseA, result.dataA, result.positionsB, 1)
    expect(transition.aPositions).toEqual(ancelotti.phases.defense.positions)
    expect(transition.bPositions).toEqual(
      suwon.phases.attack.positions.map((p) => ({ playerId: p.playerId, ...mirrorPoint(p) })),
    )
  })

  it('is symmetric: computing from the B-attacking side and going to t=1 lands back on A-attacking positions', () => {
    // attacker='B'일 때 phaseA='defense' — t=1로 보내면 A는 attack으로,
    // B는(현재 attack인) B가 phaseA(defense)로 넘어간다. 이건 정확히
    // attacker='A' 쪽 resting 상태(t=0)와 같아야 한다(둘 다 "A 공격 × B 수비").
    const bAttacking = computeMatchupData(ancelotti, suwon, 'B') // phaseA='defense'
    const transition = computeTransitionPositions(ancelotti, suwon, bAttacking.phaseA, bAttacking.dataA, bAttacking.positionsB, 1)
    const aAttacking = computeMatchupData(ancelotti, suwon, 'A')
    expect(transition.aPositions).toEqual(aAttacking.dataA.positions)
    expect(transition.bPositions).toEqual(aAttacking.positionsB)
  })
})

describe('buildMatchupMarkers runPoints (TO-DO 48, "선수들이 천천히 계속 움직이면 좋겠어")', () => {
  it('attaches runPoints to a team-A player whose position matches a run arrow start', () => {
    // ancelotti.json attack 국면의 "anc-atk-lw" run 화살표: from(8,20)→to(15,8).
    // 비니시우스 주니오르(p9, LW)의 attack 위치가 정확히 (8,20)이다.
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const markers = buildMatchupMarkers(ancelotti, suwon, result.dataA, result.dataB, result.positionsB)
    const marker = markers.find((m) => m.player.name === '비니시우스 주니오르')
    expect(marker?.runPoints?.[0]).toEqual({ x: 8, y: 20 })
    expect(marker?.runPoints?.at(-1)).toEqual({ x: 15, y: 8 })
  })

  it('mirrors a team-B run arrow into A-frame coordinates before matching', () => {
    // lee_jeonghyo_suwon.json defense 국면엔 run 화살표가 3개 있다
    // (sw-def-st1/st2/rm) — 일류첸코(ST, defense 40,44)의 화살표(→36,34)를
    // 미러링하면 시작점(60,56)→끝점(64,66)이 돼야 한다.
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const markers = buildMatchupMarkers(ancelotti, suwon, result.dataA, result.dataB, result.positionsB)
    const marker = markers.find((m) => m.player.name === '일류첸코')
    expect(marker?.runPoints?.[0]).toEqual({ x: 60, y: 56 })
    expect(marker?.runPoints?.at(-1)).toEqual({ x: 64, y: 66 })
  })

  it('leaves runPoints null for a player with no matching run arrow (e.g. the goalkeeper)', () => {
    const result = computeMatchupData(ancelotti, suwon, 'A')
    const markers = buildMatchupMarkers(ancelotti, suwon, result.dataA, result.dataB, result.positionsB)
    const gk = markers.find((m) => m.player.name === '알리송')
    expect(gk?.runPoints).toBeNull()
  })
})
