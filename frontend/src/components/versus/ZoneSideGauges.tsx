import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { computeSideAdvantage, SIDE_KOREAN, type PitchSide } from '@/lib/versusAdvantage'
import type { ZoneOverload } from '@/types/analysis'

interface ZoneSideGaugesProps {
  zones: ZoneOverload[]
  labelA: string
  labelB: string
}

const SIDES: PitchSide[] = ['left', 'center', 'right']

/**
 * "왼쪽 중앙 오른쪽 3구역... 게이지바로 쉽게 보이게"(TO-DO 40) — 위의
 * `AdvantageBadge` 게이지 바는 15구역 전체를 하나로 뭉뚱그려서 "왼쪽은
 * 누가 우세한지"가 바로 안 보였다. 같은 게이지 바 스타일(색칠된 구간
 * 비율)을 왼쪽/중앙/오른쪽 3칸으로 나눠 나란히 보여준다 — 계산은
 * `computeSideAdvantage`가 기존 15구역 집계를 채널 기준으로 다시 묶은
 * 것뿐이라 새로운 판정 기준이 아니다.
 */
export function ZoneSideGauges({ zones, labelA, labelB }: ZoneSideGaugesProps) {
  if (zones.length === 0) return null
  const bySide = computeSideAdvantage(zones)
  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-3">
        {SIDES.map((side) => {
          const { aZones, bZones, neutralZoneCount, totalZones } = bySide[side]
          const aPct = totalZones === 0 ? 0 : (aZones.length / totalZones) * 100
          const bPct = totalZones === 0 ? 0 : (bZones.length / totalZones) * 100
          return (
            <div
              key={side}
              className="space-y-1 text-center"
              title={`${SIDE_KOREAN[side]}: ${labelA} ${aZones.length}구역 수적 우위 · ${labelB} ${bZones.length}구역 수적 우위 · 동률 ${neutralZoneCount}구역`}
            >
              <p className="text-sm font-medium text-muted-foreground">{SIDE_KOREAN[side]}</p>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div style={{ width: `${aPct}%`, background: colorA }} />
                <div style={{ width: `${neutralZoneCount === totalZones ? 100 : 100 - aPct - bPct}%` }} />
                <div style={{ width: `${bPct}%`, background: colorB }} />
              </div>
              <p className="text-xs text-muted-foreground">
                <span style={{ color: colorA }}>{aZones.length}</span> : <span style={{ color: colorB }}>{bZones.length}</span>
              </p>
            </div>
          )
        })}
      </div>
      {/* "왼쪽 오른쪽이 공격팀 기준이잖아... 헷갈려"(TO-DO 43) — 실제로는
          공수 교대와 무관하게 항상 labelA(전술 A) 기준이고, 가로 화면에서는
          채널(좌우) 축이 화면상 위아래로 그려진다(전진 방향=서드 축이
          화면 좌우). 둘 다 안 적어두면 화면을 직접 보고 "왼쪽"을 화면
          왼쪽이라고 오해하기 쉽다. */}
      <p className="text-center text-[11px] text-muted-foreground">
        왼쪽·오른쪽은 {labelA} 공격 방향 기준(공수 교대와 무관) · 가로 화면에서는 위아래로 표시됩니다
      </p>
    </div>
  )
}
