import { toSvg } from 'html-to-image'

import { rasterizeSvg } from '@/lib/rasterizeSvg'
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

/**
 * 캡처 직전에 `node` 안의 모든 `<svg>`(피치)를 미리 평평한 `<img>`로 바꿔치기한
 * "복제본"을 화면 밖에 만든다(2026-09-20, 실기기 Safari 리포트 — PNG로
 * 내보내면 카드 텍스트는 보이는데 피치만 안 보였다). html-to-image가 캡처
 * 대상을 `<svg><foreignObject>`에 복제해 넣는데, 캡처 대상 자체가 이미
 * svg(피치)를 담고 있어 결과적으로 svg 안에 svg가 중첩된다 — 이 구조를
 * WebKit이 못 그리는 걸로 알려져 있다.
 *
 * 원본 `node`(라이브 React 트리의 일부)는 절대 건드리지 않는다 — 복제본에서만
 * svg를 img로 바꿔서, 라이브 컴포넌트의 상태·레이아웃 이펙트(예: ShareCard의
 * useFitFontSize)와 전혀 간섭하지 않는다.
 */
async function prepareCaptureClone(
  node: HTMLElement,
  pixelRatio: number,
): Promise<{ target: HTMLElement; cleanup: () => void }> {
  const liveSvgs = Array.from(node.querySelectorAll('svg'))
  if (liveSvgs.length === 0) return { target: node, cleanup: () => {} }

  const clone = node.cloneNode(true) as HTMLElement
  const clonedSvgs = Array.from(clone.querySelectorAll('svg'))

  for (let i = 0; i < liveSvgs.length; i++) {
    const liveSvg = liveSvgs[i]
    const clonedSvg = clonedSvgs[i]
    if (!clonedSvg) continue
    const rect = liveSvg.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    const dataUrl = await rasterizeSvg(liveSvg, width, height, pixelRatio)
    const img = document.createElement('img')
    img.src = dataUrl
    img.width = width
    img.height = height
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.display = 'block'
    clonedSvg.replaceWith(img)
  }

  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  clone.style.top = '0'
  document.body.appendChild(clone)

  return { target: clone, cleanup: () => clone.remove() }
}

/**
 * html-to-image의 `toCanvas`/`toBlob`/`toPng`는 내부적으로 `createImage`를
 * 쓰는데, 그 함수가 이미지 로드 후 `img.decode().then(() => requestAnimationFrame(
 * () => resolve(img)))` 순서로 되어 있다(node_modules/html-to-image/es/util.js).
 * 실기기 진단(2026-09-20)에서 `decode()`까지는 항상 정상적으로 resolve되는데
 * 그다음 `requestAnimationFrame` 콜백이 전혀 호출되지 않아 캡처 전체가
 * 영원히 멈추는 경우를 실제로 재현했다 — Chromium에서도 재현됐다(자동화
 * 탭이 "보이는" 탭으로 취급되지 않아 rAF가 스로틀링됐을 가능성이 있지만,
 * 실기기 브라우저에서도 rAF가 지연/스킵될 수 있는 상황은 얼마든지 있다:
 * 백그라운드 전환, 저전력 모드 등).
 *
 * `toSvg`(DOM→SVG 문자열 합성, cloneNode·embedImages·embedFonts를 그대로
 * 활용— 이 부분은 안정적으로 동작함이 확인됨)까지는 라이브러리를 그대로
 * 쓰고, 그 결과를 이미지로 불러와 캔버스에 그리는 마지막 단계만 rAF 없이
 * 우리가 직접 한다(rasterizeSvg.ts와 같은 decode() 기반 패턴).
 */
async function svgDataUrlToCanvas(
  svgDataUrl: string,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const img = new Image()
  img.src = svgDataUrl
  try {
    await img.decode()
  } catch {
    throw new Error('카드를 이미지로 변환하지 못했습니다.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * pixelRatio))
  canvas.height = Math.max(1, Math.round(height * pixelRatio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 만들지 못했습니다.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas
}

async function captureNodeToCanvas(
  node: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const svgDataUrl = await toSvg(node, { pixelRatio, cacheBust: true, skipFonts: true, width, height })
  return svgDataUrlToCanvas(svgDataUrl, width, height, pixelRatio)
}

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<void> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const pixelRatio = 2
  const width = 1080
  const height = ratio === '1:1' ? 1080 : 1350
  const { target, cleanup } = await prepareCaptureClone(node, pixelRatio)

  let canvas: HTMLCanvasElement
  try {
    canvas = await captureNodeToCanvas(target, width, height, pixelRatio)
  } finally {
    cleanup()
  }

  // toDataURL(문자열) 왕복 대신 canvas.toBlob을 직접 쓴다(advisor 리뷰로
  // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
  // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
  // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약).
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNG 캡처에 실패했습니다.')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tacticore_${Date.now()}.png`
  // 클릭이 실제 파일 열기/저장 동작으로 이어지려면 문서에 붙어 있는 노드여야
  // 한다(detached 노드의 클릭은 브라우저마다 처리가 다르다). 다운로드가
  // 비동기로 시작되므로 URL도 클릭 직후 바로 revoke하지 않는다 — Safari는
  // 그 사이 레이스에서 특히 잘 진다(아직 안 읽은 blob: URL이 무효화되는 경우).
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * 목록 미리보기용 썸네일(TO-DO 7번) — exportCard와 달리 다운로드하지 않고
 * data URL 문자열만 돌려준다. 저장 뮤테이션이 이 값을 페이로드에 실어
 * 백엔드로 보낸다.
 */
export async function captureThumbnail(node: HTMLElement, width: number, height: number): Promise<string> {
  await document.fonts.ready
  const pixelRatio = 2
  const { target, cleanup } = await prepareCaptureClone(node, pixelRatio)
  try {
    const canvas = await captureNodeToCanvas(target, width, height, pixelRatio)
    return canvas.toDataURL('image/png')
  } finally {
    cleanup()
  }
}
