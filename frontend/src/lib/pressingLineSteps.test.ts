import { describe, expect, it } from 'vitest'

import { pressingLineLevel } from '@/lib/compactness'
import {
  currentBackLineY,
  currentPressingLineLevel,
  findGkPlayerId,
  PRESSING_LINE_LEVELS,
  shiftPositionsToPressingLevel,
} from '@/lib/pressingLineSteps'
import { createEmptyAnalysis } from '@/store/analysisStore'
import type { PlayerPosition } from '@/types/analysis'

const analysis = createEmptyAnalysis('4-3-3', {
  matchName: '테스트',
  homeTeam: '홈',
  awayTeam: '원정',
  matchDate: '2026-09-08',
  analyzedTeam: 'home',
})
const gkId = findGkPlayerId(analysis.players, analysis.formation)!
const basePositions = analysis.phases.base.positions // GK y=92, DF y=74/78, MF y=52/62, FW y=22/30 (formations.ts 4-3-3)

describe('findGkPlayerId', () => {
  it('4-3-3에서 players[0](GK)의 id를 찾는다', () => {
    expect(gkId).toBe(analysis.players[0].id)
  })
})

describe('currentBackLineY', () => {
  it('GK를 뺀 출전 선수 중 y 최댓값을 반환한다', () => {
    // 4-3-3 base: DF(y=74,78,78,74)가 GK(92) 다음으로 가장 깊다
    expect(currentBackLineY(basePositions, gkId)).toBe(78)
  })

  it('GK 없이(id 불일치) 넘기면 전원을 대상으로 계산한다', () => {
    expect(currentBackLineY(basePositions, 'no-such-id')).toBe(92) // GK 포함 최댓값
  })

  it('빈 배열이면 null', () => {
    expect(currentBackLineY([], gkId)).toBeNull()
  })
})

describe('currentPressingLineLevel', () => {
  it('currentBackLineY에 pressingLineLevel을 적용한 것과 같다', () => {
    const y = currentBackLineY(basePositions, gkId)!
    expect(currentPressingLineLevel(basePositions, gkId)).toBe(pressingLineLevel(y))
  })
})

describe('PRESSING_LINE_LEVELS', () => {
  it('5단계가 매우 높음→매우 낮음 순서다', () => {
    expect(PRESSING_LINE_LEVELS).toEqual(['매우 높음', '높음', '보통', '낮음', '매우 낮음'])
  })
})

describe('shiftPositionsToPressingLevel', () => {
  it('GK는 움직이지 않는다', () => {
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '매우 높음')!
    const gkAfter = result.positions.find((p) => p.playerId === gkId)!
    const gkBefore = basePositions.find((p) => p.playerId === gkId)!
    expect(gkAfter).toEqual(gkBefore)
  })

  it('평행이동이라 라인 사이 간격(y차)이 그대로 보존된다', () => {
    const before = basePositions
    const result = shiftPositionsToPressingLevel(before, gkId, '보통')!
    const gapBefore = (a: string, b: string) =>
      before.find((p) => p.playerId === a)!.y - before.find((p) => p.playerId === b)!.y
    const gapAfter = (a: string, b: string) =>
      result.positions.find((p) => p.playerId === a)!.y - result.positions.find((p) => p.playerId === b)!.y
    // DF(players[1])와 FW(players[8]) 사이 간격 — GK 제외 임의의 두 outfield 선수로 검증
    const dfId = analysis.players[1].id
    const fwId = analysis.players[8].id
    expect(gapAfter(dfId, fwId)).toBeCloseTo(gapBefore(dfId, fwId), 5)
  })

  it('결과 pressingLineY가 실제로 이동한 백라인 y와 일치한다', () => {
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '낮음')!
    const newBackY = currentBackLineY(result.positions, gkId)
    expect(result.pressingLineY).toBeCloseTo(newBackY!, 5)
  })

  it('선택한 단계에 맞는 라벨로 판정되는 y를 만든다(대형 내부 폭이 좁아 어느 단계로도 경계에 안 닿는 경우)', () => {
    // 4-3-3 base(DF 74~78 ~ FW 22~30, 56유닛 폭)는 실제로 "매우 높음"(목표 y=58)을
    // 요청하면 FW가 안전선 아래로 밀려나 비율 유지 압축이 걸린다 — 그건 버그가
    // 아니라 피치 밖으로 나갈 수 없다는 물리적 제약이 맞게 동작한 것이다. 여기서는
    // 대형 내부 폭이 좁은(10유닛) 픽스처로 5단계 전부가 경계에 안 닿는 조건을
    // 만들어 "요청한 단계 = 실제 결과 단계"를 검증한다.
    const compact: PlayerPosition[] = basePositions.map((p, i) =>
      p.playerId === gkId ? p : { ...p, y: 50 + (i % 3) * 5 }, // outfield y를 50~60 사이로 압축
    )
    for (const level of PRESSING_LINE_LEVELS) {
      const result = shiftPositionsToPressingLevel(compact, gkId, level)!
      expect(pressingLineLevel(result.pressingLineY)).toBe(level)
    }
  })

  it('출전 선수가 없으면(빈 배열) null을 반환한다', () => {
    expect(shiftPositionsToPressingLevel([], gkId, '보통')).toBeNull()
  })
})

// 회귀 테스트(2026-09-08, 2차) — "압박 라인이 높음까지밖에 없어 매우 높음까지
// 있으면 좋겠어 ... 간격이 깨지면 그냥 비율만 유지하고 압박라인을 높아지게,
// 간격은 줄어들어도 되니까 ... 공격수들이 반원 형태로 짤리더라". 예전엔 평행
// 이동의 델타를 줄여서(전원이 덜 이동) 최전방이 0 밑으로 안 내려가게만 막았는데,
// 그러면 대형 폭이 넓은 실제 포메이션은 "매우 높음"(목표 y=58)에 영영 도달하지
// 못하고 "높음"쯤에서 멈췄다. 이제는 평행이동으로 최전방이 안전선 아래로
// 내려갈 때만 "비율 유지 압축"으로 전환해 백라인은 목표에 정확히 맞추고
// 최전방은 골라인에서 안전한 최소 y에 맞춘 뒤, 그 사이는 간격의 절대값이
// 아니라 상대 비율을 유지한 채 압축한다.
describe('shiftPositionsToPressingLevel — 비율 유지 압축', () => {
  it('실제 4-3-3 base 대형에서도 "매우 높음"에 정확히 도달한다(예전엔 평행이동 델타가 줄어들어 못 미쳤음)', () => {
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '매우 높음')!
    expect(pressingLineLevel(result.pressingLineY)).toBe('매우 높음')
    expect(result.pressingLineY).toBeCloseTo(58, 5)
  })

  it('압축이 일어나도 최전방 선수가 골라인에서 안전한 최소 y 아래로는 안 내려간다(원·라벨이 안 잘림)', () => {
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '매우 높음')!
    const outfield = result.positions.filter((p) => p.playerId !== gkId)
    const frontY = Math.min(...outfield.map((p) => p.y))
    // 정확한 안전 마진 상수는 lib 내부값이라 여유 있게 5 이상으로만 확인한다
    // (선수 원 반지름 + 라벨 오프셋을 감안해 고른 값).
    expect(frontY).toBeGreaterThanOrEqual(4)
  })

  it('간격의 절대값은 줄어들지만 상대 비율은 그대로 보존된다', () => {
    // base 4-3-3: CB(index2, y=78, 백라인) - DM(index5, y=62) - ST(index9, y=22, 최전방).
    // 원래 간격 비율(CB-DM : DM-ST) = 16:40 = 0.4
    const cbId = analysis.players[2].id
    const dmId = analysis.players[5].id
    const stId = analysis.players[9].id
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '매우 높음')!
    const at = (id: string) => result.positions.find((p) => p.playerId === id)!.y

    const gapCbDmBefore = 78 - 62
    const gapDmStBefore = 62 - 22
    const gapCbDmAfter = at(cbId) - at(dmId)
    const gapDmStAfter = at(dmId) - at(stId)

    expect(gapCbDmAfter).toBeLessThan(gapCbDmBefore) // 절대 간격은 압축됨
    expect(gapCbDmAfter / gapDmStAfter).toBeCloseTo(gapCbDmBefore / gapDmStBefore, 2) // 비율은 유지됨
  })

  it('평행이동만으로 충분한 단계(보통)는 여전히 간격을 그대로 보존한다(압축 안 씀)', () => {
    const cbId = analysis.players[2].id
    const dmId = analysis.players[5].id
    const result = shiftPositionsToPressingLevel(basePositions, gkId, '보통')!
    const at = (id: string) => result.positions.find((p) => p.playerId === id)!.y
    expect(at(cbId) - at(dmId)).toBeCloseTo(78 - 62, 5) // 압축 없이 절대 간격 그대로
  })
})
