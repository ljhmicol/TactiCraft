import { toCanvas } from 'html-to-image'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AnimatedSharePngCard, GIF_CARD_SIZE } from '@/components/export/AnimatedSharePngCard'
import { scaledCardHeight, type CardRatio } from '@/lib/cardRatio'
import { buildPhaseDataGifFrames, type CapturedFrame } from '@/lib/exportGif'
import { encodeAnimation } from '@/lib/exportVideo'
import type { Analysis, LayerToggles, PhaseData } from '@/types/analysis'

interface ShareGifExportRunnerProps {
  analysis: Analysis
  phase: PhaseData
  title: string
  bodyText: string
  ratio: CardRatio
  layers: LayerToggles
  /** 기본 국면(체인징 포인트 미선택)은 항상 정지 상태여야 한다는 규칙
   * (PlayerNode.tsx 참조) — SharePage가 지금 보이는 시점 기준으로 계산해 넘긴다. */
  allowRunLoop: boolean
  onDone: (blob: Blob, extension: string) => void
  onError: (err: unknown) => void
}

/**
 * 공유 링크(`/share/:id`, `/s/:token`) 전용 GIF/동영상 캡처 루프 — 에디터의
 * `GifExportRunner`와 로직은 완전히 같지만(프레임마다 다시 그려 캡처),
 * "3국면 한번에"를 순환하지 않고 지금 화면에 보이는 시점(국면 탭 또는
 * 체인징 포인트) 하나만 내보낸다(2026-09-26, "GIF를 선택한 타임라인
 * 시점을 내보내고 싶던거였어") — `buildPhaseDataGifFrames`가 매치
 * 체인징 포인트도 `analysis.phases` 조회 없이 그대로 받을 수 있어 가능하다.
 * 인코딩은 `encodeAnimation`(가능하면 mp4/webm, 아니면 GIF로 대체)이 맡는다.
 */
export function ShareGifExportRunner({
  analysis,
  phase,
  title,
  bodyText,
  ratio,
  layers,
  allowRunLoop,
  onDone,
  onError,
}: ShareGifExportRunnerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frames = useMemo(() => buildPhaseDataGifFrames(phase, { allowRunLoop }), [phase, allowRunLoop])
  const capturedRef = useRef<CapturedFrame[]>([])
  const finishedRef = useRef(false)
  const [index, setIndex] = useState(0)
  const cardHeight = scaledCardHeight(ratio, GIF_CARD_SIZE)

  useEffect(() => {
    if (index >= frames.length) return
    let cancelled = false

    async function captureCurrentFrame() {
      await document.fonts.ready
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (cancelled || !ref.current) return
      try {
        const canvas = await toCanvas(ref.current, {
          pixelRatio: 1,
          cacheBust: true,
          skipFonts: true,
          width: GIF_CARD_SIZE,
          height: cardHeight,
        })
        if (cancelled) return
        capturedRef.current.push({ canvas, delayMs: frames[index].delayMs })
        setIndex((i) => i + 1)
      } catch (err) {
        if (!cancelled && !finishedRef.current) {
          finishedRef.current = true
          onError(err)
        }
      }
    }

    captureCurrentFrame()
    return () => {
      cancelled = true
    }
  }, [index, frames, onError, cardHeight])

  useEffect(() => {
    if (frames.length === 0 || index < frames.length || finishedRef.current) return
    finishedRef.current = true
    encodeAnimation(capturedRef.current)
      .then(({ blob, extension }) => onDone(blob, extension))
      .catch(onError)
  }, [index, frames.length, onDone, onError])

  const frame = frames[index]
  if (!frame) return null
  return (
    <AnimatedSharePngCard
      ref={ref}
      analysis={analysis}
      phase={phase}
      framePositions={frame.positions}
      title={title}
      bodyText={bodyText}
      layers={layers}
      ratio={ratio}
    />
  )
}
