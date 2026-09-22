import { forwardRef, useLayoutEffect, useRef, useState } from 'react'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OpponentNode } from '@/components/pitch/OpponentNode'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { PrintPlayerNode } from '@/components/pitch/PrintPlayerNode'
import type { GifFrameSpec } from '@/lib/exportGif'
import { SHARE_CARD_COLORS } from '@/lib/theme'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }
// GIF는 프레임을 수십 장 인코딩하므로 PNG(1080)보다 작게 잡아 용량·속도를 아낀다.
// GifExportRunner의 toCanvas 캡처 크기와 반드시 같아야 해서 export한다.
export const GIF_CARD_SIZE = 720
// ShareCard(PNG, 1080px 기준)의 치수를 그대로 이 비율로 축소한다 — pitch의
// minHeight(380)를 축소 없이 그대로 썼더니 720px 카드에서 피치가 카드의
// 절반 넘게 차지해 코멘트 박스가 짓눌려 텍스트가 잘렸다(2026-09-08 사용자
// 리포트: "코멘트도 잘리고"). ShareCard와 같은 비율을 유지해야 코멘트가
// PNG만큼 여유 있게 보인다.
const SCALE = GIF_CARD_SIZE / 1080

/** ShareCard의 useFitFontSize와 같은 로직 — 컴포넌트 파일 간 공유하지 않고
 * 각자 두는 게 이 프로젝트 관례다(다른 국면 라벨 상수들도 파일마다 따로 둠). */
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

interface AnimatedShareCardProps {
  analysis: Analysis
  frame: GifFrameSpec
}

/**
 * GIF 내보내기(TO-DO 6) 전용 프레임 카드. ShareCard(PNG)와 같은 레이아웃을
 * 쓰지만, 국면 하나가 아니라 "이 프레임의 상태"(frame)를 그린다 — 선수
 * 위치는 frame.positions(국면 사이 보간된 좌표일 수 있다)를 쓰고, 그 외
 * (코멘트·화살표·상대팀·압박 라인·오버로드처럼 보간할 수 없는 것들)는
 * frame.phase가 가리키는 국면의 실제 데이터를 그대로 스냅해서 쓴다 — 편집
 * 화면에서 국면 탭을 누르면 코멘트는 즉시 바뀌고 선수 위치만 뒤따라
 * 움직이는 것과 같은 규칙이다(lib/exportGif.ts 참조).
 *
 * PlayerNode 대신 PrintPlayerNode를 쓴다 — Framer Motion 애니메이션이나
 * 활성 분석 스토어 결합 없이, 주어진 좌표를 그 순간 그대로 정지 이미지로
 * 찍어야 프레임마다 캡처가 흔들리지 않는다.
 */
export const AnimatedShareCard = forwardRef<HTMLDivElement, AnimatedShareCardProps>(function AnimatedShareCard(
  { analysis, frame },
  ref,
) {
  const layers = useAnalysisStore((s) => s.layers)
  const phaseData = analysis.phases[frame.phase]
  const hasOpponent = Boolean(phaseData.opponentPositions && phaseData.opponentPositions.length > 0)
  const bench = analysis.players.filter((p) => !phaseData.positions.some((pos) => pos.playerId === p.id))
  const rawBodyText = frame.phase === 'base' ? analysis.summary : phaseData.comment
  const bodyText = rawBodyText.length > 500 ? `${rawBodyText.slice(0, 499).trimEnd()}…` : rawBodyText
  // ShareCard(1:1)의 170/210을 그대로 SCALE만큼 축소 — 임의로 다시 정하지 않는다.
  const bodyBoxHeight = Math.round((bench.length > 0 ? 170 : 210) * SCALE)
  const { ref: bodyRef, fontSize: bodyFontSize } = useFitFontSize(
    bodyText,
    bodyBoxHeight,
    Math.round(32 * SCALE),
    Math.round(16 * SCALE),
  )

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
          width: GIF_CARD_SIZE,
          height: GIF_CARD_SIZE,
          background: SHARE_CARD_COLORS.background,
          padding: Math.round(64 * SCALE),
          display: 'flex',
          flexDirection: 'column',
          gap: Math.round(24 * SCALE),
          // Hallmark 감사(2026-09-11) — 시스템 기본 폰트 대신 앱 전역과 같은
          // 페어링. 제목만 display(모노) 폰트, 나머지는 이 wrapper의 본문 폰트.
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
              // 한글 포함 진짜 monospace(index.html 주석 참조) — 라틴 전용 폰트 +
              // 한글 폴백 조합은 단어 사이 스페이스 폭이 어긋나 보였다.
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

        <div style={{ flex: 1, minHeight: Math.round(380 * SCALE), display: 'flex', justifyContent: 'center' }}>
          <div style={{ height: '100%' }}>
            <Pitch>
              {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
              {layers.compactness && <CompactnessBox positions={phaseData.positions} />}
              {layers.pressingLine && (
                <PressingLine positions={phaseData.positions} pressingLineY={phaseData.pressingLineY} />
              )}
              {layers.overload && hasOpponent && <OverloadLayer phase={phaseData} />}
              <AnnotationLayer annotations={phaseData.annotations} animated={false} />
              {phaseData.opponentPositions?.map((pos, i) => <OpponentNode key={i} slot={i} position={pos} />)}
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
})
