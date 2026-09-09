import { forwardRef } from 'react'

import { Pitch } from '@/components/pitch/Pitch'
import { PrintOpponentNode } from '@/components/pitch/PrintOpponentNode'
import { SharePlayerNode } from '@/components/pitch/SharePlayerNode'
import type { Analysis } from '@/types/analysis'

export const THUMBNAIL_WIDTH = 160
// 68:105(가로:세로) 피치 비율에 맞춘 높이 — Pitch 컴포넌트의 portrait 비율과 동일.
export const THUMBNAIL_HEIGHT = Math.round((THUMBNAIL_WIDTH * 105) / 68)

/**
 * 저장 목록 미리보기용 썸네일(TO-DO 7번) — 항상 base 국면만 그린다(선택
 * 요구사항 그대로). `SharePngCard`처럼 store 의존이 없는 읽기 전용 노드를
 * 재사용한다(runAnnotations를 안 넘겨 정지 상태로 그림 — SharePlayerNode의
 * 기존 규칙과 동일, base 국면은 원래 안 움직인다). 카드 제목·텍스트 없이
 * 피치만 작게 캡처한다.
 */
export const ThumbnailCard = forwardRef<HTMLDivElement, { analysis: Analysis }>(function ThumbnailCard(
  { analysis },
  ref,
) {
  const phase = analysis.phases.base

  return (
    <div style={{ position: 'absolute', left: -9999, top: 0 }}>
      <div ref={ref} style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}>
        <Pitch>
          {phase.opponentPositions?.map((pos, i) => <PrintOpponentNode key={i} position={pos} />)}
          {analysis.players.map((player, index) => {
            const pos = phase.positions.find((p) => p.playerId === player.id)
            if (!pos) return null
            return (
              <SharePlayerNode key={player.id} player={player} position={pos} formation={analysis.formation} index={index} />
            )
          })}
        </Pitch>
      </div>
    </div>
  )
})
