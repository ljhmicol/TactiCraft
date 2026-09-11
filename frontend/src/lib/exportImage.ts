import { toPng } from 'html-to-image'

import { useAnalysisStore } from '@/store/analysisStore'

/** isMorphing이 false가 될 때까지 대기한다 (4단계 §5.3) — 전환 중간 프레임이 찍히는 것을 막는다. */
function waitForMorphing(): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!useAnalysisStore.getState().isMorphing) resolve()
      else setTimeout(tick, 50)
    }
    tick()
  })
}

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<void> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    // GifExportRunner와 같은 이유(2026-09-11) — 이미 로드된 폰트를 다시
    // embed하려다 cross-origin Google Fonts CSS에서 CORS SecurityError가
    // 나며 느려지는 걸 막는다. 여기(PNG 1회 캡처)는 안 걸리는 걸로
    // 보였지만 실제로는 같은 에러를 조용히 겪고 있었다.
    skipFonts: true,
    width: 1080,
    height: ratio === '1:1' ? 1080 : 1350,
  })

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `tacticore_${Date.now()}.png`
  a.click()
}

/**
 * 목록 미리보기용 썸네일(TO-DO 7번) — exportCard와 달리 다운로드하지 않고
 * data URL 문자열만 돌려준다. 저장 뮤테이션이 이 값을 페이로드에 실어
 * 백엔드로 보낸다.
 */
export async function captureThumbnail(node: HTMLElement, width: number, height: number): Promise<string> {
  await document.fonts.ready
  return toPng(node, { pixelRatio: 2, cacheBust: true, skipFonts: true, width, height })
}
