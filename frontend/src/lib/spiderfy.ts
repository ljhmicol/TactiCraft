/**
 * 전술 대결 뷰(TO-DO 28, 1번)의 마커 겹침 처리 — 두 분석을 한 피치에 겹치면
 * 좌표가 같거나 아주 가까운 선수 마커가 서로 가려진다. 지도 서비스의
 * "마커 클러스터링 + 스파이더파이어"와 같은 문제라 같은 해법을 쓴다: 가까운
 * 마커를 하나의 클러스터로 묶고(union-find), 펼쳐진 상태면 중심점 둘레
 * 원형으로 재배치한다.
 */

export interface SpiderfyPoint {
  id: string
  x: number
  y: number
}

/** 거리 threshold 이내인 점들을 union-find로 묶는다. 순서는 입력 순서를 보존한다. */
export function clusterByDistance(points: SpiderfyPoint[], threshold: number): SpiderfyPoint[][] {
  const parent = new Map<string, string>(points.map((p) => [p.id, p.id]))

  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = id
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }

  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x
      const dy = points[i].y - points[j].y
      if (Math.hypot(dx, dy) <= threshold) union(points[i].id, points[j].id)
    }
  }

  const groups = new Map<string, SpiderfyPoint[]>()
  for (const p of points) {
    const root = find(p.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(p)
  }
  return [...groups.values()]
}

/** 클러스터 중심점 둘레에 균등 간격 원형으로 배치한다(12시 방향부터 시계방향). */
export function spiderfyPositions(members: SpiderfyPoint[], radius: number): Map<string, { x: number; y: number }> {
  const cx = members.reduce((s, m) => s + m.x, 0) / members.length
  const cy = members.reduce((s, m) => s + m.y, 0) / members.length
  const result = new Map<string, { x: number; y: number }>()
  members.forEach((m, i) => {
    const angle = (2 * Math.PI * i) / members.length - Math.PI / 2
    result.set(m.id, { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) })
  })
  return result
}

export function clusterCentroid(members: SpiderfyPoint[]): { x: number; y: number } {
  return {
    x: members.reduce((s, m) => s + m.x, 0) / members.length,
    y: members.reduce((s, m) => s + m.y, 0) / members.length,
  }
}
