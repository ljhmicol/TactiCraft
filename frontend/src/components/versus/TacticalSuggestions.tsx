import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { suggestImprovement, THIRD_KOREAN, type MatchupAdvantage } from '@/lib/versusAdvantage'
import type { PhaseType } from '@/types/analysis'

interface TacticalSuggestionsProps {
  advantage: MatchupAdvantage
  labelA: string
  labelB: string
  /** 이 팀이 지금 보고 있는 화면에서 공격/수비 어느 국면인지(MatchupView의 attacker 토글) —
   * 구역 데이터 자체는 항상 A 공격 기준 좌표라 국면이 바뀌어도 diff는 그대로지만,
   * "이 제안이 공격할 때 얘기인지 수비할 때 얘기인지"는 국면에 따라 달라진다. */
  phaseA: PhaseType
  phaseB: PhaseType
}

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
export function TacticalSuggestions({ advantage, labelA, labelB, phaseA, phaseB }: TacticalSuggestionsProps) {
  const third = THIRD_KOREAN(labelA, labelB)

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
    </div>
  )
}
