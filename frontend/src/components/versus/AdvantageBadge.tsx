import { InfoDialogButton } from '@/components/versus/InfoDialogButton'
import { ThreatHeatmapPreview } from '@/components/versus/ThreatHeatmapPreview'
import type { MatchupHighlight } from '@/lib/matchup'
import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { computeMatchupAdvantage, computeThreatWeightedScore, THIRD_KOREAN, zoneLabel } from '@/lib/versusAdvantage'
import type { Channel, Third, ZoneOverload } from '@/types/analysis'

interface AdvantageBadgeProps {
  zones: ZoneOverload[]
  labelA: string
  labelB: string
  /** 현재 하이라이트된 대상(TO-DO 50-3) — 이 구역 칩이 켜져 있는지 비교용 */
  highlight: MatchupHighlight
  /** 구역 칩 클릭 시 호출. 이미 켜진 구역을 다시 누르면 MatchupView가 꺼준다(토글) */
  onToggleZone: (channel: Channel, third: Third) => void
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
 *
 * 화면 표기는 "우세"가 아니라 "수적 우위"라고 쓴다(2026-09-15, "우세/열세
 * 프레임에서 공간/밀집 프레임으로" 피드백) — 승패를 판정하는 단어 대신
 * 지금 배치의 숫자 사실만 서술하는 중립적 분석 용어를 쓰기 위해서다.
 */
export function AdvantageBadge({ zones, labelA, labelB, highlight, onToggleZone }: AdvantageBadgeProps) {
  const { aZones, bZones, neutralZoneCount, totalZones } = computeMatchupAdvantage(zones)
  const threatScore = computeThreatWeightedScore(zones)
  const third = THIRD_KOREAN(labelA, labelB)
  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill

  if (totalZones === 0) {
    return (
      <p className="text-base text-muted-foreground">
        두 전술 다 상대팀 좌표가 있어야 구역 우위를 계산할 수 있어요.
      </p>
    )
  }

  const aPct = (aZones.length / totalZones) * 100
  const bPct = (bZones.length / totalZones) * 100

  // 문장(", "로 이어붙인 줄글) 대신 구역마다 칩으로 나열한다(2026-09-15
  // "카드/배지 UI + 인포그래픽" 피드백) — 텍스트는 KeyZoneCallout 배지와
  // 같은 zoneLabel()을 그대로 써서 같은 구역이 화면마다 다르게 안 읽히게 한다.
  // 칩을 누르면 피치 위 해당 구역이 하이라이트된다(TO-DO 50-3, "상단 바와
  // 피치 간의 인터랙션 연결" 피드백).
  const teamZoneChips = (color: string, teamZones: ZoneOverload[]) =>
    teamZones.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1">
        {teamZones.slice(0, TOP_ZONE_COUNT).map((z) => {
          const active = highlight?.kind === 'zone' && highlight.channel === z.channel && highlight.third === z.third
          return (
            <button
              key={`${z.channel}-${z.third}`}
              type="button"
              onClick={() => onToggleZone(z.channel, z.third)}
              className="rounded-full border px-2 py-0.5 text-xs font-medium transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                borderColor: active ? '#FACC15' : `${color}66`,
                background: active ? `${color}33` : `${color}1a`,
                color,
                boxShadow: active ? '0 0 0 1px #FACC15' : undefined,
              }}
            >
              {zoneLabel(z, third)}
            </button>
          )
        })}
        {teamZones.length > TOP_ZONE_COUNT && (
          <span className="text-xs text-muted-foreground">외 {teamZones.length - TOP_ZONE_COUNT}곳</span>
        )}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">수적 우위 구역이 없습니다</span>
    )

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-base font-medium">
          <span style={{ color: colorA }}>
            {labelA} {aZones.length}구역 수적 우위
          </span>
          <span className="text-sm text-muted-foreground">전체 {totalZones}구역 중</span>
          <span style={{ color: colorB }}>
            {labelB} {bZones.length}구역 수적 우위
          </span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div style={{ width: `${aPct}%`, background: colorA }} />
          <div style={{ width: `${neutralZoneCount === totalZones ? 100 : 100 - aPct - bPct}%` }} />
          <div style={{ width: `${bPct}%`, background: colorB }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: colorA }}>
            {labelA} 수적 우위 구역
          </p>
          {teamZoneChips(colorA, aZones)}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold" style={{ color: colorB }}>
            {labelB} 수적 우위 구역
          </p>
          {teamZoneChips(colorB, bZones)}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          위협 가중 점수
          <InfoDialogButton title="위협 가중 점수란?" ariaLabel="위협 가중 점수 설명 보기">
            <ThreatHeatmapPreview zones={zones} labelA={labelA} labelB={labelB} />
            <p>
              바로 위 &quot;N구역 수적 우위&quot;는 15구역(5채널×3서드)을 똑같이 1표씩 세기 때문에, 자기 진영 구석에서 딴
              우위와 상대 골문 바로 앞 중앙에서 딴 우위가 똑같이 1구역으로 상쇄될 수 있습니다.
            </p>
            <p>
              위협 가중 점수는 각 구역의 수적 차이(own−opp)에 <strong>중앙에 가까울수록, 상대 진영(공격 방향
              앞쪽)에 가까울수록</strong> 더 크게 매긴 고정 가중치를 곱해 합산한 값입니다 — 측면·자기 진영 구석보다
              중앙·상대 박스 앞 구역의 가중치가 훨씬 큽니다.
            </p>
            <p>골 확률을 예측한 값이 아니라, 지금 배치를 기준으로 &quot;어디서 난 우위가 더 위험한 자리인지&quot;를 보여주는 상대적인 점수입니다.</p>
          </InfoDialogButton>
        </span>
        <span className="flex items-center gap-2 text-lg font-bold tabular-nums">
          <span style={{ color: colorA }}>{threatScore.aScore}</span>
          <span className="text-[11px] font-normal text-muted-foreground">vs</span>
          <span style={{ color: colorB }}>{threatScore.bScore}</span>
        </span>
      </div>
    </div>
  )
}
