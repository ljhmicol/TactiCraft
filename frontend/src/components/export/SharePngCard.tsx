import { forwardRef, useLayoutEffect, useRef, useState } from 'react'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { PrintOpponentNode } from '@/components/pitch/PrintOpponentNode'
import { SharePlayerNode } from '@/components/pitch/SharePlayerNode'
import { SHARE_CARD_COLORS } from '@/lib/theme'
import type { Analysis, Annotation, LayerToggles, PhaseData } from '@/types/analysis'

/** `ShareCard`(에디터 PNG 내보내기)와 같은 폰트 자동 축소 로직 — 그대로 복사. */
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

interface SharePngCardProps {
  analysis: Analysis
  phase: PhaseData
  /** "기본 국면" / "공격 국면" / 체인징 포인트 라벨 등 — 호출부(SharePage)가 이미 결정해서 넘긴다. */
  title: string
  bodyText: string
  runAnnotations?: Annotation[]
  layers: LayerToggles
  ratio: '1:1' | '4:5'
}

/**
 * 공유 링크(`/share/:id`) 전용 PNG 카드(TO-DO 26번). 에디터의 `ShareCard`와
 * 모양은 같지만 `useAnalysisStore`를 전혀 읽지 않는다 — 레이어 토글은
 * SharePage의 로컬 state를 props로 받고, 선수는 드래그 가능한 `PlayerNode`/
 * `OpponentNode` 대신 읽기 전용 `SharePlayerNode`/`PrintOpponentNode`로
 * 그린다(SharePage 자체가 그 이유로 그 컴포넌트들을 쓰는 것과 동일 — 이
 * 화면이 보여주는 분석은 "지금 편집 중인 분석"이 아니다).
 */
export const SharePngCard = forwardRef<HTMLDivElement, SharePngCardProps>(function SharePngCard(
  { analysis, phase, title, bodyText: rawBodyText, runAnnotations, layers, ratio },
  ref,
) {
  const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
  const cardHeight = ratio === '1:1' ? 1080 : 1350
  const bench = analysis.players.filter((p) => !phase.positions.some((pos) => pos.playerId === p.id))
  const bodyText = rawBodyText.length > 500 ? `${rawBodyText.slice(0, 499).trimEnd()}…` : rawBodyText
  const bodyBoxHeight = ratio === '1:1' ? (bench.length > 0 ? 170 : 210) : bench.length > 0 ? 220 : 270
  const { ref: bodyRef, fontSize: bodyFontSize } = useFitFontSize(bodyText, bodyBoxHeight, 32, 16)

  return (
    // aria-hidden+inert(개선 로드맵 §6.4, 2026-09-22) — ShareCard.tsx 주석 참조.
    // inert는 JSX prop이 아니라 DOM 프로퍼티 직접 대입으로 켠다(react-dom
    // 18.3이 JSX prop으로는 렌더링하지 않음, ShareCard.tsx 참조).
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
          width: 1080,
          height: cardHeight,
          background: SHARE_CARD_COLORS.background,
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          // Hallmark 감사(2026-09-11) — 시스템 기본 폰트 대신 앱 전역과 같은
          // 페어링. 제목만 display(모노) 폰트, 나머지는 이 wrapper의 본문 폰트.
          fontFamily: '"IBM Plex Sans KR", ui-sans-serif, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: SHARE_CARD_COLORS.title,
              // 한글 포함 진짜 monospace(index.html 주석 참조) — 라틴 전용 폰트 +
              // 한글 폴백 조합은 단어 사이 스페이스 폭이 어긋나 보였다.
              fontFamily: '"Nanum Gothic Coding", monospace',
            }}
          >
            {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}`}
          </div>
          <div style={{ fontSize: 28, color: SHARE_CARD_COLORS.subtitle, marginTop: 8 }}>
            {analysis.match.matchDate}
            {analysis.match.competition ? ` · ${analysis.match.competition}` : ''}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: SHARE_CARD_COLORS.phaseLabel, marginTop: 12 }}>
            {title}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: ratio === '1:1' ? 380 : 460,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* ShareCard.tsx와 같은 이유(2026-09-20) — width:100%로 검은 화면은
              고쳤지만 그러면 Pitch의 aspect-ratio가 무시돼 찌부러진다.
              wrapper 자체에 세로 피치 비율(68:105)을 aspect-ratio로 주고
              width는 auto(height에서 계산), flex:'none'으로 눌리지 않게 한다. */}
          <div style={{ height: '100%', width: 'auto', aspectRatio: '68 / 105', flex: 'none' }}>
            <Pitch>
              {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
              {layers.compactness && <CompactnessBox positions={phase.positions} />}
              {layers.pressingLine && (
                <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />
              )}
              {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
              <AnnotationLayer annotations={phase.annotations} />
              {phase.opponentPositions?.map((pos, i) => (
                <PrintOpponentNode key={i} position={pos} />
              ))}
              {analysis.players.map((player, index) => {
                const pos = phase.positions.find((p) => p.playerId === player.id)
                if (!pos) return null
                return (
                  <SharePlayerNode
                    key={player.id}
                    player={player}
                    position={pos}
                    formation={analysis.formation}
                    index={index}
                    runAnnotations={runAnnotations}
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
              fontSize: 22,
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
})
