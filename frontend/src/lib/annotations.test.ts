import { describe, expect, it } from 'vitest'

import {
  ANNOTATION_MIN_LENGTH,
  arrowGeometry,
  BALL_SEGMENT_DURATION,
  buildPassChains,
  CARRY_BALL_DURATION,
  chainBallDuration,
  chainSamplePoints,
  curvedArrowGeometry,
  travelTimes,
} from '@/lib/annotations'
import { analysisSchema, annotationSchema } from '@/lib/schema'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Annotation } from '@/types/analysis'

const PITCH_LENGTH_M = 105
const PITCH_WIDTH_M = 68
const K = PITCH_LENGTH_M / PITCH_WIDTH_M

describe('arrowGeometry', () => {
  it('화살촉 tip은 정확히 to에 놓인다', () => {
    const geo = arrowGeometry({ x: 20, y: 80 }, { x: 40, y: 40 })
    expect(geo.head[0]).toEqual({ x: 40, y: 40 })
  })

  it('수직 화살표의 화살촉 좌우 날이 균일 축척 공간에서 대칭이다', () => {
    const from = { x: 50, y: 80 }
    const to = { x: 50, y: 40 }
    const geo = arrowGeometry(from, to)
    const [, left, right] = geo.head
    // 균일 공간(y*K)에서 두 날의 y가 같고 x가 tip 기준 대칭
    expect(left.y * K).toBeCloseTo(right.y * K)
    expect((to.x - left.x)).toBeCloseTo(-(to.x - right.x))
  })

  it('화살대 끝은 화살촉에 묻히지 않도록 to보다 짧다', () => {
    const geo = arrowGeometry({ x: 10, y: 90 }, { x: 80, y: 20 })
    const dShaft = Math.hypot(geo.shaftEnd.x - 10, (geo.shaftEnd.y - 90) * K)
    const dTip = Math.hypot(80 - 10, (20 - 90) * K)
    expect(dShaft).toBeLessThan(dTip)
    expect(dShaft).toBeGreaterThan(0)
  })

  it('길이 0 입력에서도 죽지 않는다', () => {
    const p = { x: 50, y: 50 }
    expect(arrowGeometry(p, p)).toEqual({ shaftEnd: p, head: [p, p, p] })
  })

  it('최소 길이 기준은 실수 클릭 수준으로 잡혀 있다', () => {
    expect(ANNOTATION_MIN_LENGTH).toBeLessThan(4)
  })
})

describe('curvedArrowGeometry', () => {
  it('화살촉 tip은 정확히 to에 놓인다', () => {
    const geo = curvedArrowGeometry({ x: 20, y: 80 }, { x: 40, y: 40 })
    expect(geo.head[0]).toEqual({ x: 40, y: 40 })
  })

  it('경로는 from에서 시작해 control을 거쳐 to로 끝나는 2차 베지어다', () => {
    const from = { x: 20, y: 80 }
    const to = { x: 40, y: 40 }
    const geo = curvedArrowGeometry(from, to)
    expect(geo.path).toBe(`M ${from.x} ${from.y} Q ${geo.control.x} ${geo.control.y} ${to.x} ${to.y}`)
  })

  // 왼쪽 절반(중앙 x=50보다 작음)에서 시작·끝나는 화살표는 왼쪽 터치라인
  // 쪽(x가 더 작은 쪽)으로 부풀어야 "바깥으로 도는" 오버랩처럼 보인다.
  it('왼쪽 절반의 화살표는 왼쪽(터치라인)으로 부푼다', () => {
    const geo = curvedArrowGeometry({ x: 20, y: 80 }, { x: 20, y: 40 })
    expect(geo.control.x).toBeLessThan(20)
  })

  it('오른쪽 절반의 화살표는 오른쪽(터치라인)으로 부푼다', () => {
    const geo = curvedArrowGeometry({ x: 80, y: 80 }, { x: 80, y: 40 })
    expect(geo.control.x).toBeGreaterThan(80)
  })

  it('길이 0 입력에서도 죽지 않는다', () => {
    const p = { x: 50, y: 50 }
    const geo = curvedArrowGeometry(p, p)
    expect(geo.control).toEqual(p)
    expect(geo.head).toEqual([p, p, p])
  })
})

type Point = { x: number; y: number }

function pass(id: string, from: Point, to: Point): Annotation {
  return { id, type: 'pass', from, to }
}

describe('buildPassChains', () => {
  it('연결 안 된 패스는 각자 길이 1짜리 체인이다', () => {
    const a = pass('a', { x: 10, y: 80 }, { x: 30, y: 60 })
    const b = pass('b', { x: 70, y: 40 }, { x: 90, y: 20 }) // a.to와 안 이어짐
    const chains = buildPassChains([a, b])
    expect(chains).toHaveLength(2)
    expect(chains.map((c) => c.map((p) => p.id))).toEqual(expect.arrayContaining([['a'], ['b']]))
  })

  it('수비수→미드필더→공격수처럼 끝점이 이어지면 순서대로 한 체인이 된다', () => {
    const df = pass('df-mf', { x: 30, y: 85 }, { x: 45, y: 55 })
    const mf = pass('mf-fw', { x: 45, y: 55 }, { x: 55, y: 20 }) // df.to와 정확히 일치
    // 배열 순서를 일부러 뒤섞어도 체인은 끝점을 따라 올바른 순서로 재구성돼야 한다
    const chains = buildPassChains([mf, df])
    expect(chains).toHaveLength(1)
    expect(chains[0].map((p) => p.id)).toEqual(['df-mf', 'mf-fw'])
  })

  it('정확히 같은 픽셀이 아니어도 3유닛 이내면 이어진 것으로 본다', () => {
    const df = pass('df-mf', { x: 30, y: 85 }, { x: 45, y: 55 })
    const mf = pass('mf-fw', { x: 46.5, y: 56 }, { x: 55, y: 20 }) // from이 df.to와 1.8유닛 정도 차이
    const chains = buildPassChains([df, mf])
    expect(chains).toHaveLength(1)
    expect(chains[0].map((p) => p.id)).toEqual(['df-mf', 'mf-fw'])
  })

  it('3단 체인(수비수→미드필더→공격수)도 순서대로 이어진다', () => {
    const df = pass('df-mf', { x: 30, y: 85 }, { x: 45, y: 55 })
    const mf = pass('mf-fw', { x: 45, y: 55 }, { x: 55, y: 20 })
    const fw = pass('fw-shot', { x: 55, y: 20 }, { x: 50, y: 5 })
    const chains = buildPassChains([fw, df, mf])
    expect(chains).toHaveLength(1)
    expect(chains[0].map((p) => p.id)).toEqual(['df-mf', 'mf-fw', 'fw-shot'])
  })

  it('빈 배열에서도 죽지 않는다', () => {
    expect(buildPassChains([])).toEqual([])
  })
})

describe('chainSamplePoints', () => {
  it('직선 체인은 이음매 중복 없이 점을 이어붙인다', () => {
    const df = pass('df-mf', { x: 30, y: 85 }, { x: 45, y: 55 })
    const mf = pass('mf-fw', { x: 45, y: 55 }, { x: 55, y: 20 })
    const points = chainSamplePoints([df, mf])
    // 직선은 2점씩이라 이음매(45,55) 중복 제거하면 3점
    expect(points).toEqual([
      { x: 30, y: 85 },
      { x: 45, y: 55 },
      { x: 55, y: 20 },
    ])
  })
})

describe('chainBallDuration', () => {
  it('직선 패스는 화살표 하나당 BALL_SEGMENT_DURATION이다', () => {
    const a = pass('a', { x: 30, y: 85 }, { x: 45, y: 55 })
    const b = pass('b', { x: 45, y: 55 }, { x: 55, y: 20 })
    expect(chainBallDuration([a])).toBeCloseTo(BALL_SEGMENT_DURATION)
    expect(chainBallDuration([a, b])).toBeCloseTo(BALL_SEGMENT_DURATION * 2)
  })

  it('곡선 패스도 화살표 하나면 직선 하나와 같은 시간이다 — 베지어 샘플 점 수에 끌려가지 않는다', () => {
    // 곡선은 chainSamplePoints가 8점으로 샘플링하므로, 점 개수로 세면 8배 느려진다.
    const curved: Annotation = { ...pass('shot', { x: 56.2, y: 16.7 }, { x: 54.2, y: 0 }), curved: true }
    expect(chainSamplePoints([curved]).length).toBeGreaterThan(2)
    expect(chainBallDuration([curved])).toBeCloseTo(BALL_SEGMENT_DURATION)
  })
})

describe('carry(드리블) 플래그', () => {
  it('스키마가 carry를 받아들이고, 없으면 undefined다', () => {
    const withCarry = { ...pass('c', { x: 96, y: 16 }, { x: 70, y: 7 }), carry: true }
    const plain = pass('p', { x: 96, y: 16 }, { x: 70, y: 7 })
    expect(annotationSchema.parse(withCarry).carry).toBe(true)
    expect(annotationSchema.parse(plain).carry).toBeUndefined()
  })

  it('드리블 체인의 공은 선수의 국면 전환 모프와 정확히 같은 시간에 이동한다', () => {
    // 화살표 개수로 세면 캐리 두 구간이 1.1초가 되어 공이 선수(0.6초)보다 느려진다.
    const c1 = { ...pass('c1', { x: 96, y: 16 }, { x: 88, y: 10 }), carry: true }
    const c2 = { ...pass('c2', { x: 88, y: 10 }, { x: 70, y: 7 }), carry: true }
    expect(CARRY_BALL_DURATION * 1000).toBe(PHASE_TRANSITION_MS)
    expect(chainBallDuration([c1, c2])).toBeCloseTo(CARRY_BALL_DURATION)
    expect(chainBallDuration([c1])).toBeCloseTo(CARRY_BALL_DURATION)
    // 드리블이 아닌 구간이 섞여 있으면 예전대로 화살표 개수로 센다.
    expect(chainBallDuration([c1, pass('p', { x: 70, y: 7 }, { x: 54, y: 0 })])).toBeCloseTo(
      BALL_SEGMENT_DURATION * 2,
    )
  })

  it('드리블 구간은 체인의 머리에 와서 공이 대기 없이 출발할 수 있어야 한다', () => {
    // AnnotationLayer는 chain[0].carry로 대기 여부를 정한다 — 드리블 화살표가
    // 체인의 머리로 잡히는지(선행 패스가 없는지)까지가 이 판정의 전제다.
    const carry1 = { ...pass('c1', { x: 96, y: 16 }, { x: 88, y: 10 }), carry: true }
    const carry2 = { ...pass('c2', { x: 88, y: 10 }, { x: 70, y: 7 }), carry: true }
    const chains = buildPassChains([carry1, carry2])
    expect(chains).toHaveLength(1)
    expect(chains[0][0].carry).toBe(true)
  })
})

describe('travelTimes', () => {
  it('등간격 점이면 시간도 등간격이다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]
    expect(travelTimes(points)).toEqual([0, 0.5, 1])
  })

  it('구간 길이가 다르면 시간도 거리에 비례해 나뉜다', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 0 }, // 첫 구간 10
      { x: 40, y: 0 }, // 둘째 구간 30, 전체 40
    ]
    const times = travelTimes(points)
    expect(times[0]).toBe(0)
    expect(times[1]).toBeCloseTo(0.25)
    expect(times[2]).toBe(1)
  })

  it('점이 전부 같은 위치(길이 0)여도 죽지 않고 등간격으로 폴백한다', () => {
    const p = { x: 5, y: 5 }
    expect(travelTimes([p, p, p])).toEqual([0, 0.5, 1])
  })

  it('점이 1개 이하면 0으로 채운다', () => {
    expect(travelTimes([{ x: 1, y: 1 }])).toEqual([0])
    expect(travelTimes([])).toEqual([])
  })
})

describe('annotations 스키마', () => {
  const base = {
    schemaVersion: 1,
    match: {
      matchName: 't',
      homeTeam: 'a',
      awayTeam: 'b',
      matchDate: '2026-01-01',
      analyzedTeam: 'home',
    },
    formation: '4-4-2',
    players: Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `n${i}`, number: i + 1 })),
    summary: '',
  }
  const positions = Array.from({ length: 11 }, (_, i) => ({ playerId: `p${i}`, x: 50, y: 50 }))

  it('annotations 키가 없는 구버전 데이터는 빈 배열로 채워진다', () => {
    const parsed = analysisSchema.parse({
      ...base,
      phases: {
        base: { positions, comment: '' },
        attack: { positions, comment: '' },
        defense: { positions, comment: '' },
      },
    })
    expect(parsed.phases.base.annotations).toEqual([])
    expect(parsed.phases.attack.annotations).toEqual([])
  })

  it('화살표를 파싱하고 잘못된 type은 거부한다', () => {
    const withArrow = {
      ...base,
      phases: {
        base: {
          positions,
          comment: '',
          annotations: [{ id: 'a1', type: 'run', from: { x: 10, y: 10 }, to: { x: 40, y: 30 } }],
        },
        attack: { positions, comment: '' },
        defense: { positions, comment: '' },
      },
    }
    expect(analysisSchema.parse(withArrow).phases.base.annotations).toHaveLength(1)

    const bad = structuredClone(withArrow)
    bad.phases.base.annotations[0].type = 'dribble'
    expect(analysisSchema.safeParse(bad).success).toBe(false)
  })

  it('curved 필드는 선택값이고, 있으면 그대로 보존된다', () => {
    const withCurved = {
      ...base,
      phases: {
        base: {
          positions,
          comment: '',
          annotations: [{ id: 'a1', type: 'run', from: { x: 10, y: 10 }, to: { x: 40, y: 30 }, curved: true }],
        },
        attack: { positions, comment: '' },
        defense: { positions, comment: '' },
      },
    }
    const parsed = analysisSchema.parse(withCurved)
    expect(parsed.phases.base.annotations[0].curved).toBe(true)
  })
})
