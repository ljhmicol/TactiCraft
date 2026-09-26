import { describe, expect, it } from 'vitest'

import type { RosterTemplatePlayer } from '@/lib/api'
import { applyRosterTemplate } from '@/lib/rosterTemplate'
import { createEmptyAnalysis } from '@/store/analysisStore'

function emptyAnalysis() {
  return createEmptyAnalysis('4-3-3', {
    matchName: '',
    homeTeam: '',
    awayTeam: '',
    matchDate: '2026-09-08',
    analyzedTeam: 'home',
  })
}

describe('applyRosterTemplate(2026-09-26, 개선 로드맵 §7.2 "내 팀 템플릿")', () => {
  it('앞 11명은 이름·등번호·역할만 덮어쓰고 id·좌표는 그대로 유지한다', () => {
    const analysis = emptyAnalysis()
    const originalIds = analysis.players.map((p) => p.id)
    const originalPositions = analysis.phases.base.positions

    const templatePlayers: RosterTemplatePlayer[] = Array.from({ length: 11 }, (_, i) => ({
      name: `선수${i}`,
      number: i + 1,
      role: 'CB',
      tacticalRole: 'stopper-cb',
    }))

    const result = applyRosterTemplate(analysis, templatePlayers)

    expect(result.players).toHaveLength(11)
    expect(result.players.map((p) => p.id)).toEqual(originalIds)
    expect(result.players.map((p) => p.name)).toEqual(templatePlayers.map((t) => t.name))
    expect(result.players[0].tacticalRole).toBe('stopper-cb')
    // 좌표(positions)는 손대지 않았으므로 원본 참조가 그대로 유지된다.
    expect(result.phases.base.positions).toBe(originalPositions)
  })

  it('11명을 넘는 선수는 새 id로 벤치에 추가되고 어떤 국면의 positions에도 없다', () => {
    const analysis = emptyAnalysis()
    const templatePlayers: RosterTemplatePlayer[] = [
      ...Array.from({ length: 11 }, (_, i) => ({ name: `선발${i}`, number: i + 1 })),
      { name: '벤치1', number: 20 },
      { name: '벤치2', number: 21 },
    ]

    const result = applyRosterTemplate(analysis, templatePlayers)

    expect(result.players).toHaveLength(13)
    const benchNames = result.players.slice(11).map((p) => p.name)
    expect(benchNames).toEqual(['벤치1', '벤치2'])
    const benchIds = new Set(result.players.slice(11).map((p) => p.id))
    for (const phase of Object.values(result.phases)) {
      expect(phase.positions.some((pos) => benchIds.has(pos.playerId))).toBe(false)
    }
  })

  it('템플릿이 11명보다 적으면 남는 자리는 빈 placeholder 그대로 둔다', () => {
    const analysis = emptyAnalysis()
    const templatePlayers: RosterTemplatePlayer[] = [{ name: '한명뿐', number: 7 }]

    const result = applyRosterTemplate(analysis, templatePlayers)

    expect(result.players).toHaveLength(11)
    expect(result.players[0].name).toBe('한명뿐')
    expect(result.players[1].name).toBe('') // createEmptyAnalysis 기본값
  })
})
