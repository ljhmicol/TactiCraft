import { toCanvas } from 'html-to-image'
import { useEffect, useMemo, useRef, useState } from 'react'

import { AnimatedShareCard, GIF_CARD_SIZE } from '@/components/export/AnimatedShareCard'
import { scaledCardHeight, type CardRatio } from '@/lib/cardRatio'
import { buildGifFrameSpecs, type CapturedFrame } from '@/lib/exportGif'
import { encodeAnimation } from '@/lib/exportVideo'
import type { Analysis, PhaseType } from '@/types/analysis'

interface GifExportRunnerProps {
  analysis: Analysis
  ratio: CardRatio
  scope: PhaseType | 'all'
  onDone: (blob: Blob, extension: string) => void
  onError: (err: unknown) => void
}

/**
 * GIF/동영상 내보내기(TO-DO 6, 2026-09-26부터 동영상 우선)의 실제 캡처
 * 루프. PNG(exportImage.ts)는 이미 정지된 화면을 한 번만 캡처하지만, 이
 * 쪽은 프레임 수십 장을 순서대로 렌더링→캡처해야 한다. React state(index)로
 * 한 번에 프레임 하나씩 AnimatedShareCard를 다시 그리고, 두 번의
 * requestAnimationFrame으로 페인트가 끝난 뒤에만 `toCanvas`로 캡처한다 —
 * 라이브 애니메이션을 실시간으로 녹화하는 대신, 국면 사이 좌표를 미리
 * 계산해(lib/exportGif.ts) 정지 이미지를 순서대로 찍는 방식이라 캡처
 * 타이밍이 기기 성능에 흔들리지 않는다(인코딩 자체는 lib/exportVideo.ts가
 * 맡는데, MediaRecorder 특성상 그 단계만 벽시계 시간에 매인다).
 *
 * 프레임 전부를 다 캡처하면 encodeAnimation으로 인코딩해(가능하면 mp4/webm,
 * 아니면 GIF로 대체) onDone(blob, extension)을 호출하고, 그 시점부터는 이
 * 컴포넌트를 부모(ExportControls)가 언마운트한다.
 */
export function GifExportRunner({ analysis, ratio, scope, onDone, onError }: GifExportRunnerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const frames = useMemo(() => buildGifFrameSpecs(analysis, scope), [analysis, scope])
  const capturedRef = useRef<CapturedFrame[]>([])
  const finishedRef = useRef(false)
  const [index, setIndex] = useState(0)
  const cardHeight = scaledCardHeight(ratio, GIF_CARD_SIZE)

  useEffect(() => {
    if (index >= frames.length) return
    let cancelled = false

    async function captureCurrentFrame() {
      await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다
      // 레이아웃 이펙트(useFitFontSize) → 페인트 순서를 보장하려고 두 번 기다린다.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      if (cancelled || !ref.current) return
      try {
        const canvas = await toCanvas(ref.current, {
          pixelRatio: 1,
          cacheBust: true,
          // 이미 document.fonts.ready로 폰트가 로드된 같은 탭에서 캡처하므로
          // html-to-image가 폰트를 다시 내려받아 base64로 embed할 필요가
          // 없다(2026-09-11, "GIF 내보내기 했는데 계속 만드는 중" 리포트로
          // 발견) — Google Fonts <link>(Hallmark 리디자인 때 추가)가
          // cross-origin이라 embed 시도마다 `cssRules` 접근이 CORS로 막혀
          // SecurityError가 나는데, 프레임(39장)마다 이 실패를 반복하느라
          // 한 프레임에 ~2초씩 걸려 39장 전체가 70초 넘게 걸렸다. skipFonts로
          // 이 단계 자체를 건너뛰면 이미 렌더링된 폰트 그대로 캡처되고 이
          // CORS 에러도 없어진다.
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
  return <AnimatedShareCard ref={ref} analysis={analysis} frame={frame} ratio={ratio} />
}
