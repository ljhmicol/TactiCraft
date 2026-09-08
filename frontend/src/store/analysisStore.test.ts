import { beforeEach, describe, expect, it } from 'vitest'

import { FORMATIONS } from '@/lib/formations'
import { analysisSchema } from '@/lib/schema'

import { createEmptyAnalysis, useAnalysisStore } from './analysisStore'

/** TO-DO 14 — 벤치 선수(11명 초과) 추가/삭제가 선발 인덱스·좌표·스키마를 깨지 않는지 확인한다. */
describe('analysisStore — 벤치 선수', () => {
  beforeEach(() => {
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-01',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
  })

  it('addPlayer는 배열 끝에 벤치 선수를 추가하고 어느 국면의 positions에도 넣지 않는다', () => {
    useAnalysisStore.getState().addPlayer()
    const { analysis } = useAnalysisStore.getState()
    expect(analysis!.players).toHaveLength(12)
    const bench = analysis!.players[11]
    for (const phase of Object.values(analysis!.phases)) {
      expect(phase.positions.some((p) => p.playerId === bench.id)).toBe(false)
    }
  })

  it('addPlayer로 늘어난 스쿼드도 analysisSchema를 통과한다', () => {
    useAnalysisStore.getState().addPlayer()
    useAnalysisStore.getState().addPlayer()
    const { analysis } = useAnalysisStore.getState()
    const result = analysisSchema.safeParse(analysis)
    expect(result.success).toBe(true)
  })

  it('removePlayer는 벤치 선수만 지운다 — 선발은 지우지 못한다', () => {
    useAnalysisStore.getState().addPlayer()
    const benchId = useAnalysisStore.getState().analysis!.players[11].id
    const starterId = useAnalysisStore.getState().analysis!.players[0].id

    useAnalysisStore.getState().removePlayer(starterId)
    expect(useAnalysisStore.getState().analysis!.players).toHaveLength(12) // 선발 삭제는 무시됨

    useAnalysisStore.getState().removePlayer(benchId)
    expect(useAnalysisStore.getState().analysis!.players).toHaveLength(11)
    expect(useAnalysisStore.getState().analysis!.players.find((p) => p.id === benchId)).toBeUndefined()
  })

  it('removePlayer는 선발 11명 밑으로는 내려가지 않는다', () => {
    const starterId = useAnalysisStore.getState().analysis!.players[0].id
    useAnalysisStore.getState().removePlayer(starterId)
    expect(useAnalysisStore.getState().analysis!.players).toHaveLength(11)
  })

  it('applyFormation은 벤치 선수에게 좌표를 부여하지 않고, 선발 11명 인덱스를 보존한다', () => {
    useAnalysisStore.getState().addPlayer()
    useAnalysisStore.getState().applyFormation('4-4-2')
    const { analysis } = useAnalysisStore.getState()
    expect(analysis!.players).toHaveLength(12)
    const benchId = analysis!.players[11].id
    for (const phase of Object.values(analysis!.phases)) {
      expect(phase.positions).toHaveLength(11)
      expect(phase.positions.some((p) => p.playerId === benchId)).toBe(false)
    }
    const result = analysisSchema.safeParse(analysis)
    expect(result.success).toBe(true)
  })

  it('addPlayer는 23명을 넘기지 않는다', () => {
    for (let i = 0; i < 20; i++) useAnalysisStore.getState().addPlayer()
    expect(useAnalysisStore.getState().analysis!.players.length).toBeLessThanOrEqual(23)
  })
})

/** 로고 클릭 시 "처음 화면으로" — 로드된 분석과 관련 임시 상태를 비운다. */
describe('analysisStore — closeAnalysis', () => {
  it('analysis를 null로 되돌리고 국면·더러움 상태를 초기화한다', () => {
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-01',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
    useAnalysisStore.getState().switchPhase('attack')
    useAnalysisStore.getState().updatePlayer(analysis.players[0].id, { name: '수정됨' })

    useAnalysisStore.getState().closeAnalysis()

    const state = useAnalysisStore.getState()
    expect(state.analysis).toBeNull()
    expect(state.currentPhase).toBe('base')
    expect(state.previousPhase).toBeNull()
    expect(state.isDirty).toBe(false)
  })
})

/** TO-DO 4 — 상대 포메이션 템플릿을 대칭 배치해 오버로드 레이어를 바로 켤 수 있게 한다. */
describe('analysisStore — addOpponentsFromFormation', () => {
  beforeEach(() => {
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-01',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
  })

  it('지정한 포메이션 템플릿을 하프라인 기준(y=100-y)으로 대칭 이동해 현재 국면에 넣는다', () => {
    useAnalysisStore.getState().addOpponentsFromFormation('4-4-2')
    const { analysis, currentPhase } = useAnalysisStore.getState()
    const opp = analysis!.phases[currentPhase].opponentPositions
    expect(opp).toHaveLength(11)
    const template = FORMATIONS['4-4-2']
    opp!.forEach((p, i) => {
      expect(p.x).toBe(template[i].x)
      expect(p.y).toBe(100 - template[i].y)
    })
  })

  it('자팀 포메이션과 무관하게 선택한 상대 포메이션 모양을 쓴다(자팀은 4-3-3, 상대는 4-4-2)', () => {
    useAnalysisStore.getState().addOpponentsFromFormation('4-4-2')
    const { analysis, currentPhase } = useAnalysisStore.getState()
    const opp = analysis!.phases[currentPhase].opponentPositions
    // 4-3-3(자팀)의 미드필더 3명 x좌표(32/50/68)와 달리 4-4-2 상대는 미드필더 4명이다.
    expect(opp).not.toHaveLength(0)
    expect(opp!.map((p) => p.x)).not.toEqual(analysis!.phases[currentPhase].positions.map((p) => p.x))
  })

  it('현재 국면에만 적용되고 다른 국면은 그대로 둔다', () => {
    useAnalysisStore.getState().switchPhase('attack')
    useAnalysisStore.getState().addOpponentsFromFormation('3-5-2')
    const { analysis } = useAnalysisStore.getState()
    expect(analysis!.phases.attack.opponentPositions).toHaveLength(11)
    expect(analysis!.phases.base.opponentPositions).toBeUndefined()
    expect(analysis!.phases.defense.opponentPositions).toBeUndefined()
  })

  it('존재하지 않는 포메이션 이름은 무시하고 상태를 바꾸지 않는다', () => {
    const before = useAnalysisStore.getState().analysis
    useAnalysisStore.getState().addOpponentsFromFormation('존재하지-않음')
    expect(useAnalysisStore.getState().analysis).toBe(before)
  })

  it('결과가 analysisSchema를 통과한다', () => {
    useAnalysisStore.getState().addOpponentsFromFormation('4-4-2')
    const result = analysisSchema.safeParse(useAnalysisStore.getState().analysis)
    expect(result.success).toBe(true)
  })
})

/** TO-DO(2026-09-08) — FM 스타일 압박 라인 5단계. GK는 그대로 두고 나머지를 평행이동한다. */
describe('analysisStore — setPressingLineLevel', () => {
  beforeEach(() => {
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-08',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
  })

  it('현재 국면에만 반영되고 다른 국면은 그대로 둔다', () => {
    useAnalysisStore.getState().switchPhase('attack')
    useAnalysisStore.getState().setPressingLineLevel('낮음')
    const { analysis } = useAnalysisStore.getState()
    expect(analysis!.phases.attack.pressingLineY).not.toBeUndefined()
    expect(analysis!.phases.base.pressingLineY).toBeUndefined()
    expect(analysis!.phases.defense.pressingLineY).toBeUndefined()
  })

  it('GK 위치는 바뀌지 않는다', () => {
    const gkId = useAnalysisStore.getState().analysis!.players[0].id
    const before = useAnalysisStore
      .getState()
      .analysis!.phases.base.positions.find((p) => p.playerId === gkId)
    useAnalysisStore.getState().setPressingLineLevel('매우 낮음')
    const after = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === gkId)
    expect(after).toEqual(before)
  })

  it('GK를 제외한 선수 전원이 같은 양만큼 움직인다(간격 비율 보존)', () => {
    const gkId = useAnalysisStore.getState().analysis!.players[0].id
    const before = useAnalysisStore.getState().analysis!.phases.base.positions
    useAnalysisStore.getState().setPressingLineLevel('낮음')
    const after = useAnalysisStore.getState().analysis!.phases.base.positions
    const deltas = before
      .filter((p) => p.playerId !== gkId)
      .map((p) => after.find((a) => a.playerId === p.playerId)!.y - p.y)
    for (const d of deltas) expect(d).toBeCloseTo(deltas[0], 5)
  })

  it('결과가 analysisSchema를 통과한다', () => {
    useAnalysisStore.getState().setPressingLineLevel('보통')
    const result = analysisSchema.safeParse(useAnalysisStore.getState().analysis)
    expect(result.success).toBe(true)
  })
})

/** TO-DO 5 — 타임라인(매치 체인징 포인트). 3국면과 완전히 별개로 동작해야 한다. */
describe('analysisStore — 타임라인(체인징 포인트)', () => {
  beforeEach(() => {
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-09',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
  })

  it('addChangingPoint는 지금 보이는 국면의 좌표를 복제하고 그 포인트를 선택한다', () => {
    useAnalysisStore.getState().movePlayer(useAnalysisStore.getState().analysis!.players[0].id, 12, 34)
    useAnalysisStore.getState().addChangingPoint('전반 23분')

    const { analysis, selectedChangingPointId } = useAnalysisStore.getState()
    expect(analysis!.changingPoints).toHaveLength(1)
    const cp = analysis!.changingPoints![0]
    expect(cp.label).toBe('전반 23분')
    expect(selectedChangingPointId).toBe(cp.id)
    expect(cp.positions).toEqual(analysis!.phases.base.positions)
    expect(cp.comment).toBe('') // 코멘트는 새로 쓰도록 비워서 시작한다
  })

  it('addChangingPoint에 minute을 주면 그 값으로 바로 만들어진다(타임라인 바 클릭 추가)', () => {
    useAnalysisStore.getState().addChangingPoint('킥오프', 23)
    const { analysis } = useAnalysisStore.getState()
    expect(analysis!.changingPoints![0].minute).toBe(23)
  })

  it('체인징 포인트를 선택한 동안 movePlayer/addAnnotation은 그 포인트에만 반영되고 국면은 그대로 둔다', () => {
    useAnalysisStore.getState().addChangingPoint('전반 23분')
    const cpId = useAnalysisStore.getState().selectedChangingPointId!
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    const baseBefore = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)

    useAnalysisStore.getState().movePlayer(playerId, 77, 88)
    useAnalysisStore.getState().addAnnotation('run', { x: 10, y: 10 }, { x: 20, y: 20 })

    const { analysis } = useAnalysisStore.getState()
    const cp = analysis!.changingPoints!.find((c) => c.id === cpId)!
    expect(cp.positions.find((p) => p.playerId === playerId)).toEqual({ playerId, x: 77, y: 88 })
    expect(cp.annotations).toHaveLength(1)
    // 국면 쪽 데이터는 전혀 건드리지 않았다.
    expect(analysis!.phases.base.positions.find((p) => p.playerId === playerId)).toEqual(baseBefore)
    expect(analysis!.phases.base.annotations).toHaveLength(0)
  })

  it('국면 탭(switchPhase)을 누르면 체인징 포인트 선택이 해제된다', () => {
    useAnalysisStore.getState().addChangingPoint('전반 23분')
    expect(useAnalysisStore.getState().selectedChangingPointId).not.toBeNull()

    useAnalysisStore.getState().switchPhase('base') // currentPhase는 이미 'base' — 그래도 해제돼야 한다
    expect(useAnalysisStore.getState().selectedChangingPointId).toBeNull()
  })

  it('removeChangingPoint로 선택 중인 포인트를 지우면 선택이 함께 해제된다', () => {
    useAnalysisStore.getState().addChangingPoint('전반 23분')
    const cpId = useAnalysisStore.getState().selectedChangingPointId!

    useAnalysisStore.getState().removeChangingPoint(cpId)

    const { analysis, selectedChangingPointId } = useAnalysisStore.getState()
    expect(analysis!.changingPoints).toHaveLength(0)
    expect(selectedChangingPointId).toBeNull()
  })

  it('moveChangingPoint는 배열 순서를 스왑하고 경계를 벗어나면 무시한다', () => {
    useAnalysisStore.getState().addChangingPoint('킥오프')
    useAnalysisStore.getState().addChangingPoint('15분')
    useAnalysisStore.getState().addChangingPoint('23분')
    const [a, b, c] = useAnalysisStore.getState().analysis!.changingPoints!.map((cp) => cp.id)

    useAnalysisStore.getState().moveChangingPoint(b, 'left')
    expect(useAnalysisStore.getState().analysis!.changingPoints!.map((cp) => cp.id)).toEqual([b, a, c])

    useAnalysisStore.getState().moveChangingPoint(b, 'left') // 이미 맨 앞 — 무시
    expect(useAnalysisStore.getState().analysis!.changingPoints!.map((cp) => cp.id)).toEqual([b, a, c])
  })

  it('renameChangingPoint는 라벨만 바꾼다', () => {
    useAnalysisStore.getState().addChangingPoint('킥오프')
    const cpId = useAnalysisStore.getState().selectedChangingPointId!
    useAnalysisStore.getState().renameChangingPoint(cpId, '전반 23분 추격 상황')
    expect(useAnalysisStore.getState().analysis!.changingPoints![0].label).toBe('전반 23분 추격 상황')
  })

  it('새로 만든 체인징 포인트는 minute이 없다가, setChangingPointMinute으로 지정·해제할 수 있다', () => {
    useAnalysisStore.getState().addChangingPoint('전반 23분')
    const cpId = useAnalysisStore.getState().selectedChangingPointId!
    expect(useAnalysisStore.getState().analysis!.changingPoints![0].minute).toBeUndefined()

    useAnalysisStore.getState().setChangingPointMinute(cpId, 23)
    expect(useAnalysisStore.getState().analysis!.changingPoints![0].minute).toBe(23)

    useAnalysisStore.getState().setChangingPointMinute(cpId, undefined)
    expect(useAnalysisStore.getState().analysis!.changingPoints![0].minute).toBeUndefined()
  })

  it('결과가 analysisSchema를 통과한다', () => {
    useAnalysisStore.getState().addChangingPoint('전반 23분')
    useAnalysisStore.getState().movePlayer(useAnalysisStore.getState().analysis!.players[0].id, 40, 60)
    const result = analysisSchema.safeParse(useAnalysisStore.getState().analysis)
    expect(result.success).toBe(true)
  })

  it('체인징 포인트가 없는(구버전) 분석도 그대로 analysisSchema를 통과한다', () => {
    const { changingPoints: _drop, ...withoutChangingPoints } = useAnalysisStore.getState().analysis!
    void _drop
    const result = analysisSchema.safeParse(withoutChangingPoints)
    expect(result.success).toBe(true)
  })
})
