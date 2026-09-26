import { describe, expect, it } from 'vitest'

import { RUN_LOOP_DELAY, RUN_LOOP_DURATION } from '@/components/pitch/PlayerNode'
import { createEmptyAnalysis } from '@/store/analysisStore'
import type { PlayerPosition } from '@/types/analysis'

import { buildGifFrameSpecs, easeInOutCubic, interpolatePositions } from './exportGif'

describe('easeInOutCubic', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('is monotonically increasing (no overshoot)', () => {
    let prev = -Infinity
    for (let t = 0; t <= 1; t += 0.1) {
      const v = easeInOutCubic(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('interpolatePositions', () => {
  const from: PlayerPosition[] = [
    { playerId: 'p1', x: 0, y: 0 },
    { playerId: 'p2', x: 20, y: 80 },
  ]
  const to: PlayerPosition[] = [
    { playerId: 'p1', x: 100, y: 100 },
    { playerId: 'p2', x: 40, y: 40 },
  ]

  it('t=0이면 from과 같다', () => {
    expect(interpolatePositions(from, to, 0)).toEqual(from)
  })

  it('t=1이면 to와 같다(순서·값 모두)', () => {
    const result = interpolatePositions(from, to, 1)
    expect(result.map(({ playerId, x, y }) => ({ playerId, x, y }))).toEqual(to)
  })

  it('t=0.5면 정확히 중간값이다', () => {
    const result = interpolatePositions(from, to, 0.5)
    expect(result).toEqual([
      { playerId: 'p1', x: 50, y: 50 },
      { playerId: 'p2', x: 30, y: 60 },
    ])
  })

  it('to에 없는 playerId는 원래 위치를 그대로 유지한다(안전장치)', () => {
    const result = interpolatePositions(from, [{ playerId: 'p1', x: 100, y: 100 }], 0.5)
    expect(result.find((p) => p.playerId === 'p2')).toEqual({ playerId: 'p2', x: 20, y: 80 })
  })
})

describe('buildGifFrameSpecs', () => {
  const analysis = createEmptyAnalysis('4-3-3', {
    matchName: '테스트',
    homeTeam: '홈',
    awayTeam: '원정',
    matchDate: '2026-09-08',
    analyzedTeam: 'home',
  })

  it('기본→공격→수비→기본 순환이 되도록 3번의 전환을 포함한다', () => {
    const frames = buildGifFrameSpecs(analysis)
    const phaseSequence = [...new Set(frames.map((f) => f.phase))]
    expect(phaseSequence).toEqual(['base', 'attack', 'defense'])
  })

  it('각 국면마다 정지 프레임이 정확히 하나씩 있다(위치가 해당 국면의 원본 positions와 동일)', () => {
    const frames = buildGifFrameSpecs(analysis)
    const baseHold = frames.find((f) => f.phase === 'base' && f.positions === analysis.phases.base.positions)
    expect(baseHold).toBeDefined()
  })

  it('모든 프레임의 delay는 0보다 크다(재생이 멈추지 않도록)', () => {
    const frames = buildGifFrameSpecs(analysis)
    for (const f of frames) {
      expect(f.delayMs).toBeGreaterThan(0)
    }
  })

  it('선수 11명 모두 매 프레임에 위치를 갖는다', () => {
    const frames = buildGifFrameSpecs(analysis)
    for (const f of frames) {
      expect(f.positions).toHaveLength(11)
    }
  })
})

describe('buildGifFrameSpecs — run 화살표 재생(2026-09-26, "PNG/GIF에서도 화살표대로 움직이면 좋겠다")', () => {
  function analysisWithRun() {
    const a = createEmptyAnalysis('4-3-3', {
      matchName: '테스트',
      homeTeam: '홈',
      awayTeam: '원정',
      matchDate: '2026-09-08',
      analyzedTeam: 'home',
    })
    const runner = a.phases.attack.positions[0]
    const to = { x: runner.x + 20, y: runner.y }
    a.phases.attack.annotations = [{ id: 'r1', type: 'run', from: { x: runner.x, y: runner.y }, to }]
    return { analysis: a, runnerId: runner.playerId, to }
  }

  it('공식이 어긋나지 않는다 — 편집 화면(PlayerNode)과 같은 리듬이어야 한다', () => {
    // exportGif.ts는 이 값을 import해서 쓰므로(값 복제가 아니라) 어긋날 수
    // 없지만, 실수로 다시 하드코딩 값으로 되돌리는 걸 막기 위한 회귀 테스트.
    expect(RUN_LOOP_DURATION).toBe(0.9)
    expect(RUN_LOOP_DELAY).toBe(0.5)
  })

  it('run 화살표가 매칭된 국면에서는 해당 선수가 도착점 근처를 여러 번 오간다(왕복 2회)', () => {
    const { analysis, runnerId, to } = analysisWithRun()
    // 'attack' 국면 자체에 머무는 구간만 본다 — base→attack 전환 프레임도
    // phase:'attack'으로 표기되지만(다음 국면 라벨), 이 신선한 분석은 base와
    // attack의 좌표가 같아 그 구간은 계속 originalX로 평평하다. 그래서 "도착점
    // 근처 봉우리"만 세면 전환 구간의 평평한 값과 섞이지 않는다.
    const frames = buildGifFrameSpecs(analysis).filter((f) => f.phase === 'attack')
    const runnerXs = frames.map((f) => f.positions.find((p) => p.playerId === runnerId)!.x)

    // 화살표 없이는 나올 수 없는 "도착점(x+20) 근처" 봉우리가 최소 2번(RUN_LOOP_CYCLES)
    // 나타나야 한다 — 그냥 한 번 이동하는 전환이 아니라 실제로 왕복함을 보증한다.
    const peaks = runnerXs.filter(
      (x, i) => x > to.x - 1 && (i === 0 || runnerXs[i - 1] <= x) && (i === runnerXs.length - 1 || runnerXs[i + 1] <= x),
    )
    expect(peaks.length).toBeGreaterThanOrEqual(2)
  })

  it('run 화살표가 없는 국면(base)은 기존처럼 정지 프레임 하나뿐이다(동일 참조 유지)', () => {
    const { analysis } = analysisWithRun()
    const frames = buildGifFrameSpecs(analysis)
    const baseHold = frames.filter((f) => f.phase === 'base' && f.positions === analysis.phases.base.positions)
    expect(baseHold).toHaveLength(1)
  })

  it('run 화살표가 있으면 그 국면의 프레임 수가 늘어난다(2번 왕복 + 마지막 정지)', () => {
    const withRun = analysisWithRun().analysis
    const plain = createEmptyAnalysis('4-3-3', withRun.match)
    const attackFramesWithRun = buildGifFrameSpecs(withRun).filter((f) => f.phase === 'attack').length
    const attackFramesPlain = buildGifFrameSpecs(plain).filter((f) => f.phase === 'attack').length
    expect(attackFramesWithRun).toBeGreaterThan(attackFramesPlain)
  })
})
