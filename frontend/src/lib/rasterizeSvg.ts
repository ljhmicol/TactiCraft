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
 *
 * `img.onload` 대신 `img.decode()`로 로드 완료를 기다린다(2026-09-20,
 * 실기기 진단으로 확정) — 처음엔 `onload`만 썼는데, 실제 아이폰 Safari에서
 * 캡처 결과가 완전히 빈 이미지로 나오는 회귀가 있었다. WebKit은 data:
 * SVG 이미지의 `onload`를 실제로 페인트 가능한 상태가 되기 *전에* 미리
 * 쏘는 것으로 보인다 — 그 시점에 `drawImage`를 하면 조용히 아무것도 안
 * 그려진다. `decode()`는 "그려도 되는 상태"까지 기다려주는 게 계약이라
 * 이 문제가 없다 — 실제로 `/debug/export` 진단 페이지로 사용자의 아이폰
 * Safari에서 `decode()` 기반으로 재확인해 피치 배경색이 정확히 나오는
 * 것까지 확인했다(이 파일이 그 수정판).
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
  img.src = svgDataUrl
  try {
    await img.decode()
  } catch {
    throw new Error('피치 SVG를 이미지로 변환하지 못했습니다.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * pixelRatio))
  canvas.height = Math.max(1, Math.round(height * pixelRatio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스 컨텍스트를 만들지 못했습니다.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
