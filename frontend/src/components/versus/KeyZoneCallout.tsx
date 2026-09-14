import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { THIRD_KOREAN, type MatchupAdvantage, zoneLabel } from '@/lib/versusAdvantage'

interface KeyZoneCalloutProps {
  advantage: MatchupAdvantage
  labelA: string
  labelB: string
}

/**
 * "키포인트 포지션"(TO-DO 38 후속) — `AdvantageBadge`가 이미 우세 구역을
 * |diff| 내림차순으로 나열하고 있어서(맨 위가 사실상 핵심 구역이다), 새로
 * 계산하지 않고 그 목록의 1등(`aTopZone`/`bTopZone`)만 따로 뽑아 더 눈에
 * 띄게 보여준다 — 문장 속에 묻혀 있던 "가장 격차 큰 구역"을 배지 형태로
 * 꺼내는 것뿐이라 AdvantageBadge와 다른 사실을 주장하지 않는다.
 */
export function KeyZoneCallout({ advantage, labelA, labelB }: KeyZoneCalloutProps) {
  const { aTopZone, bTopZone } = advantage
  if (!aTopZone && !bTopZone) return null
  const third = THIRD_KOREAN(labelA, labelB)

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {aTopZone && (
        <span
          className="rounded-full border px-3 py-1 font-medium"
          style={{ borderColor: `${VERSUS_TEAM_COLORS.A.fill}66`, background: `${VERSUS_TEAM_COLORS.A.fill}1a`, color: VERSUS_TEAM_COLORS.A.fill }}
        >
          ★ {labelA} 키포인트: {zoneLabel(aTopZone, third)}
        </span>
      )}
      {bTopZone && (
        <span
          className="rounded-full border px-3 py-1 font-medium"
          style={{ borderColor: `${VERSUS_TEAM_COLORS.B.fill}66`, background: `${VERSUS_TEAM_COLORS.B.fill}1a`, color: VERSUS_TEAM_COLORS.B.fill }}
        >
          ★ {labelB} 키포인트: {zoneLabel(bTopZone, third)}
        </span>
      )}
    </div>
  )
}
