import type { Channel, Third, ZoneOverload } from '@/types/analysis'

/**
 * 전술 대결 뷰의 "우위" 표시(TO-DO 22) — 실제 경기 결과 예측이 아니라 오버로드
 * 15구역 계산을 A/B 양쪽 기준으로 다시 센 것뿐이다. 확률(%)처럼 보이는 숫자는
 * 일부러 만들지 않는다(TO-DO-LIST.md 16번 "범위 밖" 참조) — 실제 시뮬레이션
 * 없이 승률을 보여주면 진짜 예측처럼 오해되기 쉽다.
 *
 * computeOverload는 "own(A) 기준으로 own이 앞선 구역"만 strong/weak로
 * 표시하도록 만들어져 있다(단일 팀 에디터 뷰용) — 여기서는 그 결과의
 * diff 부호를 그대로 이용해 B가 앞선 구역도 대칭적으로 센다.
 *
 * aZones/bZones는 |diff| 내림차순으로 정렬해서 돌려준다 — 가장 격차가 큰
 * 구역부터 보여주는 게(배지 문장·피치 강조 둘 다) 자연스럽다.
 */
export interface MatchupAdvantage {
  aZones: ZoneOverload[]
  bZones: ZoneOverload[]
  neutralZoneCount: number
  totalZones: number
  aTopZone: ZoneOverload | null
  bTopZone: ZoneOverload | null
}

export const CHANNEL_KOREAN: Record<Channel, string> = {
  leftWing: '왼쪽 측면',
  leftHalf: '왼쪽 하프스페이스',
  center: '중앙',
  rightHalf: '오른쪽 하프스페이스',
  rightWing: '오른쪽 측면',
}

/** third는 own(A) 기준 y좌표라 A/B 공수와 무관하게 "누구 골문 근처인지"로 표기한다. */
export const THIRD_KOREAN: (labelA: string, labelB: string) => Record<Third, string> = (labelA, labelB) => ({
  attacking: `${labelB} 골문 근처`,
  middle: '중원',
  defensive: `${labelA} 골문 근처`,
})

export function computeMatchupAdvantage(zones: ZoneOverload[]): MatchupAdvantage {
  const aZones = zones.filter((z) => z.diff > 0).sort((a, b) => b.diff - a.diff)
  const bZones = zones.filter((z) => z.diff < 0).sort((a, b) => a.diff - b.diff)
  const neutralZoneCount = zones.length - aZones.length - bZones.length

  return {
    aZones,
    bZones,
    neutralZoneCount,
    totalZones: zones.length,
    aTopZone: aZones[0] ?? null,
    bTopZone: bZones[0] ?? null,
  }
}

/** "왼쪽 하프스페이스 · 중원(2:1)" — own/opp는 항상 A 기준(own=A, opp=B)이다.
 * B 우세 구역을 설명할 때도 순서를 안 뒤집는다 — AdvantageBadge가 처음부터
 * 이 순서로 써 왔고(2026-09-07~), 화면에 이미 이 표기로 나가고 있어서
 * 새 컴포넌트만 다르게 쓰면 같은 구역이 문구마다 다르게 읽힌다. */
export function zoneLabel(z: ZoneOverload, third: Record<Third, string>): string {
  return `${CHANNEL_KOREAN[z.channel]} · ${third[z.third]}(${z.own}:${z.opp})`
}

/**
 * 전술 개선방안(TO-DO 38 후속, "각 팀의 전술 개선방안"). 확률·승률과 달리
 * 이건 지금 그려진 좌표를 그대로 센 사실이라 "가짜 예측" 금지 원칙(파일
 * 상단 docstring)에 안 걸린다 — 시뮬레이션이 아니라 "이 구역은 인원이
 * 적다"는 관찰이다.
 *
 * A팀의 약점 구역은 B팀이 가장 크게 앞선 구역과 같다(제로섬이라 diff
 * 부호만 다를 뿐 같은 구역) — 그래서 호출부는 A팀 제안에 `bTopZone`을,
 * B팀 제안에 `aTopZone`을 넘긴다(반대로 넘기는 게 아니라 "상대가 가장
 * 앞선 구역 = 내가 가장 뒤진 구역"이라는 뜻).
 */
export function suggestImprovement(weakestZone: ZoneOverload | null, third: Record<Third, string>): string {
  if (!weakestZone) return '뚜렷한 열세 구역이 없어요 — 지금 배치를 유지해도 좋아 보입니다.'
  return `${zoneLabel(weakestZone, third)}에서 수적 열세 — 이 구역에 인원을 보강하는 재배치를 고려해보세요.`
}
