import { PITCH_LENGTH_M, PITCH_WIDTH_M } from '@/lib/zones'
import type { PlayerPosition } from '@/types/analysis'

/**
 * GK 판별은 role 문자열이 아니라 y가 가장 큰 선수 1명으로 한다 (2단계 §9).
 * role은 자유 입력이라 "골키퍼"/"GK"/빈 값이 섞여 신뢰할 수 없다.
 * 압박 라인과 콤팩트니스가 이 헬퍼를 공유한다 (4단계 §5.4/5.5).
 */
export function outfieldPlayers(positions: PlayerPosition[]): PlayerPosition[] {
  const sorted = [...positions].sort((a, b) => b.y - a.y)
  return sorted.slice(1)
}

/** pressingLineY가 수동 지정되어 있으면 이 함수를 호출하지 않고 그 값을 그대로 쓴다. */
export function autoPressingLine(positions: PlayerPosition[]): number {
  const sorted = [...positions].sort((a, b) => b.y - a.y)
  return sorted[1]?.y ?? sorted[0]?.y ?? 0
}

export type PressingLineLevel = '매우 높음' | '높음' | '보통' | '낮음' | '매우 낮음'

/**
 * "압박 라인 y=82" 같은 숫자 표기는 y=0이 상대 골문이라는 좌표 규약을 모르면
 * 못 읽는다(2026-09-07 사용자 피드백). y가 작을수록(상대 골문에 가까울수록)
 * "높은 라인"이라는 축구 용어에 맞춰 5단계로 바꾼다.
 *
 * 경계값 2차 재조정(2026-09-16, "매우 높음을 높음 정도로 바꾸고 매우
 * 낮음은 낮음 정도로 바꿔줘. 그 사이 압박 라인들은 간격 균일하게") —
 * 첫 재조정(2026-09-08, 하프라인=매우 높음 경계)이 정한 0~50/90~100
 * 극단 구간이 실제로는 잘 안 쓰이는 비현실적인 라인이었다는 지적. 양 끝
 * "매우 높음"·"매우 낮음"을 옛 "높음"·"낮음" 자리로 끌어당기고, 5단계
 * 전부를 y=58~86 구간 안에서 7 단위 균등 간격(58/65/72/79/86)으로
 * 다시 세웠다 — 경계는 그 중간값(반올림)이다.
 */
export function pressingLineLevel(y: number): PressingLineLevel {
  if (y <= 62) return '매우 높음'
  if (y <= 69) return '높음'
  if (y <= 76) return '보통'
  if (y <= 83) return '낮음'
  return '매우 낮음'
}

export interface CompactnessResult {
  box: { x: number; y: number; width: number; height: number }
  verticalM: number
  horizontalM: number
}

export function computeCompactness(positions: PlayerPosition[]): CompactnessResult | null {
  const outfield = outfieldPlayers(positions)
  if (outfield.length === 0) return null

  const minX = Math.min(...outfield.map((p) => p.x))
  const maxX = Math.max(...outfield.map((p) => p.x))
  const minY = Math.min(...outfield.map((p) => p.y))
  const maxY = Math.max(...outfield.map((p) => p.y))

  return {
    box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    verticalM: +(((maxY - minY) * PITCH_LENGTH_M) / 100).toFixed(1), // y축 = 길이 105m
    horizontalM: +(((maxX - minX) * PITCH_WIDTH_M) / 100).toFixed(1), // x축 = 폭 68m
  }
}
