import { CHANNEL_BOUNDS, CHANNELS, THIRD_BOUNDS, THIRDS } from '@/lib/zones'
import type { PhaseData, Point, ZoneOverload } from '@/types/analysis'

/** 하한 포함, 상한 배제. 단 마지막 구역(상한 100)만 100을 포함시킨다 (2단계 §9.1, 4단계 §5.2). */
export function within(v: number, lo: number, hi: number): boolean {
  return v >= lo && (hi >= 100 ? v <= 100 : v < hi)
}

/**
 * 15구역(5채널 × 3서드) 오버로드 계산. 상대팀 좌표가 없으면 빈 배열(레이어 비활성).
 *
 * 드래그 시 0~99.9로 클램프하는 것만으로는 부족하다 — JSON 가져오기·API 조회로
 * 들어오는 좌표는 드래그를 거치지 않으므로 정확히 100일 수 있다(검증 규칙이
 * 0<=v<=100을 허용). 그래서 `within`이 상한 100을 포함하도록 만들어야 한다.
 */
export function computeOverload(phase: PhaseData): ZoneOverload[] {
  const opp = phase.opponentPositions
  if (!opp || opp.length === 0) return []

  const own = phase.positions
  const result: ZoneOverload[] = []

  for (const channel of CHANNELS) {
    const [x0, x1] = CHANNEL_BOUNDS[channel]
    for (const third of THIRDS) {
      const [y0, y1] = THIRD_BOUNDS[third]
      const inZone = (p: Point) => within(p.x, x0, x1) && within(p.y, y0, y1)

      const ownCount = own.filter(inZone).length
      const oppCount = opp.filter(inZone).length
      const diff = ownCount - oppCount

      result.push({
        channel,
        third,
        own: ownCount,
        opp: oppCount,
        diff,
        level: diff >= 2 ? 'strong' : diff === 1 ? 'weak' : 'none',
      })
    }
  }
  return result
}
