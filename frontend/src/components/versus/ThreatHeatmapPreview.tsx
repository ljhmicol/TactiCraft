import { transposeRect } from '@/lib/coords'
import { computeZoneThreatContributions } from '@/lib/versusAdvantage'
import { Pitch } from '@/components/pitch/Pitch'
import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { CHANNEL_BOUNDS, THIRD_BOUNDS } from '@/lib/zones'
import type { ZoneOverload } from '@/types/analysis'

interface ThreatHeatmapPreviewProps {
  zones: ZoneOverload[]
  labelA: string
  labelB: string
}

// 기여도 크기에 비례해 옅게/짙게 그라데이션을 줬더니(2026-09-15) "어떤
// 부분은 연하고 어떤 부분은 진해. 다 통일했으면 좋겠어. 진하게" 피드백 —
// 구역마다 다른 불투명도 대신 기여가 있는 구역은 전부 같은 짙은 값 하나로
// 통일한다. 어느 팀 쪽 기여인지(색)는 여전히 구분되지만 "얼마나 큰
// 기여인지"는 더 이상 색 짙기로 표현하지 않는다.
const ZONE_FILL_OPACITY = 0.6

/**
 * 위협 가중 점수 ⓘ 안내 창 안의 미니 피치(TO-DO 50번대, "가중 점수 옆
 * 버튼... 그 창에 전술판을 추가해서 보여주는게 좋을거같아" 피드백) —
 * 위협 가중 점수에 기여하는 15구역을 색으로 보여준다. 색 자체는 기존 앱
 * 전체의 팀 색 관례(VERSUS_TEAM_COLORS, A=파랑/B=빨강)를 따른다 —
 * 처음 제안에 예시로 나온 "붉은색"을 팀과 무관하게 그대로 쓰면
 * "빨강=B팀"이라는 기존 관례와 부딪힌다.
 *
 * 클릭도 숫자 표시도 없는 순수 정적 미리보기다 — 이 다이얼로그는 "왜 이
 * 점수가 나왔는지" 설명이 목적이라, 실제 피치(MatchupOverloadLayer)와
 * 달리 On/Off 토글이나 하이라이트 상태를 공유하지 않는다.
 */
export function ThreatHeatmapPreview({ zones, labelA, labelB }: ThreatHeatmapPreviewProps) {
  const contributions = computeZoneThreatContributions(zones)

  return (
    <div className="space-y-1.5">
      <div className="h-44">
        <Pitch orientation="landscape">
          <g>
            {contributions
              .filter((c) => c.contribution !== 0)
              .map((c) => {
                const [x0, x1] = CHANNEL_BOUNDS[c.channel]
                const [y0, y1] = THIRD_BOUNDS[c.third]
                const rect = transposeRect(x0, x1, y0, y1)
                const color = c.contribution > 0 ? VERSUS_TEAM_COLORS.A.fill : VERSUS_TEAM_COLORS.B.fill
                return (
                  <rect
                    key={`${c.channel}-${c.third}`}
                    x={rect.x}
                    y={rect.y}
                    width={rect.width}
                    height={rect.height}
                    fill={color}
                    fillOpacity={ZONE_FILL_OPACITY}
                  />
                )
              })}
          </g>
        </Pitch>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        칠해진 구역이 위협 가중 점수에 기여하는 구역입니다({VERSUS_TEAM_COLORS.A.label} {labelA} ·{' '}
        {VERSUS_TEAM_COLORS.B.label} {labelB}) — 왼쪽이 {labelA} 진영, 오른쪽이 {labelB} 진영입니다.
      </p>
    </div>
  )
}
