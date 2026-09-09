import { describe, expect, it } from 'vitest'

import { groupByDate } from '@/lib/dateGrouping'

function item(matchDate: string, id: number) {
  return { id, matchDate }
}

describe('groupByDate — day 모드', () => {
  it('같은 matchDate는 한 그룹으로 묶인다', () => {
    const groups = groupByDate([item('2026-09-09', 1), item('2026-09-09', 2), item('2026-09-08', 3)], 'day')
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('2026-09-09')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].label).toBe('2026-09-08')
    expect(groups[1].items).toHaveLength(1)
  })

  it('최근 날짜가 먼저 온다(내림차순)', () => {
    const groups = groupByDate([item('2026-09-01', 1), item('2026-09-15', 2), item('2026-09-08', 3)], 'day')
    expect(groups.map((g) => g.key)).toEqual(['2026-09-15', '2026-09-08', '2026-09-01'])
  })

  it('그룹 안에서는 입력 순서를 보존한다', () => {
    const groups = groupByDate([item('2026-09-09', 5), item('2026-09-09', 1)], 'day')
    expect(groups[0].items.map((i) => i.id)).toEqual([5, 1])
  })
})

describe('groupByDate — week 모드', () => {
  it('같은 주(월요일 시작)의 날짜는 한 그룹으로 묶인다', () => {
    // 2026-09-07은 월요일, 2026-09-09는 같은 주 수요일, 2026-09-13은 같은 주 일요일
    const groups = groupByDate(
      [item('2026-09-07', 1), item('2026-09-09', 2), item('2026-09-13', 3)],
      'week',
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(3)
  })

  it('다음 주(월요일)로 넘어가면 다른 그룹이 된다', () => {
    const groups = groupByDate([item('2026-09-13', 1), item('2026-09-14', 2)], 'week')
    expect(groups).toHaveLength(2)
  })

  it('라벨은 "MM/DD ~ MM/DD" 형식이다', () => {
    const groups = groupByDate([item('2026-09-09', 1)], 'week')
    expect(groups[0].label).toBe('09/07 ~ 09/13')
  })
})

describe('groupByDate — 공통', () => {
  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(groupByDate([], 'day')).toEqual([])
  })
})
