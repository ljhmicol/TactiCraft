import { useId } from 'react'

import { transposeRect } from '@/lib/coords'
import { CHANNEL_BOUNDS, THIRD_BOUNDS, zoneBottleneckLevel } from '@/lib/zones'
import type { ZoneOverload } from '@/types/analysis'

interface MatchupBottleneckLayerProps {
  zones: ZoneOverload[]
  orientation?: 'portrait' | 'landscape'
}

// A(파랑)·B(빨강)·하이라이트(amber, TO-DO 50-3)와 안 겹치는 중립색 — 병목은
// "누가 우세한가"가 아니라 "양쪽 다 몰려 있는가"라서 팀 색을 쓰면 안 된다.
const BOTTLENECK_COLOR = '#A78BFA'

/**
 * "국면별 텐션 시각화"(2차 4개 개선안 3번) — "어느 팀이 유리한지가 아니라,
 * 두 포메이션이 겹치면서 가장 밀집되는 압박 구역(Bottleneck)이 어디인지
 * 빗금이나 반투명한 색상으로." `MatchupOverloadLayer`(누가 우세한지, 팀
 * 색 타일)와는 다른 질문에 답하는 별도 레이어다 — `zoneBottleneckLevel`이
 * own/opp 둘 다 있는(포메이션이 실제로 겹치는) 구역만 골라 총원으로
 * weak/strong을 매긴다(lib/zones.ts 참조).
 *
 * 반투명 색상 대신 빗금(hatch pattern)을 썼다 — 이미 같은 자리에
 * `MatchupOverloadLayer`의 팀 색 타일이 깔려 있어서, 병목까지 단색
 * 반투명 사각형으로 덧칠하면 색이 섞여 세 번째 색으로 보이거나 팀 색을
 * 가려버린다. 빗금은 밑에 깔린 색 타일 위에 "질감"으로 얹혀서 색상표를
 * 늘리지 않고도 구분된다(2단계 §12.3 색각 이상 대응과 같은 이유 —
 * 색만으로 구분하지 않는다).
 *
 * 기본 Off 토글이다(VersusPage 참조) — 최근 "숫자 표시를 줄여서 덜
 * 복잡하게"(TO-DO 50-2) 만든 방향과 정반대로 정보를 하나 더 얹는 레이어라,
 * 항상 켜져 있으면 그 작업을 무의미하게 만든다. 보고 싶을 때만 켠다.
 *
 * 패턴 id는 useId()로 고유하게 만든다 — 화면(MatchupView)과 PNG 카드
 * (VersusShareCard)가 동시에 DOM에 떠 있는 경우(카드는 화면 밖에 숨겨져
 * 있을 뿐 항상 렌더링됨)에도 <pattern id="...">가 중복되지 않게 한다.
 */
export function MatchupBottleneckLayer({ zones, orientation = 'portrait' }: MatchupBottleneckLayerProps) {
  const landscape = orientation === 'landscape'
  const patternId = `bottleneck-hatch-${useId()}`

  const bottleneckZones = zones
    .map((z) => ({ zone: z, level: zoneBottleneckLevel(z.own, z.opp) }))
    .filter(({ level }) => level !== 'none')

  if (bottleneckZones.length === 0) return null

  return (
    <g>
      <defs>
        <pattern id={patternId} patternUnits="userSpaceOnUse" width={3} height={3} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={3} stroke={BOTTLENECK_COLOR} strokeWidth={0.7} />
        </pattern>
      </defs>
      {bottleneckZones.map(({ zone, level }) => {
        const [x0, x1] = CHANNEL_BOUNDS[zone.channel]
        const [y0, y1] = THIRD_BOUNDS[zone.third]
        const rect = landscape ? transposeRect(x0, x1, y0, y1) : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
        return (
          <rect
            key={`${zone.channel}-${zone.third}`}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={`url(#${patternId})`}
            opacity={level === 'strong' ? 0.9 : 0.45}
          />
        )
      })}
    </g>
  )
}
