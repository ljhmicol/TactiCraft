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

interface PitchInfo {
  liveSvg: SVGSVGElement
  left: number
  top: number
  width: number
  height: number
}

/**
 * PNG 캡처 파이프라인 3번째 재작성(2026-09-20) — 근거가 된 실기기 데이터:
 *
 * 1) 카드 배경이 진한 남색이라 "피치가 안 보임"과 "검은 화면"은 같은
 *    증상이었다(SHARE_CARD_COLORS.background).
 * 2) 피치를 html-to-image에 통째로 넘기면(살아있는 svg든, 미리 래스터화한
 *    img든) 선수 마커까지 포함해 그 서브트리 전체가 항상 비었다 — "이미지로
 *    쓰이는 SVG는 foreignObject 안에서 추가 리소스를 로드할 수 없다"는
 *    제약으로 추정하고, 카드를 복제해 피치 자리를 빈 자리표시자로 바꾼
 *    "텍스트 전용" 클론만 html-to-image로 캡처하고 피치는
 *    rasterizeSvg(순수 svg→canvas, foreignObject를 거치지 않음)로 따로
 *    래스터화해 ctx.drawImage로 직접 합성하는 방식으로 바꿨다(prepareTextOnlyClone).
 * 3) 그런데 이 "텍스트 전용" 캡처가 실기기에서 매번 완전히 빈 캔버스를
 *    냈다(크기는 요청한 2160x2160으로 정상, 제목 영역 불투명 픽셀 0개 —
 *    진단으로 직접 확인) — "카드 텍스트는 항상 정상 캡처됐다"는 이전
 *    가정은 사실 `toBlob(node)`를 라이브 노드에 직접 호출하던 시절의
 *    증거였지, `toCanvas(clone)`을 방금 만든 detached 복제본에 호출하는
 *    지금 경로에서는 한 번도 실기기로 검증된 적이 없었다(advisor 리뷰로
 *    확인).
 *
 * 그래서 복제본을 아예 쓰지 않는다: 라이브 카드 노드 안의 피치 svg를
 * "그 자리에서" 잠깐 빈 자리표시자로 바꿔치기하고, 텍스트 캡처가 실제로
 * 한 번도 실패한 적 없는 경로(라이브 노드에 직접 toCanvas 호출)로 캡처한
 * 다음, finally에서 반드시 원래 svg로 되돌린다. React가 이 서브트리를
 * 소유하고 있으므로 교체 창을 최대한 짧게 유지하고, 복구 시점에 자리표시자가
 * 이미 DOM에서 사라졌으면(예: 그 사이 다른 상태 변화로 리렌더링) 저장해둔
 * 부모·다음형제 정보로 직접 다시 끼워 넣는다 — 이 복구가 실패하면 사용자의
 * 실제 편집 화면에서 피치가 사라진 채로 남는, 캡처 실패보다 훨씬 나쁜
 * 상태가 되기 때문에 반드시 보장해야 한다.
 */
async function withPitchesSwappedOut<T>(
  node: HTMLElement,
  fn: () => Promise<T>,
): Promise<{ result: T; pitches: PitchInfo[] }> {
  const cardRect = node.getBoundingClientRect()
  const liveSvgs = Array.from(node.querySelectorAll('svg'))
  const pitches: PitchInfo[] = liveSvgs.map((liveSvg) => {
    const rect = liveSvg.getBoundingClientRect()
    return {
      liveSvg,
      left: rect.left - cardRect.left,
      top: rect.top - cardRect.top,
      width: rect.width,
      height: rect.height,
    }
  })

  const swaps = pitches.map((p) => {
    const parent = p.liveSvg.parentElement
    const nextSibling = p.liveSvg.nextSibling
    const placeholder = document.createElement('div')
    placeholder.style.width = `${p.width}px`
    placeholder.style.height = `${p.height}px`
    p.liveSvg.replaceWith(placeholder)
    return { liveSvg: p.liveSvg, placeholder, parent, nextSibling }
  })

  try {
    const result = await fn()
    return { result, pitches }
  } finally {
    for (const s of swaps) {
      if (s.placeholder.isConnected) {
        s.placeholder.replaceWith(s.liveSvg)
      } else if (s.parent) {
        // 자리표시자가 그 사이 DOM에서 사라졌다면(예: 다른 상태 변화로
        // 리렌더링) 저장해둔 위치 정보로 직접 복구한다 — 실패하면 사용자의
        // 실제 편집 화면에서 피치가 사라진 채로 남는다.
        s.parent.insertBefore(s.liveSvg, s.nextSibling)
      }
    }
  }
}

async function compositeCanvas(
  node: HTMLElement,
  width: number,
  height: number,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const { result: baseCanvas, pitches } = await withPitchesSwappedOut(node, () =>
    withTimeout(
      'toCanvas',
      toCanvas(node, {
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
    ),
  )

  // 2026-09-20 — 캔버스 크기가 요청값과 다르면 피치 draw 좌표만 안 맞고
  // 텍스트 쪽은 캔버스 밖으로 밀려날 수 있다 — 조용히 넘어가지 않는다.
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

  // 2026-09-20 — 크기는 맞는데 내용이 비어 있는 실패 모드(자동화 탭에서
  // 먼저 재현했고, 이후 실기기에서도 같은 증상으로 확인됨)를 다시 조용히
  // 지나치지 않는다. 라이브 노드 직접 캡처로 바꾼 뒤에도 재발하는지는
  // 이 값으로 판단한다.
  const titleBand = ctx.getImageData(128, 128, Math.min(1800, baseCanvas.width - 128), 200)
  let titleNonTransparent = 0
  for (let i = 3; i < titleBand.data.length; i += 4) {
    if (titleBand.data[i] !== 0) titleNonTransparent++
  }
  if (titleNonTransparent < 100) {
    throw new CaptureStageError(
      'compositeCanvas',
      `toCanvas 크기는 정상(${baseCanvas.width}x${baseCanvas.height})이지만 제목 영역 불투명 픽셀 ${titleNonTransparent}개(거의 빈 캔버스로 추정) — 텍스트가 그려지지 않은 것으로 보임`,
    )
  }

  for (let i = 0; i < pitches.length; i++) {
    const p = pitches[i]
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
 *
 * exportCard와 마찬가지로 waitForMorphing을 거친다(2026-09-20 추가) —
 * 저장 시점에 다른 상태 변화가 겹칠 수 있는 경로라, 라이브 DOM을 잠깐
 * 바꿔치기하는 withPitchesSwappedOut의 교체 창이 더 위험해질 수 있다.
 */
export async function captureThumbnail(node: HTMLElement, width: number, height: number): Promise<string> {
  await waitForMorphing()
  await document.fonts.ready
  const canvas = await compositeCanvas(node, width, height, 2)
  return canvas.toDataURL('image/png')
}
