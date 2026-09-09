import { describe, expect, it } from 'vitest'

import { resolveLabelOverlap } from '@/lib/labelPlacement'

describe('resolveLabelOverlap', () => {
  it('겹치지 않는 라벨은 오프셋이 0이다', () => {
    const offsets = resolveLabelOverlap(
      [
        { id: 'a', x: 0, defaultY: 10, width: 4, height: 2 },
        { id: 'b', x: 50, defaultY: 10, width: 4, height: 2 },
      ],
      2,
    )
    expect(offsets.get('a')).toBe(0)
    expect(offsets.get('b')).toBe(0)
  })

  it('같은 x·y에 겹치는 라벨은 하나가 아래로 밀린다', () => {
    const offsets = resolveLabelOverlap(
      [
        { id: 'a', x: 10, defaultY: 10, width: 6, height: 2 },
        { id: 'b', x: 10, defaultY: 10, width: 6, height: 2 },
      ],
      2,
    )
    const values = [...offsets.values()]
    expect(values).toContain(0)
    expect(values.some((v) => v > 0)).toBe(true)
  })

  it('밀어낸 뒤에는 실제로 겹치지 않는다', () => {
    const labels = [
      { id: 'a', x: 10, defaultY: 10, width: 6, height: 2 },
      { id: 'b', x: 11, defaultY: 10, width: 6, height: 2 },
      { id: 'c', x: 12, defaultY: 10, width: 6, height: 2 },
    ]
    const offsets = resolveLabelOverlap(labels, 2.5)
    const finalYs = labels.map((l) => l.defaultY + (offsets.get(l.id) ?? 0))
    // step(2.5) > height(2)라 같은 y로 밀린 라벨은 없어야 한다(전부 다른 행)
    expect(new Set(finalYs).size).toBe(3)
  })

  it('x가 충분히 멀면 y가 같아도 겹치지 않는다(오프셋 0)', () => {
    const offsets = resolveLabelOverlap(
      [
        { id: 'a', x: 0, defaultY: 10, width: 4, height: 2 },
        { id: 'b', x: 20, defaultY: 10, width: 4, height: 2 },
      ],
      2,
    )
    expect(offsets.get('a')).toBe(0)
    expect(offsets.get('b')).toBe(0)
  })

  it('빈 입력은 빈 맵을 반환한다', () => {
    expect(resolveLabelOverlap([], 2).size).toBe(0)
  })
})
