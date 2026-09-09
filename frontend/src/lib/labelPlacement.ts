/**
 * 전술 대결 뷰(TO-DO 28, 1번)의 동적 라벨 배치 — 마커 위치는 그대로 두고
 * 이름표(라벨)끼리만 겹치지 않게 아래로 밀어낸다. 완전한 2D 힘-기반
 * 배치 대신, x로 정렬한 뒤 왼쪽부터 하나씩 "이미 배치된 라벨과 안 겹칠
 * 때까지 한 칸씩 아래로" 밀어내는 그리디 스윕만 쓴다 — 지도 라벨 배치
 * 라이브러리들이 흔히 쓰는 실용적 근사와 같은 방식이고, 결정적(같은 입력→
 * 같은 출력)이라 테스트하기 쉽다.
 */

export interface LabelBox {
  id: string
  x: number // 앵커(마커) x — 라벨은 이 x를 중심으로 그려진다
  defaultY: number // 기본 라벨 y(마커 바로 아래)
  width: number
  height: number
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2

/** id -> y 오프셋(기본 위치에서 얼마나 더 아래로 밀렸는지, 0이면 안 밀림). */
export function resolveLabelOverlap(labels: LabelBox[], step: number): Map<string, number> {
  const ordered = [...labels].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))
  const placed: { x: number; y: number; width: number; height: number }[] = []
  const offsets = new Map<string, number>()

  for (const label of ordered) {
    let y = label.defaultY
    let box = { x: label.x, y, width: label.width, height: label.height }
    while (placed.some((p) => overlaps(p, box))) {
      y += step
      box = { ...box, y }
    }
    placed.push(box)
    offsets.set(label.id, y - label.defaultY)
  }

  return offsets
}
