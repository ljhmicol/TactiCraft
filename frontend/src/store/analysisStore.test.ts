import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

/** 개선 로드맵 §5.1 — 초안 복구. loadAnalysis와 거의 같지만 isDirty를
 * true로 남겨야 "서버에 없는 상태"라는 게 구분된다(SaveButton의 "저장 *"
 * 표시, useDraftAutosave의 재저장 등이 이 값에 의존한다). */
describe('analysisStore — restoreDraft', () => {
  it('loadAnalysis와 달리 isDirty를 true로 남긴다', () => {
    const draft = createEmptyAnalysis('4-3-3', {
      matchName: '복구 대상',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-01',
      analyzedTeam: 'home',
    })

    useAnalysisStore.getState().restoreDraft(draft)

    const state = useAnalysisStore.getState()
    expect(state.analysis?.match.matchName).toBe('복구 대상')
    expect(state.isDirty).toBe(true)
    expect(state.currentPhase).toBe('base')
    expect(state.past).toEqual([])
    expect(state.future).toEqual([])
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

  it('mergeChangingPoints는 선택한 시점들을 하나로 합친다 — 좌표는 마지막 것, annotations는 순서대로 이어붙임, steps에 원본 스냅샷 보관', () => {
    // 병합은 곧바로 selectChangingPoint를 거쳐 steps 자동재생 타이머(실제
    // setInterval)를 건다 — 테스트가 끝나도 안 꺼지면 나중 테스트를 오염시킬
    // 수 있어 fake timer로 통제한다.
    vi.useFakeTimers()
    try {
      useAnalysisStore.getState().addChangingPoint('시점1', 10)
      const idA = useAnalysisStore.getState().selectedChangingPointId!
      useAnalysisStore.getState().setComment('A 코멘트')
      useAnalysisStore.getState().addAnnotation('pass', { x: 10, y: 10 }, { x: 20, y: 20 })
      const positionsA = useAnalysisStore.getState().analysis!.changingPoints!.find((cp) => cp.id === idA)!.positions

      useAnalysisStore.getState().addChangingPoint('시점2', 20)
      const idB = useAnalysisStore.getState().selectedChangingPointId!
      useAnalysisStore.getState().addAnnotation('pass', { x: 20, y: 20 }, { x: 30, y: 30 })
      const playerId = useAnalysisStore.getState().analysis!.players[0].id
      useAnalysisStore.getState().movePlayer(playerId, 55, 66) // 시점2의 최종 좌표

      useAnalysisStore.getState().mergeChangingPoints([idA, idB])

      const { analysis, selectedChangingPointId, mergedStepIndex } = useAnalysisStore.getState()
      expect(analysis!.changingPoints).toHaveLength(1)
      const merged = analysis!.changingPoints![0]
      expect(selectedChangingPointId).toBe(merged.id)
      expect(merged.label).toBe('시점1 ~ 시점2')
      expect(merged.minute).toBe(10) // 가장 이른 시점(첫 번째)의 minute을 물려받는다
      expect(merged.positions.find((p) => p.playerId === playerId)).toEqual({ playerId, x: 55, y: 66 }) // 마지막 시점의 최종 배치
      expect(merged.annotations).toHaveLength(2) // 두 시점의 화살표를 순서대로 이어붙인다
      expect(merged.comment).toBe('A 코멘트') // 빈 코멘트는 걸러내고 이어붙인다
      // steps에는 병합 전 각 시점의 원본 스냅샷이 순서대로 그대로 남는다 —
      // 같은 선수가 이 범위 안에서 공을 여러 번 만져도 재생 시 각 스텝이
      // 독립적으로 정확한 자리를 보여줄 수 있어야 하기 때문.
      expect(merged.steps).toHaveLength(2)
      expect(merged.steps![0].positions).toEqual(positionsA)
      expect(merged.steps![0].annotations).toHaveLength(1)
      expect(merged.steps![1].annotations).toHaveLength(1)
      // 선택 직후엔 0번 스텝부터 자동재생을 시작한다.
      expect(mergedStepIndex).toBe(0)
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('steps가 있는 시점을 고르면 mergedStepIndex가 자동으로 진행되다가 끝나면 null로 정착한다', () => {
    vi.useFakeTimers()
    try {
      useAnalysisStore.getState().addChangingPoint('시점1')
      const idA = useAnalysisStore.getState().selectedChangingPointId!
      useAnalysisStore.getState().addChangingPoint('시점2')
      const idB = useAnalysisStore.getState().selectedChangingPointId!
      useAnalysisStore.getState().addChangingPoint('시점3')
      const idC = useAnalysisStore.getState().selectedChangingPointId!

      useAnalysisStore.getState().mergeChangingPoints([idA, idB, idC])
      expect(useAnalysisStore.getState().mergedStepIndex).toBe(0)

      vi.advanceTimersByTime(1800)
      expect(useAnalysisStore.getState().mergedStepIndex).toBe(1)

      vi.advanceTimersByTime(1800)
      expect(useAnalysisStore.getState().mergedStepIndex).toBe(2)

      // 마지막 스텝을 지나면 null로 돌아가 병합된 시점 자체(요약 프레임)를 보여준다.
      vi.advanceTimersByTime(1800)
      expect(useAnalysisStore.getState().mergedStepIndex).toBeNull()

      // 더 지나도 그대로 null — 반복 재생하지 않는다.
      vi.advanceTimersByTime(5000)
      expect(useAnalysisStore.getState().mergedStepIndex).toBeNull()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('steps가 없는(보통) 시점을 고르면 mergedStepIndex는 계속 null이다', () => {
    useAnalysisStore.getState().addChangingPoint('시점1')
    expect(useAnalysisStore.getState().mergedStepIndex).toBeNull()
  })

  it('mergeChangingPoints는 2개 미만을 주면 아무것도 하지 않는다', () => {
    useAnalysisStore.getState().addChangingPoint('시점1')
    const idA = useAnalysisStore.getState().selectedChangingPointId!

    useAnalysisStore.getState().mergeChangingPoints([idA])

    expect(useAnalysisStore.getState().analysis!.changingPoints).toHaveLength(1)
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

/**
 * TO-DO 27 — 되돌리기/다시하기. analysis 변경은 500ms 디바운스로 자동 감지돼
 * 히스토리에 쌓이므로(analysisStore.ts 하단 subscribe), 실제 타이밍을
 * 제어하려고 fake timer를 쓴다.
 */
describe('analysisStore — undo/redo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    const analysis = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-09',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(analysis)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('편집이 없으면 undo/redo 둘 다 아무 일도 하지 않는다', () => {
    const before = useAnalysisStore.getState().analysis
    useAnalysisStore.getState().undo()
    useAnalysisStore.getState().redo()
    expect(useAnalysisStore.getState().analysis).toBe(before)
    expect(useAnalysisStore.getState().past).toHaveLength(0)
    expect(useAnalysisStore.getState().future).toHaveLength(0)
  })

  it('편집 후 디바운스가 끝나면 past에 1개 쌓이고, undo로 되돌아간다', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    const before = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)

    useAnalysisStore.getState().movePlayer(playerId, 12, 34)
    vi.advanceTimersByTime(600)
    expect(useAnalysisStore.getState().past).toHaveLength(1)

    useAnalysisStore.getState().undo()
    const after = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)
    expect(after).toEqual(before)
    expect(useAnalysisStore.getState().future).toHaveLength(1)
  })

  it('디바운스 창 안에서 연달아 바뀌면 히스토리 1개로 합쳐진다(드래그 매 프레임이 각각 안 쌓임)', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    for (let i = 0; i < 10; i++) {
      useAnalysisStore.getState().movePlayer(playerId, 10 + i, 50)
      vi.advanceTimersByTime(100) // 500ms 미만이라 계속 같은 burst
    }
    vi.advanceTimersByTime(600) // burst 종료
    expect(useAnalysisStore.getState().past).toHaveLength(1)
  })

  it('undo 직후 redo하면 되돌리기 전 상태로 복원된다', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    useAnalysisStore.getState().movePlayer(playerId, 12, 34)
    vi.advanceTimersByTime(600)

    useAnalysisStore.getState().undo()
    useAnalysisStore.getState().redo()

    const pos = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)
    expect(pos).toEqual({ playerId, x: 12, y: 34 })
    expect(useAnalysisStore.getState().future).toHaveLength(0)
  })

  it('undo 이후 새로 편집하면 future(다시하기)가 비워진다', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    useAnalysisStore.getState().movePlayer(playerId, 12, 34)
    vi.advanceTimersByTime(600)
    useAnalysisStore.getState().undo()
    expect(useAnalysisStore.getState().future).toHaveLength(1)

    useAnalysisStore.getState().movePlayer(playerId, 70, 80)
    vi.advanceTimersByTime(600)
    expect(useAnalysisStore.getState().future).toHaveLength(0)
  })

  it('undo를 누르면 디바운스를 기다리던 직전 burst도 즉시 커밋된다', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    const before = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)

    useAnalysisStore.getState().movePlayer(playerId, 99, 99)
    // 디바운스 타이머가 아직 안 끝난 상태에서 바로 undo
    useAnalysisStore.getState().undo()

    const after = useAnalysisStore.getState().analysis!.phases.base.positions.find((p) => p.playerId === playerId)
    expect(after).toEqual(before)
  })

  it('applySavedMeta는 히스토리에 기록되지 않는다', () => {
    useAnalysisStore.getState().applySavedMeta({ id: 1, createdAt: '2026-09-09T00:00:00', updatedAt: '2026-09-09T00:00:00' })
    vi.advanceTimersByTime(600)
    expect(useAnalysisStore.getState().past).toHaveLength(0)
  })

  it('loadAnalysis/closeAnalysis는 히스토리를 초기화한다', () => {
    const playerId = useAnalysisStore.getState().analysis!.players[0].id
    useAnalysisStore.getState().movePlayer(playerId, 12, 34)
    vi.advanceTimersByTime(600)
    expect(useAnalysisStore.getState().past).toHaveLength(1)

    const another = createEmptyAnalysis('4-4-2', {
      matchName: '다른 분석',
      homeTeam: '홈2',
      awayTeam: '원정2',
      matchDate: '2026-09-09',
      analyzedTeam: 'home',
    })
    useAnalysisStore.getState().loadAnalysis(another)
    expect(useAnalysisStore.getState().past).toHaveLength(0)
    expect(useAnalysisStore.getState().future).toHaveLength(0)

    useAnalysisStore.getState().closeAnalysis()
    expect(useAnalysisStore.getState().past).toHaveLength(0)
  })
})
