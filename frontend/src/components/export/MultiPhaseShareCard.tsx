import { forwardRef } from 'react'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { OpponentNode } from '@/components/pitch/OpponentNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PlayerNode } from '@/components/pitch/PlayerNode'
import { PressingLine } from '@/components/pitch/PressingLine'
import { SHARE_CARD_COLORS } from '@/lib/theme'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }
const PHASE_ORDER: PhaseType[] = ['base', 'attack', 'defense']

/** 세로 3단 카드에서 피치 하나에 배정하는 높이(px) — 폭은 68:105 비율로 자동 계산된다. */
export const MULTI_PHASE_PITCH_HEIGHT = 420
export const MULTI_PHASE_CARD_WIDTH = 1080
export const MULTI_PHASE_CARD_HEIGHT = 2000

interface MultiPhaseShareCardProps {
  analysis: Analysis
}

/**
 * 기본·공격·수비 3국면을 세로로 이어붙인 카드(TO-DO, 2026-09-23) — 기존
 * ShareCard는 국면 하나만 캡처한다. 국면 3개를 한눈에 비교해서 보여달라는
 * 요청으로 신설했다.
 *
 * ShareCard와 달리 비율 선택(1:1/4:5)이 없다 — 세로로 3단을 쌓으면 두 비율
 * 다 맞지 않아서, 이 카드는 자체 고정 크기(1080×2000)를 쓴다.
 *
 * exportImage.ts의 compositeCanvas는 카드 노드 안의 모든 <svg>를 순회해
 * 각각 rasterizeSvg로 따로 그려 합성하도록 이미 배열(`pitches: PitchInfo[]`)
 * 로 설계돼 있다 — Pitch를 3번 렌더링해도 캡처 파이프라인을 손댈 필요가
 * 없다(exportMultiPhaseCard가 이 컴포넌트의 root ref를 그대로 compositeCanvas에
 * 넘긴다).
 *
 * 코멘트는 국면당 한 줄로 자른다(2026-09-23 사용자 결정 — "간략히 한 줄씩") —
 * ShareCard의 useFitFontSize(폰트 축소로 전체를 다 보여주는 방식) 대신 CSS
 * ellipsis로 단순하게 자른다.
 */
export const MultiPhaseShareCard = forwardRef<HTMLDivElement, MultiPhaseShareCardProps>(
  function MultiPhaseShareCard({ analysis }, ref) {
    const layers = useAnalysisStore((s) => s.layers)

    return (
      <div
        style={{ position: 'absolute', left: -9999, top: 0 }}
        aria-hidden="true"
        ref={(el) => {
          if (el) el.inert = true
        }}
      >
        <div
          ref={ref}
          style={{
            width: MULTI_PHASE_CARD_WIDTH,
            height: MULTI_PHASE_CARD_HEIGHT,
            background: SHARE_CARD_COLORS.background,
            padding: 64,
            display: 'flex',
            flexDirection: 'column',
            gap: 36,
            fontFamily: '"IBM Plex Sans KR", ui-sans-serif, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: SHARE_CARD_COLORS.title,
                fontFamily: '"Nanum Gothic Coding", monospace',
              }}
            >
              {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}`}
            </div>
            <div style={{ fontSize: 26, color: SHARE_CARD_COLORS.subtitle, marginTop: 8 }}>
              {analysis.match.matchDate}
              {analysis.match.competition ? ` · ${analysis.match.competition}` : ''}
            </div>
          </div>

          {PHASE_ORDER.map((phaseType) => {
            const phase = analysis.phases[phaseType]
            const bodyText = phaseType === 'base' ? analysis.summary : phase.comment

            return (
              <div key={phaseType} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: SHARE_CARD_COLORS.phaseLabel }}>
                  {PHASE_LABELS[phaseType]} 국면
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div
                    style={{
                      height: MULTI_PHASE_PITCH_HEIGHT,
                      width: 'auto',
                      aspectRatio: '68 / 105',
                      flex: 'none',
                    }}
                  >
                    <Pitch>
                      {layers.pressingLine && (
                        <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />
                      )}
                      <AnnotationLayer annotations={phase.annotations} />
                      {phase.opponentPositions?.map((pos, i) => (
                        <OpponentNode key={i} slot={i} position={pos} />
                      ))}
                      {analysis.players.map((player) => {
                        const pos = phase.positions.find((p) => p.playerId === player.id)
                        if (!pos) return null
                        return <PlayerNode key={player.id} player={player} position={pos} />
                      })}
                    </Pitch>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 22,
                    color: SHARE_CARD_COLORS.body,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {bodyText}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  },
)
