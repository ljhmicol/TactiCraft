import { forwardRef, useLayoutEffect, useRef, useState } from 'react'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { PrintOpponentNode } from '@/components/pitch/PrintOpponentNode'
import { PrintPlayerNode } from '@/components/pitch/PrintPlayerNode'
import { BODY_BOX_HEIGHT_BY_RATIO, PITCH_MIN_HEIGHT_BY_RATIO, scaledCardHeight, type CardRatio } from '@/lib/cardRatio'
import type { GifFrameSpec } from '@/lib/exportGif'
import { SHARE_CARD_COLORS } from '@/lib/theme'
import type { Analysis, LayerToggles, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }
export const GIF_CARD_SIZE = 720
const SCALE = GIF_CARD_SIZE / 1080

function useFitFontSize(text: string, boxHeight: number, maxSize: number, minSize: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(maxSize)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let size = maxSize
    el.style.fontSize = `${size}px`
    while (el.scrollHeight > boxHeight && size > minSize) {
      size -= 1
      el.style.fontSize = `${size}px`
    }
    setFontSize(size)
  }, [text, boxHeight, maxSize, minSize])

  return { ref, fontSize }
}

interface AnimatedSharePngCardProps {
  analysis: Analysis
  frame: GifFrameSpec
  layers: LayerToggles
  ratio: CardRatio
}

/**
 * 공유 링크(`/share/:id`, `/s/:token`) 전용 GIF 프레임 카드. 에디터의
 * `AnimatedShareCard`와 모양·역할은 같지만(GifExportRunner가 프레임마다
 * 다시 그려 캡처) `useAnalysisStore`를 전혀 읽지 않는다 — `SharePngCard`가
 * `OpponentNode` 대신 `PrintOpponentNode`를 쓰는 것과 똑같은 이유다:
 * `OpponentNode`는 드래그를 위해 스토어의 `moveOpponent`를 직접 참조하는데,
 * 이 화면이 보여주는 분석은 "지금 편집 중인 분석"과 무관할 수 있어(다른
 * 사람이 링크로 바로 들어옴) 스토어 상태(레이어 토글 포함)를 그대로 읽으면
 * 이 페이지의 로컬 레이어 토글과 어긋난다. 그래서 레이어도 `SharePngCard`와
 * 같이 props로 받는다.
 */
export const AnimatedSharePngCard = forwardRef<HTMLDivElement, AnimatedSharePngCardProps>(
  function AnimatedSharePngCard({ analysis, frame, layers, ratio }, ref) {
    const phaseData = analysis.phases[frame.phase]
    const hasOpponent = Boolean(phaseData.opponentPositions && phaseData.opponentPositions.length > 0)
    const bench = analysis.players.filter((p) => !phaseData.positions.some((pos) => pos.playerId === p.id))
    const rawBodyText = frame.phase === 'base' ? analysis.summary : phaseData.comment
    const bodyText = rawBodyText.length > 500 ? `${rawBodyText.slice(0, 499).trimEnd()}…` : rawBodyText
    const cardHeight = scaledCardHeight(ratio, GIF_CARD_SIZE)
    const pitchMinHeight = Math.round(PITCH_MIN_HEIGHT_BY_RATIO[ratio] * SCALE)
    const bodyBoxHeight = Math.round(BODY_BOX_HEIGHT_BY_RATIO[ratio][bench.length > 0 ? 'withBench' : 'noBench'] * SCALE)
    const { ref: bodyRef, fontSize: bodyFontSize } = useFitFontSize(
      bodyText,
      bodyBoxHeight,
      Math.round(32 * SCALE),
      Math.round(16 * SCALE),
    )

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
            width: GIF_CARD_SIZE,
            height: cardHeight,
            background: SHARE_CARD_COLORS.background,
            padding: Math.round(64 * SCALE),
            display: 'flex',
            flexDirection: 'column',
            gap: Math.round(24 * SCALE),
            fontFamily: '"IBM Plex Sans KR", ui-sans-serif, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div
              style={{
                fontSize: Math.round(48 * SCALE),
                fontWeight: 700,
                color: SHARE_CARD_COLORS.title,
                fontFamily: '"Nanum Gothic Coding", monospace',
              }}
            >
              {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}`}
            </div>
            <div
              style={{
                fontSize: Math.round(32 * SCALE),
                fontWeight: 700,
                color: SHARE_CARD_COLORS.phaseLabel,
                marginTop: Math.round(12 * SCALE),
              }}
            >
              {PHASE_LABELS[frame.phase]} 국면
            </div>
          </div>

          <div style={{ flex: 1, minHeight: pitchMinHeight, display: 'flex', justifyContent: 'center' }}>
            <div style={{ height: '100%', width: 'auto', aspectRatio: '68 / 105', flex: 'none' }}>
              <Pitch>
                {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
                {layers.compactness && <CompactnessBox positions={phaseData.positions} />}
                {layers.pressingLine && (
                  <PressingLine positions={phaseData.positions} pressingLineY={phaseData.pressingLineY} />
                )}
                {layers.overload && hasOpponent && <OverloadLayer phase={phaseData} />}
                <AnnotationLayer annotations={phaseData.annotations} animated={false} />
                {phaseData.opponentPositions?.map((pos, i) => <PrintOpponentNode key={i} position={pos} />)}
                {analysis.players.map((player, index) => {
                  const pos = frame.positions.find((p) => p.playerId === player.id)
                  if (!pos) return null
                  return (
                    <PrintPlayerNode
                      key={player.id}
                      player={player}
                      position={pos}
                      formation={analysis.formation}
                      index={index}
                    />
                  )
                })}
              </Pitch>
            </div>
          </div>

          <div
            ref={bodyRef}
            style={{
              fontSize: bodyFontSize,
              color: SHARE_CARD_COLORS.body,
              lineHeight: 1.5,
              height: bodyBoxHeight,
              overflow: 'hidden',
            }}
          >
            {bodyText}
          </div>

          {bench.length > 0 && (
            <div
              style={{
                fontSize: Math.round(22 * SCALE),
                color: SHARE_CARD_COLORS.subtitle,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              벤치 {bench.map((p) => `${p.number} ${p.name}`.trim()).join(' · ')}
            </div>
          )}
        </div>
      </div>
    )
  },
)
