import { forwardRef, useLayoutEffect, useRef, useState } from 'react'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OpponentNode } from '@/components/pitch/OpponentNode'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PlayerNode } from '@/components/pitch/PlayerNode'
import { PressingLine } from '@/components/pitch/PressingLine'
import { SHARE_CARD_COLORS } from '@/lib/theme'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }

/**
 * 텍스트가 boxHeight를 넘으면 "…"으로 자르는 대신 폰트 크기를 줄여서 전체가
 * 보이게 한다 — 사용자 리포트: "...으로 끝나면 차라리 없는 게 낫다". 실제
 * DOM 높이(scrollHeight)를 재는 방식이라 html-to-image가 캡처하는 시점에는
 * 이미 알맞은 크기로 그려진 상태다(레이아웃 이펙트 → 페인트 → 캡처 순서).
 */
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

interface ShareCardProps {
  analysis: Analysis
  phase: PhaseType
  ratio: '1:1' | '4:5'
}

/**
 * 고정 1080px 카드 노드 (2단계 §10, §12.5). 화면을 그대로 캡처하지 않고
 * 반응형 뷰포트와 분리된 이 노드를 별도로 캡처한다.
 *
 * 화면 밖 배치(`left:-9999px`)는 이 컴포넌트가 반환하는 바깥쪽 래퍼에만 둔다.
 * html-to-image에 넘기는 ref는 안쪽(카드 자체) 노드를 가리켜야 한다 — 캡처
 * 대상 노드 자신에 `position:absolute;left:-9999px`가 걸려 있으면, 노드를
 * 복제해 SVG로 직렬화하는 과정에서 그 오프셋이 그대로 다시 적용되어 콘텐츠가
 * 캡처 영역 밖으로 밀려나 빈 이미지가 나온다.
 */
export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard(
  { analysis, phase: phaseType, ratio },
  ref,
) {
  const layers = useAnalysisStore((s) => s.layers)
  const phase = analysis.phases[phaseType]
  const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
  const cardHeight = ratio === '1:1' ? 1080 : 1350
  const bench = analysis.players.filter((p) => !phase.positions.some((pos) => pos.playerId === p.id))
  // 국면별로 다른 텍스트를 그대로 보여준다 — 기본 국면은 종합 평가, 공격·수비는
  // 그 국면 자체의 코멘트(2026-09-02 사용자 결정). 원본 텍스트는 절대 줄이지
  // 않는다 — "png에만" 맞추는 건 아래 폰트 자동 축소가 담당한다.
  const rawBodyText = phaseType === 'base' ? analysis.summary : phase.comment
  // "…"으로 잘라내는 방식은 안 좋아 보인다는 피드백 — 글자 수로 잘라 말줄임표를
  // 붙이는 대신 박스 높이에 맞을 때까지 폰트 크기를 줄인다. 그래도 극단적으로
  // 긴 입력에 대비해 500자에서 한 번은 잘라낸다 — 지금 있는 국면 코멘트 중
  // 가장 긴 것도 이 한도 안에 들어온다.
  const bodyText = rawBodyText.length > 500 ? `${rawBodyText.slice(0, 499).trimEnd()}…` : rawBodyText
  const bodyBoxHeight = ratio === '1:1' ? (bench.length > 0 ? 170 : 210) : bench.length > 0 ? 220 : 270
  const { ref: bodyRef, fontSize: bodyFontSize } = useFitFontSize(bodyText, bodyBoxHeight, 32, 16)

  return (
    <div style={{ position: 'absolute', left: -9999, top: 0 }}>
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
            {PHASE_LABELS[phaseType]} 국면
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
          {/* width도 명시한다(2026-09-20, 실기기 검은 화면 리포트 확정 원인) —
              이 div는 width 없이 height:100%만 있었다. 부모(위 flex:1 div)는
              카드의 column flex 안에서 align-items 기본값(stretch)으로 폭이
              정해지지만, 이 자식은 row-flex 안의 아이템이라 폭이 "내용 기준
              shrink-to-fit"으로 계산된다 — 그런데 내용인 Pitch의 wrapper가
              또 w-full(부모의 100%)이라 서로가 서로를 기준 삼는 순환
              참조가 된다. 화면에 실제로 그려질 때는 대부분 브라우저가 무난한
              값으로 풀어주지만, 화면 밖(position:absolute;left:-9999px)
              오프스크린 렌더링에서 iOS WebKit이 이 순환을 0으로 풀어버리는
              걸 실기기 진단으로 직접 확인했다(getBoundingClientRect() width
              가 정확히 0, height는 정상) — PNG로 내보내면 피치 영역 전체가
              비어 카드의 어두운 배경(SHARE_CARD_COLORS.background)만
              보였던 "검은 화면" 리포트의 실제 원인이었다. width:100%로
              고정해 순환을 끊는다. */}
          <div style={{ height: '100%', width: '100%' }}>
            <Pitch>
              {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
              {layers.compactness && <CompactnessBox positions={phase.positions} />}
              {layers.pressingLine && (
                <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />
              )}
              {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
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
