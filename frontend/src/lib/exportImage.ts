import { toBlob, toPng } from 'html-to-image'

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
 * 내보내면 카드 텍스트는 보이는데 피치만 안 보였다). 원인은 rasterizeSvg.ts
 * 상단 docstring 참조(중첩 SVG-in-foreignObject가 Safari에서 안 그려짐).
 *
 * 원본 `node`(라이브 React 트리의 일부)는 절대 건드리지 않는다 — 복제본에서만
 * svg를 img로 바꿔서, 라이브 컴포넌트의 상태·레이아웃 이펙트(예: ShareCard의
 * useFitFontSize)와 전혀 간섭하지 않는다. svg가 하나도 없으면(이 코드베이스의
 * 모든 카드는 피치를 svg로 그리므로 사실상 항상 있지만) 원본을 그대로 쓴다.
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

  // html-to-image가 레이아웃/computed style을 정확히 읽으려면 복제본도
  // 문서에 붙어 있어야 한다 — 원본과 겹치지 않게 화면 밖에 둔다.
  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  clone.style.top = '0'
  document.body.appendChild(clone)

  return { target: clone, cleanup: () => clone.remove() }
}

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<void> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const pixelRatio = 2
  const { target, cleanup } = await prepareCaptureClone(node, pixelRatio)

  // toPng(문자열 data: URL)이 아니라 toBlob을 직접 쓴다(advisor 리뷰로
  // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
  // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
  // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약). base64
  // 문자열을 거쳐 다시 Blob으로 fetch하는 왕복도 없앤다 — 1080×1350 캡처를
  // 문자열로 한 번 더 들고 있는 건 메모리가 넉넉하지 않은 기기에서 그 자체로
  // 실패 요인이 될 수 있다.
  let blob: Blob | null
  try {
    blob = await toBlob(target, {
      pixelRatio,
      cacheBust: true,
      // GifExportRunner와 같은 이유(2026-09-11) — 이미 로드된 폰트를 다시
      // embed하려다 cross-origin Google Fonts CSS에서 CORS SecurityError가
      // 나며 느려지는 걸 막는다. 여기(PNG 1회 캡처)는 안 걸리는 걸로
      // 보였지만 실제로는 같은 에러를 조용히 겪고 있었다.
      skipFonts: true,
      width: 1080,
      height: ratio === '1:1' ? 1080 : 1350,
    })
  } finally {
    cleanup()
  }
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
    return await toPng(target, { pixelRatio, cacheBust: true, skipFonts: true, width, height })
  } finally {
    cleanup()
  }
}
