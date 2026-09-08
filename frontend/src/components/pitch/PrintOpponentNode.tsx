import { circularRadius } from '@/lib/pitchMarkings'
import { PLAYER_COLORS } from '@/lib/theme'
import type { Point } from '@/types/analysis'

const OPP_RADIUS = circularRadius(PLAYER_COLORS.opponent.radius)

/**
 * `PrintPlayerNode`의 상대팀 버전 — 읽기 전용 렌더(공유 링크·PNG/GIF 캡처)
 * 전용. `OpponentNode`는 드래그를 위해 `useAnalysisStore.moveOpponent`를
 * 직접 참조하는데, 여기서는 화면에 떠 있는(활성) 분석과 무관한 데이터를
 * 그릴 수 있어야 해서 그 의존성이 없는 순수 표시용 컴포넌트로 분리했다.
 */
export function PrintOpponentNode({ position }: { position: Point }) {
  return (
    <ellipse
      cx={position.x}
      cy={position.y}
      rx={OPP_RADIUS.rx}
      ry={OPP_RADIUS.ry}
      fill={PLAYER_COLORS.opponent.fill}
      fillOpacity={PLAYER_COLORS.opponent.fillOpacity}
    />
  )
}
