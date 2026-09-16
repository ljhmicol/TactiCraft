import { computeIsolationMatchups, type MatchupHighlight } from '@/lib/matchup'
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
  /** 현재 하이라이트된 대상(TO-DO 50-3) — 고립 매치업 행은 구역이 아니라
   * 두 선수(marker.key 2개)를 대상으로 삼는다. */
  highlight: MatchupHighlight
  onTogglePlayers: (keys: string[]) => void
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
  highlight,
  onTogglePlayers,
}: TacticalSuggestionsProps) {
  const third = THIRD_KOREAN(labelA, labelB)
  const isolations = computeIsolationMatchups(zones, dataA, analysisA, positionsB, analysisB).slice(0, MAX_ISOLATIONS_SHOWN)

  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill

  // 팀 이름을 줄글 맨 앞 <strong>이 아니라 작은 배지로 뽑아서, "누가 하는
  // 얘기인지"가 문장을 읽지 않아도 먼저 눈에 들어오게 한다(2026-09-15
  // "카드/배지 UI" 피드백).
  const teamTag = (label: string, color: string, phase: PhaseType) => (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `${color}1a`, color }}
    >
      {label}
      <span className="font-normal opacity-80">{PHASE_SUFFIX[phase]}</span>
    </span>
  )

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold text-muted-foreground">전술 개선방안</p>
      <div className="flex items-start gap-2">
        {teamTag(labelA, colorA, phaseA)}
        <p className="text-base text-muted-foreground">{suggestImprovement(advantage.bTopZone, third)}</p>
      </div>
      <div className="flex items-start gap-2">
        {teamTag(labelB, colorB, phaseB)}
        <p className="text-base text-muted-foreground">{suggestImprovement(advantage.aTopZone, third)}</p>
      </div>
      {isolations.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-2">
          <p className="text-sm font-semibold text-muted-foreground">고립 매치업 (1v1)</p>
          {isolations.map(({ zone, aPlayer, bPlayer }) => {
            const keys = [`a-${aPlayer.player.id}`, `b-${bPlayer.player.id}`]
            const active = highlight?.kind === 'players' && keys.every((k) => highlight.keys.includes(k))
            return (
              <button
                key={`${zone.channel}-${zone.third}`}
                type="button"
                onClick={() => onTogglePlayers(keys)}
                className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-md bg-secondary/60 px-2 py-1.5 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={active ? { boxShadow: '0 0 0 1px #FACC15', background: 'rgba(250,204,21,0.12)' } : undefined}
              >
                <span className="flex items-center gap-1.5 text-base font-medium">
                  <span style={{ color: colorA }}>
                    {aPlayer.line} {aPlayer.player.name}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">vs</span>
                  <span style={{ color: colorB }}>
                    {bPlayer.line} {bPlayer.player.name}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {CHANNEL_KOREAN[zone.channel]} · {third[zone.third]}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
