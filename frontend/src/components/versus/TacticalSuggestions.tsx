import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { suggestImprovement, THIRD_KOREAN, type MatchupAdvantage } from '@/lib/versusAdvantage'

interface TacticalSuggestionsProps {
  advantage: MatchupAdvantage
  labelA: string
  labelB: string
}

/**
 * "각 팀의 전술 개선방안"(TO-DO 38 후속). 승률(%)과 달리 시뮬레이션이
 * 아니라 지금 그려진 좌표의 구역별 수적 열세를 그대로 짚는 것이라 "가짜
 * 예측 금지" 원칙(lib/versusAdvantage.ts 상단)에 걸리지 않는다.
 *
 * A팀의 약점 구역 = B팀이 가장 크게 앞선 구역, 즉 `bTopZone`이다(제로섬
 * 이라 diff 부호만 다를 뿐 같은 구역을 가리킨다). B팀의 약점 구역은 그
 * 반대인 `aTopZone`이다 — 그래서 아래 호출부는 A팀 줄에 `bTopZone`을,
 * B팀 줄에 `aTopZone`을 넘긴다(A/B 이름과 반대로 넘기는 게 맞다).
 */
export function TacticalSuggestions({ advantage, labelA, labelB }: TacticalSuggestionsProps) {
  const third = THIRD_KOREAN(labelA, labelB)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground">전술 개선방안</p>
      <p className="text-sm" style={{ color: VERSUS_TEAM_COLORS.A.fill }}>
        <strong>{labelA}</strong> {suggestImprovement(advantage.bTopZone, third)}
      </p>
      <p className="text-sm" style={{ color: VERSUS_TEAM_COLORS.B.fill }}>
        <strong>{labelB}</strong> {suggestImprovement(advantage.aTopZone, third)}
      </p>
    </div>
  )
}
