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
 *
 * 2026-09-21 — 사용자 리포트: "핸드폰에서는 코멘트가 끝까지 다 보이는데
 * 컴퓨터에서는 짤려". 원인: 이 훅의 useLayoutEffect는 마운트 시점(웹폰트
 * "IBM Plex Sans KR" 다운로드가 아직 안 끝났을 수 있는 시점)에 딱 한 번만
 * 크기를 재고, 이후 실제 웹폰트가 로드돼도 재계산 트리거가 없었다(의존성
 * 배열에 폰트 로딩 여부가 없음) — 그 사이 el.scrollHeight는 그 순간의
 * 폴백 폰트 기준으로 측정된다. exportImage.ts의 캡처 함수는 별도로
 * document.fonts.ready를 기다린 뒤 캡처하므로, 실제 렌더링에 쓰이는 폰트는
 * 측정 시점의 폴백 폰트와 다를 수 있다 — 이 폴백 폰트가 PC와 모바일 OS마다
 * 달라서(시스템 기본 산세리프가 다름) 글자 폭이 달라지고, 어느 한쪽에서만
 * 박스를 넘쳐 overflow:hidden에 잘려 보였다. document.fonts.ready가 끝난
 * 뒤 한 번 더(항상 maxSize부터 다시) 재계산해서 실제 렌더링 폰트 기준으로
 * 맞춘다.
 */
function useFitFontSize(text: string, boxHeight: number, maxSize: number, minSize: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(maxSize)

  const fit = () => {
    const el = ref.current
    if (!el) return
    let size = maxSize
    el.style.fontSize = `${size}px`
    while (el.scrollHeight > boxHeight && size > minSize) {
      size -= 1
      el.style.fontSize = `${size}px`
    }
    setFontSize(size)
  }

  useLayoutEffect(fit, [text, boxHeight, maxSize, minSize])

  useLayoutEffect(() => {
    let cancelled = false
    document.fonts.ready.then(() => {
      if (!cancelled) fit()
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // aria-hidden+inert(개선 로드맵 §6.4, 2026-09-22) — 이 카드는 PNG 캡처용
    // 화면 밖(-9999px) 렌더 노드일 뿐인데, 안의 PlayerNode/OpponentNode가
    // 실제 상호작용 컴포넌트라 키보드 포커스(tabIndex)까지 그대로 따라온다.
    // inert 없이는 Tab으로 여기까지 들어와 화면에 안 보이는 복제 노드를
    // 조작하게 된다 — 실제 선수와 같은 store를 쓰므로 안 보이는 채로
    // 진짜 위치가 바뀌는 혼란까지 생긴다. inert는 JSX prop으로 넘기면 이 React
    // 버전(react-dom 18.3)이 속성을 렌더링하지 않아(실측 확인) DOM 프로퍼티로
    // 직접 대입한다.
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
          {/* 2026-09-20, 실기기 검은 화면 리포트 확정 원인 — 이 div는 원래
              width 없이 height:100%만 있었다. 부모(위 flex:1 div)는 카드의
              column flex 안에서 align-items 기본값(stretch)으로 폭이
              정해지지만, 이 자식은 row-flex 안의 아이템이라 폭이 "내용 기준
              shrink-to-fit"으로 계산된다 — 그런데 내용인 Pitch의 wrapper가
              또 w-full(부모의 100%)이라 서로가 서로를 기준 삼는 순환
              참조가 된다. 화면에 실제로 그려질 때는 대부분 브라우저가
              (w-full의 100%가 미확정 부모 기준으로는 풀리지 않아 사실상
              auto로 취급되고, 그 결과 Pitch 자신의 aspect-[68/105]가
              대신 개입하는) 우연한 경로로 무난하게 보였지만, 화면 밖
              (position:absolute;left:-9999px) 오프스크린 렌더링에서 iOS
              WebKit은 이 순환을 0으로 풀어버리는 걸 실기기 진단으로 직접
              확인했다(getBoundingClientRect() width가 정확히 0, height는
              정상) — PNG로 내보내면 피치 영역 전체가 비어 카드의 어두운
              배경(SHARE_CARD_COLORS.background)만 보였던 "검은 화면"
              리포트의 실제 원인이었다.

              1차 수정으로 width:100%를 강제했더니 검은 화면은 사라졌지만
              이번엔 Pitch 자신의 h-full+w-full이 둘 다 "정해진 값"이 되며
              aspect-[68/105]가 완전히 무시돼 피치가 컨테이너 박스 그대로
              찌부러져 나왔다(advisor 리뷰로 확정) — width:100% 대신 이
              wrapper 자체에 세로 방향 피치 비율(68:105)을 aspect-ratio로
              직접 주고 width는 auto로 비운다(그래야 aspect-ratio가 height
              에서 width를 계산한다), flex:'none'으로 flex-shrink에 의해
              눌리는 것도 막는다 — shrink-to-fit/컨텐츠 기반 계산에 전혀
              기대지 않으므로 엔진마다 다르게 풀릴 여지가 없다. 부모의
              justifyContent:'center'가 다시 실제로 가운데 정렬을 담당한다. */}
          <div style={{ height: '100%', width: 'auto', aspectRatio: '68 / 105', flex: 'none' }}>
            <Pitch>
              {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
              {layers.compactness && <CompactnessBox positions={phase.positions} />}
              {layers.pressingLine && (
                <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />
              )}
              {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
              {/* animated=false(2026-09-24, "화살표 중간에서 멈춘거로 나와") —
                  이 카드는 오프스크린에 오래 떠 있다가 캡처될 때가 많아서
                  패스 공의 1회성 세그먼트 애니메이션이 우연히 끝나 있는
                  경우가 잦았지만, 보장된 동작은 아니었다. 정적 캡처는
                  애니메이션 진행 여부와 무관하게 항상 완성된 화살표만
                  보여야 하므로 공 자체를 그리지 않는다(animated=false면
                  화살표 선·화살촉은 그대로 그려지고 패스 공만 생략된다). */}
              <AnnotationLayer annotations={phase.annotations} animated={false} />
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
