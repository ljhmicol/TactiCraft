import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { computeMatchupAdvantage, computeThreatWeightedScore, THIRD_KOREAN, zoneLabel } from '@/lib/versusAdvantage'
import type { ZoneOverload } from '@/types/analysis'

interface AdvantageBadgeProps {
  zones: ZoneOverload[]
  labelA: string
  labelB: string
}

// 우세 구역이 많으면(최대 15구역 중 절반 가까이) 줄글이 너무 길어져 읽히지
// 않는다는 피드백(2026-09-09) — |diff| 내림차순으로 이미 정렬된 목록에서
// 격차가 큰 상위 3개만 보여준다. 전체 개수(teamZones.length)는 그대로 쓰고
// 목록만 자른다 — "3구역 우세" 같은 집계 문구가 어긋나면 안 되기 때문.
const TOP_ZONE_COUNT = 3

/**
 * 오버로드 15구역을 A/B 우세 구역으로 요약한다. 확률(%)처럼 보이는 숫자는
 * 일부러 안 만든다 — 실제 경기 시뮬레이션이 아니라 지금 배치된 좌표의 구역별
 * 수적 우위일 뿐이다(TO-DO 22, 16번 "범위 밖" 메모 참조).
 *
 * "수원삼성을 선택하면 어느 구역에서 우세한지 보여주면서 코멘트로 설명"
 * (2026-09-07 피드백) — 클릭으로 고르는 대신 두 팀의 우세 구역을 항상 같이
 * 보여준다(피치 위 색은 MatchupOverloadLayer, 아래 문장은 여기). 가장 격차
 * 큰 구역 하나만이 아니라 우세한 구역 전부를 나열한다.
 */
export function AdvantageBadge({ zones, labelA, labelB }: AdvantageBadgeProps) {
  const { aZones, bZones, neutralZoneCount, totalZones } = computeMatchupAdvantage(zones)
  const threatScore = computeThreatWeightedScore(zones)
  const third = THIRD_KOREAN(labelA, labelB)
  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill

  if (totalZones === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        두 전술 다 상대팀 좌표가 있어야 구역 우위를 계산할 수 있어요.
      </p>
    )
  }

  const aPct = (aZones.length / totalZones) * 100
  const bPct = (bZones.length / totalZones) * 100

  const teamSummary = (label: string, color: string, teamZones: ZoneOverload[]) =>
    teamZones.length > 0 ? (
      <p className="text-sm" style={{ color }}>
        <strong>{label}</strong> 우세 구역({teamZones.length}):{' '}
        {teamZones
          .slice(0, TOP_ZONE_COUNT)
          .map((z) => zoneLabel(z, third))
          .join(', ')}
        {teamZones.length > TOP_ZONE_COUNT && ` 외 ${teamZones.length - TOP_ZONE_COUNT}곳`}
      </p>
    ) : (
      <p className="text-sm text-muted-foreground">
        <strong>{label}</strong>: 수적으로 앞선 구역이 없습니다
      </p>
    )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-medium">
        <span style={{ color: colorA }}>
          {labelA} {aZones.length}구역 우세
        </span>
        <span className="text-xs text-muted-foreground">전체 {totalZones}구역 중</span>
        <span style={{ color: colorB }}>
          {labelB} {bZones.length}구역 우세
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div style={{ width: `${aPct}%`, background: colorA }} />
        <div style={{ width: `${neutralZoneCount === totalZones ? 100 : 100 - aPct - bPct}%` }} />
        <div style={{ width: `${bPct}%`, background: colorB }} />
      </div>
      <div className="space-y-1">
        {teamSummary(labelA, colorA, aZones)}
        {teamSummary(labelB, colorB, bZones)}
      </div>
      <p className="text-xs text-muted-foreground" title="구역 개수가 같아도 중앙·상대 진영에 가까운 구역일수록 더 위험하다고 보고 가중치를 곱해 합산한 점수 — 골 확률 예측이 아니다.">
        위협 가중 점수(중앙·상대 진영에 가까울수록 가중치 큼):{' '}
        <span style={{ color: colorA }}>{labelA} {threatScore.aScore}</span>
        {' · '}
        <span style={{ color: colorB }}>{labelB} {threatScore.bScore}</span>
      </p>
    </div>
  )
}
