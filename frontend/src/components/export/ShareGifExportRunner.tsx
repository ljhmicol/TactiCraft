import { toCanvas } from 'html-to-image'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AnimatedSharePngCard, GIF_CARD_SIZE } from '@/components/export/AnimatedSharePngCard'
import { scaledCardHeight, type CardRatio } from '@/lib/cardRatio'
import { buildGifFrameSpecs, encodeGif, type CapturedFrame } from '@/lib/exportGif'
import type { Analysis, LayerToggles } from '@/types/analysis'

interface ShareGifExportRunnerProps {
  analysis: Analysis
  ratio: CardRatio
  layers: LayerToggles
  onDone: (blob: Blob) => void
  onError: (err: unknown) => void
}

/**
 * 공유 링크(`/share/:id`, `/s/:token`) 전용 GIF 캡처 루프 — 에디터의
 * `GifExportRunner`와 로직은 완전히 같지만(프레임마다 다시 그려 캡처)
 * `AnimatedSharePngCard`(스토어 미의존)를 쓰고 `layers`를 props로 받는다.
 * 범위는 항상 3국면 전체(scope='all')로 고정한다 — 공유 페이지는
 * "간단하게"(2026-09-26) 요청대로 비율 선택만 제공한다.
 */
export function ShareGifExportRunner({ analysis, ratio, layers, onDone, onError }: ShareGifExportRunnerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frames = useMemo(() => buildGifFrameSpecs(analysis), [analysis])
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
    try {
      onDone(encodeGif(capturedRef.current))
    } catch (err) {
      onError(err)
    }
  }, [index, frames.length, onDone, onError])

  const frame = frames[index]
  if (!frame) return null
  return <AnimatedSharePngCard ref={ref} analysis={analysis} frame={frame} layers={layers} ratio={ratio} />
}
