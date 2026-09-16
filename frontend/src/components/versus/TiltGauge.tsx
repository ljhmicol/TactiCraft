import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import type { TiltIndex } from '@/lib/matchup'

interface TiltGaugeProps {
  tilt: TiltIndex
  labelA: string
  labelB: string
}

// |평균 x - 50|이 이 값보다 작으면 "쏠렸다"고 안 하고 그냥 "중앙"이라고
// 한다 — 소수점 차이까지 "왼쪽으로 0.3 쏠림"이라고 읽으면 가짜 정밀도로
// 보인다(versusAdvantage.ts의 "가짜 확률 금지" 원칙과 같은 절제).
const CENTER_THRESHOLD = 3

function tiltLabel(avgX: number): string {
  const diff = avgX - 50
  if (Math.abs(diff) < CENTER_THRESHOLD) return '중앙'
  return diff < 0 ? `왼쪽으로 ${Math.abs(diff).toFixed(1)}` : `오른쪽으로 ${diff.toFixed(1)}`
}

/**
 * "무게중심/쏠림 지수"(versus-stat-features-backlog 3번) — 각 팀 필드플레이어
 * 평균 x좌표를 0~100 막대 위 점 하나로 찍는다. `ZoneSideGauges`(왼쪽/중앙/
 * 오른쪽 15구역 집계)와 달리 이산 구역을 세지 않고 연속값을 그대로 쓴다 —
 * 그래서 "왼쪽 절반 우위와 오른쪽 절반 우위가 상쇄돼 안 보이는" 문제가
 * 구조적으로 없다(43~45번에서 짚었던 한계). 계산은 `computeTiltIndex`
 * (GK 제외 평균)를 그대로 쓴다.
 */
export function TiltGauge({ tilt, labelA, labelB }: TiltGaugeProps) {
  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-muted-foreground">무게중심(쏠림 지수)</p>
      <div className="relative h-2 w-full rounded-full bg-secondary">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/40" />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
          style={{ left: `${tilt.aAvgX}%`, background: colorA }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
          style={{ left: `${tilt.bAvgX}%`, background: colorB }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span style={{ color: colorA }}>
          {labelA} {tilt.aAvgX.toFixed(1)}({tiltLabel(tilt.aAvgX)})
        </span>
        <span style={{ color: colorB }}>
          {labelB} {tilt.bAvgX.toFixed(1)}({tiltLabel(tilt.bAvgX)})
        </span>
      </div>
      {/* ZoneSideGauges와 같은 이유(TO-DO 43)의 같은 안내 문구 — 왼쪽/오른쪽이
          공수 교대와 무관하게 항상 labelA 기준이라는 걸 안 적으면 헷갈린다. */}
      <p className="text-center text-[11px] text-muted-foreground">
        왼쪽·오른쪽은 {labelA} 공격 방향 기준(공수 교대와 무관) · 값은 평균 x좌표(0=왼쪽 터치라인, 100=오른쪽 터치라인)
      </p>
    </div>
  )
}
