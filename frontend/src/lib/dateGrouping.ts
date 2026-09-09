/**
 * 저장 목록을 일별/주별로 나눠 보여주는 그룹핑(TO-DO 7번 후속, 2026-09-09
 * 사용자 요청 — "저장목록을 하루마다 혹은 일주일마다 끊으면 좋겠다").
 * 경기 일자(matchDate, 목록에 이미 "일자" 컬럼으로 보이는 값) 기준으로
 * 나눈다 — 언제 저장했는지(updatedAt)가 아니라 그 경기가 언제였는지가
 * 전술 라이브러리를 훑어볼 때 더 자연스러운 기준이라고 판단했다.
 */

export interface DateGroup<T> {
  key: string
  label: string
  items: T[]
}

function startOfWeekMonday(matchDate: string): Date {
  const d = new Date(`${matchDate}T00:00:00`)
  const day = d.getDay() // 0=일 ~ 6=토
  const diffToMonday = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diffToMonday)
  return d
}

function formatMD(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function groupByDate<T extends { matchDate: string }>(
  items: T[],
  mode: 'day' | 'week',
): DateGroup<T>[] {
  const groups = new Map<string, { label: string; items: T[] }>()

  for (const item of items) {
    let key: string
    let label: string
    if (mode === 'day') {
      key = item.matchDate
      label = item.matchDate
    } else {
      const monday = startOfWeekMonday(item.matchDate)
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      key = monday.toISOString().slice(0, 10)
      label = `${formatMD(monday)} ~ ${formatMD(sunday)}`
    }
    if (!groups.has(key)) groups.set(key, { label, items: [] })
    groups.get(key)!.items.push(item)
  }

  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // 최근 날짜(주)가 위로
    .map(([key, { label, items: groupItems }]) => ({ key, label, items: groupItems }))
}
