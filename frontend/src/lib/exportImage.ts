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
 * 내보내면 카드 텍스트는 보이는데 피치만 안 보였다). html-to-image가 캡처
 * 대상을 `<svg><foreignObject>`에 복제해 넣는데, 캡처 대상 자체가 이미
 * svg(피치)를 담고 있어 결과적으로 svg 안에 svg가 중첩된다 — 이 구조를
 * WebKit이 못 그리는 걸로 알려져 있다.
 *
 * 최종 래스터화(toBlob/toPng)는 html-to-image가 내부적으로 쓰는
 * createImage(decode() 다음 requestAnimationFrame까지 기다림)를 그대로
 * 쓴다 — 한때 이 rAF 대기를 직접 손으로 빼려고 시도했으나(2026-09-20),
 * 그 "수정"은 자동화 탭(document.visibilityState가 강제로 hidden)에서
 * rAF가 안 도는 현상을 실제 버그로 오인해서 나온 것이었다. rAF 없이
 * decode()만으로 넘어가면 오히려 foreignObject 내용이 완전히 빈
 * 투명 이미지로 그려지는 걸 직접 재현해서 확인했다 — 그래서 이 rAF
 * 대기는 걷어내지 않고 라이브러리 기본 동작을 그대로 쓴다.
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

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<void> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const pixelRatio = 2
  const { target, cleanup } = await prepareCaptureClone(node, pixelRatio)

  let blob: Blob | null
  try {
    // toPng(문자열 data: URL)이 아니라 toBlob을 직접 쓴다(advisor 리뷰로
    // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
    // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
    // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약).
    blob = await toBlob(target, {
      pixelRatio,
      cacheBust: true,
      // GifExportRunner와 같은 이유(2026-09-11) — 이미 로드된 폰트를 다시
      // embed하려다 cross-origin Google Fonts CSS에서 CORS SecurityError가
      // 나며 느려지는 걸 막는다.
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
