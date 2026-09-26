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
import { SHARE_CARD_COLORS } from '@/lib/theme'
import type { Analysis, LayerToggles, PhaseData, PlayerPosition } from '@/types/analysis'

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
  phase: PhaseData
  /** 이 프레임의 선수 좌표 — run 화살표 왕복 애니메이션 중 하나일 수 있다.
   * 코멘트·화살표·상대팀·압박 라인처럼 보간되지 않는 나머지는 `phase`를
   * 그대로 쓴다(exportGif.ts의 buildPhaseDataGifFrames 참조). */
  framePositions: PlayerPosition[]
  /** "기본 국면" / "공격 국면" / 체인징 포인트 라벨 등 — 호출부(SharePage)가 이미 결정해서 넘긴다. */
  title: string
  bodyText: string
  layers: LayerToggles
  ratio: CardRatio
}

/**
 * 공유 링크(`/share/:id`, `/s/:token`) 전용 GIF 프레임 카드. `SharePngCard`와
 * 모양·props가 거의 같지만(둘 다 `useAnalysisStore`를 안 읽는다 — 이 화면이
 * 보여주는 분석은 "지금 편집 중인 분석"과 무관할 수 있어서다) 정지된
 * `phase.positions` 대신 매 프레임 다시 그려지는 `framePositions`를 쓴다.
 * `SharePlayerNode`(라이브 반복 루프) 대신 `PrintPlayerNode`(순수 정지
 * 렌더)를 쓰는 이유도 같다 — 애니메이션은 이미 `buildPhaseDataGifFrames`가
 * 프레임별 좌표로 구워뒀으므로, 카드 자체는 그 순간을 그대로 캡처하기만
 * 하면 된다(GifExportRunner/AnimatedShareCard와 같은 이유, 2026-09-26).
 */
export const AnimatedSharePngCard = forwardRef<HTMLDivElement, AnimatedSharePngCardProps>(
  function AnimatedSharePngCard({ analysis, phase, framePositions, title, bodyText: rawBodyText, layers, ratio }, ref) {
    const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
    const bench = analysis.players.filter((p) => !phase.positions.some((pos) => pos.playerId === p.id))
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
            <div style={{ fontSize: Math.round(28 * SCALE), color: SHARE_CARD_COLORS.subtitle, marginTop: Math.round(8 * SCALE) }}>
              {analysis.match.matchDate}
              {analysis.match.competition ? ` · ${analysis.match.competition}` : ''}
            </div>
            <div
              style={{
                fontSize: Math.round(32 * SCALE),
                fontWeight: 700,
                color: SHARE_CARD_COLORS.phaseLabel,
                marginTop: Math.round(12 * SCALE),
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: pitchMinHeight, display: 'flex', justifyContent: 'center' }}>
            <div style={{ height: '100%', width: 'auto', aspectRatio: '68 / 105', flex: 'none' }}>
              <Pitch>
                {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
                {layers.compactness && <CompactnessBox positions={phase.positions} />}
                {layers.pressingLine && <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />}
                {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
                <AnnotationLayer annotations={phase.annotations} animated={false} />
                {phase.opponentPositions?.map((pos, i) => <PrintOpponentNode key={i} position={pos} />)}
                {analysis.players.map((player, index) => {
                  const pos = framePositions.find((p) => p.playerId === player.id)
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
