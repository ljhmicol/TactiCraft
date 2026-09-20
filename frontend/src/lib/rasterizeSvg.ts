/**
 * 살아있는 `<svg>` 엘리먼트를 캔버스에 그려 PNG data URL로 바꾼다(2026-09-20,
 * 실기기 Safari 리포트 대응 — PNG 내보내기에서 카드의 텍스트는 정상
 * 캡처되는데 전술판(피치 SVG)만 안 보였다).
 *
 * 원인: html-to-image는 캡처 대상 서브트리를 통째로 복제해 또 다른
 * `<svg><foreignObject>` 안에 집어넣는 방식으로 동작한다 — 캡처 대상
 * 자체가 이미 `<svg>`(피치)를 포함하고 있으면 결과적으로 svg 안에
 * foreignObject, 그 안에 또 svg가 중첩된다. 이 "중첩 SVG-in-foreignObject"
 * 렌더링은 Chromium은 대체로 버티지만 Safari(WebKit)는 실패하는 걸로
 * 알려진 문제다. 이 함수로 캡처 직전에 피치를 미리 평평한 `<img>`로
 * 바꿔치기하면(exportImage.ts의 prepareCaptureClone 참조) 캡처 시점엔
 * 중첩 SVG 자체가 없어져 이 문제를 피해간다.
 *
 * base64(`btoa`) 대신 `encodeURIComponent`를 쓴다 — 선수 이름에 한글이
 * 섞여 있어 `btoa`는 Latin1 범위를 벗어나는 문자에서 바로 예외를 던진다.
 */
export async function rasterizeSvg(
  svg: SVGSVGElement,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

  const img = new Image()
  img.width = width
  img.height = height
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('피치 SVG를 이미지로 변환하지 못했습니다.'))
    img.src = svgDataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * pixelRatio))
  canvas.height = Math.max(1, Math.round(height * pixelRatio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 만들지 못했습니다.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
