import { describe, expect, it } from 'vitest'

import { clusterByDistance, clusterCentroid, spiderfyPositions } from '@/lib/spiderfy'

describe('clusterByDistance', () => {
  it('멀리 떨어진 점은 각자 독립 클러스터가 된다', () => {
    const points = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 50, y: 50 },
    ]
    const groups = clusterByDistance(points, 5)
    expect(groups).toHaveLength(2)
  })

  it('threshold 이내 점들은 하나의 클러스터로 묶인다', () => {
    const points = [
      { id: 'a', x: 10, y: 10 },
      { id: 'b', x: 11, y: 10 },
      { id: 'c', x: 50, y: 50 },
    ]
    const groups = clusterByDistance(points, 3)
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.length).sort()
    expect(sizes).toEqual([1, 2])
  })

  it('연쇄로 이어진 점들(a-b 가깝고 b-c 가까움)은 하나로 묶인다 — union-find 전이성', () => {
    const points = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 3, y: 0 },
      { id: 'c', x: 6, y: 0 },
    ]
    const groups = clusterByDistance(points, 3.5)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toHaveLength(3)
  })

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(clusterByDistance([], 5)).toEqual([])
  })
})

describe('spiderfyPositions', () => {
  it('멤버 수만큼 좌표를 반환하고, 각 좌표는 중심에서 정확히 radius만큼 떨어져 있다', () => {
    const members = [
      { id: 'a', x: 50, y: 50 },
      { id: 'b', x: 52, y: 50 },
      { id: 'c', x: 50, y: 52 },
    ]
    const positions = spiderfyPositions(members, 10)
    const centroid = clusterCentroid(members)
    expect(positions.size).toBe(3)
    for (const m of members) {
      const p = positions.get(m.id)!
      const dist = Math.hypot(p.x - centroid.x, p.y - centroid.y)
      expect(dist).toBeCloseTo(10, 5)
    }
  })

  it('2명이면 중심을 사이에 두고 반대쪽에 배치된다', () => {
    const members = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 0, y: 0 },
    ]
    const positions = spiderfyPositions(members, 8)
    const pa = positions.get('a')!
    const pb = positions.get('b')!
    expect(pa.x).toBeCloseTo(-pb.x, 5)
    expect(pa.y).toBeCloseTo(-pb.y, 5)
  })
})

describe('clusterCentroid', () => {
  it('멤버 좌표의 평균을 반환한다', () => {
    const centroid = clusterCentroid([
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 10, y: 20 },
    ])
    expect(centroid).toEqual({ x: 5, y: 10 })
  })
})
