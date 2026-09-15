import { computeIsolationMatchups } from '@/lib/matchup'
import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { CHANNEL_KOREAN, suggestImprovement, THIRD_KOREAN, type MatchupAdvantage } from '@/lib/versusAdvantage'
import type { Analysis, PhaseData, PhaseType, PlayerPosition, ZoneOverload } from '@/types/analysis'

interface TacticalSuggestionsProps {
  advantage: MatchupAdvantage
  labelA: string
  labelB: string
  /** 이 팀이 지금 보고 있는 화면에서 공격/수비 어느 국면인지(MatchupView의 attacker 토글) —
   * 구역 데이터 자체는 항상 A 공격 기준 좌표라 국면이 바뀌어도 diff는 그대로지만,
   * "이 제안이 공격할 때 얘기인지 수비할 때 얘기인지"는 국면에 따라 달라진다. */
  phaseA: PhaseType
  phaseB: PhaseType
  zones: ZoneOverload[]
  analysisA: Analysis
  analysisB: Analysis
  dataA: PhaseData
  positionsB: PlayerPosition[]
}

// 여러 곳에서 1v1이 동시에 생길 수 있다 — 가장 위험한 것 2개만 보여준다
// (advisor 조언: 5개씩 나열하면 "실용성" 판단만 흐려진다).
const MAX_ISOLATIONS_SHOWN = 2

const PHASE_SUFFIX: Partial<Record<PhaseType, string>> = { attack: '공격 시', defense: '수비 시' }

/**
 * "각 팀의 전술 개선방안"(TO-DO 38 후속). 승률(%)과 달리 시뮬레이션이
 * 아니라 지금 그려진 좌표의 구역별 수적 열세를 그대로 짚는 것이라 "가짜
 * 예측 금지" 원칙(lib/versusAdvantage.ts 상단)에 걸리지 않는다.
 *
 * A팀의 약점 구역 = B팀이 가장 크게 앞선 구역, 즉 `bTopZone`이다(제로섬
 * 이라 diff 부호만 다를 뿐 같은 구역을 가리킨다). B팀의 약점 구역은 그
 * 반대인 `aTopZone`이다 — 그래서 아래 호출부는 A팀 줄에 `bTopZone`을,
 * B팀 줄에 `aTopZone`을 넘긴다(A/B 이름과 반대로 넘기는 게 맞다).
 *
 * 국면 표시(후속 요청, "수비할때면 수비할때, 공격이면 공격할때의
 * 개선방안이라는걸 표현해줘") — MatchupView는 공수 교대 버튼으로 A/B 중
 * 누가 공격인지 토글하는데, 그 상태를 안 보여주면 "이 제안이 지금 이
 * 팀이 공격 중이라 하는 말인지 수비 중이라 하는 말인지" 알 수 없다.
 */
export function TacticalSuggestions({
  advantage,
  labelA,
  labelB,
  phaseA,
  phaseB,
  zones,
  analysisA,
  analysisB,
  dataA,
  positionsB,
}: TacticalSuggestionsProps) {
  const third = THIRD_KOREAN(labelA, labelB)
  const isolations = computeIsolationMatchups(zones, dataA, analysisA, positionsB, analysisB).slice(0, MAX_ISOLATIONS_SHOWN)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground">전술 개선방안</p>
      <p className="text-sm" style={{ color: VERSUS_TEAM_COLORS.A.fill }}>
        <strong>{labelA}</strong>{' '}
        <span className="text-xs text-muted-foreground">({PHASE_SUFFIX[phaseA]})</span>{' '}
        {suggestImprovement(advantage.bTopZone, third)}
      </p>
      <p className="text-sm" style={{ color: VERSUS_TEAM_COLORS.B.fill }}>
        <strong>{labelB}</strong>{' '}
        <span className="text-xs text-muted-foreground">({PHASE_SUFFIX[phaseB]})</span>{' '}
        {suggestImprovement(advantage.aTopZone, third)}
      </p>
      {isolations.length > 0 && (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-xs font-semibold text-muted-foreground">고립 매치업 (1v1)</p>
          {isolations.map(({ zone, aPlayer, bPlayer }) => (
            <p key={`${zone.channel}-${zone.third}`} className="text-sm text-muted-foreground">
              <span style={{ color: VERSUS_TEAM_COLORS.A.fill }}>
                {aPlayer.line} {aPlayer.player.name}
              </span>
              {' vs '}
              <span style={{ color: VERSUS_TEAM_COLORS.B.fill }}>
                {bPlayer.line} {bPlayer.player.name}
              </span>
              {' — '}
              {CHANNEL_KOREAN[zone.channel]} · {third[zone.third]}에서 1대1로 고립됩니다
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
