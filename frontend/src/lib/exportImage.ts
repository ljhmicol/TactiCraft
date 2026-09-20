import { toCanvas } from 'html-to-image'

import { rasterizeSvg } from '@/lib/rasterizeSvg'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 어느 단계에서 실패했는지 메시지에 남기는 에러(2026-09-20, "다운로드 자체가
 * 안 된다" 재발 대응) — 지금까지 실패가 전부 조용히 사라져서(콘솔 접근이
 * 없는 실기기라 더더욱) 사용자 리포트만으로는 캡처 단계 실패인지, toCanvas
 * 자체가 멈춘 건지 구분할 수 없었다 — 최소한 토스트에 단계 이름과 원인이
 * 그대로 보이게 한다.
 */
class CaptureStageError extends Error {
  constructor(stage: string, detail: string, cause?: unknown) {
    const causeMsg = cause instanceof Error ? `${cause.name}: ${cause.message}` : cause ? String(cause) : ''
    super(`[${stage}] ${detail}${causeMsg ? ` — ${causeMsg}` : ''}`)
    this.name = 'CaptureStageError'
  }
}

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

/** toCanvas 등이 응답 없이 멈추면 영원히 스피너만 도는 대신 명시적으로 실패시킨다. */
function withTimeout<T>(stage: string, p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new CaptureStageError(stage, `${ms}ms 안에 응답 없음(타임아웃)`)), ms)
    p.then((v) => {
      clearTimeout(timer)
      resolve(v)
    }).catch((e) => {
      clearTimeout(timer)
      reject(e instanceof CaptureStageError ? e : new CaptureStageError(stage, '', e))
    })
  })
}

/**
 * PNG 캡처 파이프라인 전면 재작성(2026-09-20) — 지금까지의 모든 시도
 * (rAF 제거, 피치 svg 사전 래스터화 + html-to-image에 통째로 넘기기,
 * decode/레이아웃 플러시/프레임 대기 추가)가 실기기(아이폰·아이패드
 * Safari, 안드로이드 Chrome 전부)에서 **피치 영역이 완전히 빈 채로**
 * 나오는 걸 막지 못했다 — 사용자 확인으로 선수 마커까지 전혀 안 보이는
 * 것까지 확정(카드의 다른 텍스트·테두리는 항상 정상 캡처됐다). 카드
 * 배경색이 진한 남색(#0F172A, lib/theme.ts SHARE_CARD_COLORS.background)
 * 이라 "피치가 안 보임"과 "검은 화면"은 사실 같은 증상이었다.
 *
 * 원인으로 좁힌 가설: html-to-image는 캡처 대상을
 * `<svg><foreignObject>(HTML 통째로)</foreignObject></svg>`로 합성한 뒤
 * 그 합성 결과를 `new Image()`로 불러와(=SVG를 "이미지 리소스"로 로드)
 * 캔버스에 그린다. 그 안에 또 리소스를 불러와야 하는 요소(중첩된
 * `<svg>`든, `data:` URL `<img>`든)가 있으면, "이미지로 쓰이는 SVG는
 * 추가 리소스를 로드할 수 없다"는 스펙상의 제약에 걸려 그 서브트리 전체가
 * 비는 것으로 보인다 — 어떤 형태로 넣어도(살아있는 svg, 미리 래스터화한
 * img) 매번 같은 자리만 비었던 것과 정확히 들어맞는다.
 *
 * 그래서 접근을 바꾼다: html-to-image에는 **피치를 아예 안 준다.** 카드를
 * 복제해 피치 자리를 빈 자리표시자로 바꾼 "텍스트 전용" 버전만
 * html-to-image로 캡처하고(이 경로는 처음부터 지금까지 한 번도 실패한
 * 적이 없다), 피치는 이미 실기기에서 검증된 `rasterizeSvg`(순수 svg→
 * canvas, foreignObject를 전혀 거치지 않음)로 따로 래스터화한 뒤, 두
 * 캔버스를 우리가 직접 `ctx.drawImage`로 합성한다. `drawImage`는 이미
 * 디코드가 끝난 네이티브 이미지 객체를 그리는 것이라 "이미지로 쓰이는
 * SVG 안에서 리소스 로드" 제약과 아예 무관하다.
 */
async function prepareTextOnlyClone(
  node: HTMLElement,
): Promise<{
  clone: HTMLElement
  cleanup: () => void
  pitches: Array<{ liveSvg: SVGSVGElement; left: number; top: number; width: number; height: number }>
}> {
  const cardRect = node.getBoundingClientRect()
  const liveSvgs = Array.from(node.querySelectorAll('svg'))
  const pitches = liveSvgs.map((liveSvg) => {
    const rect = liveSvg.getBoundingClientRect()
    return {
      liveSvg,
      left: rect.left - cardRect.left,
      top: rect.top - cardRect.top,
      width: rect.width,
      height: rect.height,
    }
  })

  const clone = node.cloneNode(true) as HTMLElement
  const clonedSvgs = Array.from(clone.querySelectorAll('svg'))
  for (let i = 0; i < clonedSvgs.length; i++) {
    const clonedSvg = clonedSvgs[i]
    const p = pitches[i]
    // 자리표시자는 순수 <div>일 뿐, 리소스를 더 불러올 일이 없다 — 다른
    // 카드 레이아웃(flex 등)이 피치 공간을 기준으로 배치돼 있을 수 있어
    // 크기만 그대로 보존한다.
    const placeholder = document.createElement('div')
    placeholder.style.width = `${p.width}px`
    placeholder.style.height = `${p.height}px`
    clonedSvg.replaceWith(placeholder)
  }

  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  clone.style.top = '0'
  document.body.appendChild(clone)

  return { clone, cleanup: () => clone.remove(), pitches }
}

async function compositeCanvas(
  node: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const { clone, cleanup, pitches } = await prepareTextOnlyClone(node)

  let baseCanvas: HTMLCanvasElement
  try {
    baseCanvas = await withTimeout(
      'toCanvas',
      toCanvas(clone, {
        pixelRatio,
        cacheBust: true,
        // GifExportRunner와 같은 이유(2026-09-11) — 이미 로드된 폰트를 다시
        // embed하려다 cross-origin Google Fonts CSS에서 CORS SecurityError가
        // 나며 느려지는 걸 막는다.
        skipFonts: true,
        width,
        height,
      }),
      20_000,
    )
  } finally {
    cleanup()
  }

  // 2026-09-20 — 검은 화면은 고쳤는데(피치는 보임) 이번엔 "피치만 보이고
  // 텍스트는 안 보임"으로 반전된 리포트가 왔다. 격리 테스트(Chromium에서
  // prepareTextOnlyClone을 그대로 재현)로 클론의 레이아웃 수치(카드
  // 1080x1080, 텍스트 div들 전부 정상 크기·좌표)는 완전히 정상임을
  // 순수 레이아웃 읽기로 확인했다 — 즉 레이아웃 문제가 아니다. 남은 유력
  // 후보는 toCanvas가 실제로 반환한 캔버스 크기가 요청한 값과 다른
  // 경우(el.getBoundingClientRect() 기반이 아니라 다른 기준으로 캔버스를
  // 만들었다면, 피치 draw 좌표만 안 맞고 텍스트 쪽은 캔버스 밖으로 밀려날
  // 수 있다) — 이 값도 조용히 넘어가지 않고 실제 수치를 그대로 노출한다.
  const expectedW = Math.round(width * pixelRatio)
  const expectedH = Math.round(height * pixelRatio)
  if (Math.abs(baseCanvas.width - expectedW) > 2 || Math.abs(baseCanvas.height - expectedH) > 2) {
    throw new CaptureStageError(
      'compositeCanvas',
      `toCanvas 결과 크기가 ${baseCanvas.width}x${baseCanvas.height}, 기대값은 ${expectedW}x${expectedH}`,
    )
  }

  const ctx = baseCanvas.getContext('2d')
  if (!ctx) throw new CaptureStageError('compositeCanvas', '캔버스 컨텍스트를 만들지 못했습니다')

  for (let i = 0; i < pitches.length; i++) {
    const p = pitches[i]
    // 2026-09-20 — 검은 화면(피치 전체 미표시)이 새 합성 방식으로도 재현돼,
    // 남은 유력 용의자는 "off-screen(left:-9999px) 상태의 svg에서
    // getBoundingClientRect()가 0×0을 돌려줘 이 자리 자체를 통째로
    // 건너뛴다"는 것 — 예전엔 이 가능성을 코드 주석으로만 적어두고 실제로
    // 확인한 적이 없었다. 0×0이면 조용히 넘어가지 않고 정확한 수치를
    // 에러로 그대로 노출해 다음 실기기 테스트에서 바로 확인한다.
    if (p.width <= 0 || p.height <= 0) {
      throw new CaptureStageError(
        'compositeCanvas',
        `svg#${i} rect가 ${p.width.toFixed(1)}x${p.height.toFixed(1)}(0 또는 음수) — off-screen 레이아웃 측정 실패로 추정`,
      )
    }
    let dataUrl: string
    try {
      dataUrl = await rasterizeSvg(p.liveSvg, Math.round(p.width), Math.round(p.height), pixelRatio)
    } catch (e) {
      throw new CaptureStageError('rasterizeSvg', `svg#${i} rect=${p.width.toFixed(0)}x${p.height.toFixed(0)}`, e)
    }
    const img = new Image()
    img.src = dataUrl
    try {
      await img.decode()
    } catch (e) {
      throw new CaptureStageError('compositeCanvas', `svg#${i} 래스터 결과 decode 실패`, e)
    }
    ctx.drawImage(img, Math.round(p.left * pixelRatio), Math.round(p.top * pixelRatio))
  }

  return baseCanvas
}

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<Blob> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const canvas = await compositeCanvas(node, 1080, ratio === '1:1' ? 1080 : 1350, 2)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new CaptureStageError('toBlob', '결과 blob이 null')

  // toPng(문자열 data: URL)이 아니라 toBlob을 직접 쓴다(advisor 리뷰로
  // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
  // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
  // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약).
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

  return blob
}

/**
 * 목록 미리보기용 썸네일(TO-DO 7번) — exportCard와 달리 다운로드하지 않고
 * data URL 문자열만 돌려준다. 저장 뮤테이션이 이 값을 페이로드에 실어
 * 백엔드로 보낸다.
 */
export async function captureThumbnail(node: HTMLElement, width: number, height: number): Promise<string> {
  await document.fonts.ready
  const canvas = await compositeCanvas(node, width, height, 2)
  return canvas.toDataURL('image/png')
}
