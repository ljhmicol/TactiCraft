import { toBlob, toPng } from 'html-to-image'

import { rasterizeSvg } from '@/lib/rasterizeSvg'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 어느 단계에서 실패했는지 메시지에 남기는 에러(2026-09-20, "다운로드 자체가
 * 안 된다" 재발 대응) — 지금까지 실패가 전부 조용히 사라져서(콘솔 접근이
 * 없는 실기기 Safari라 더더욱) 사용자 리포트만으로는 캡처 단계 실패인지,
 * toBlob 자체가 멈춘 건지, 성공했는데 다운로드만 안 된 건지 구분할 수
 * 없었다 — 최소한 토스트에 단계 이름과 원인이 그대로 보이게 한다.
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
 *
 * 실제 내보내기 대상(ShareCard)은 진단 페이지의 테스트용 피치와 달리
 * `position:absolute; left:-99999px`로 화면 밖에 마운트돼 있다(중복 마운트를
 * 피하려는 기존 설계) — 이 상태의 자손 svg에서 getBoundingClientRect()가
 * WebKit에서 0×0을 돌려줄 가능성을 배제할 수 없다(진단 페이지는 화면 안에
 * 보이는 작은 피치라 이 경로를 검증하지 못했다). 그래서 실패 시 어떤 rect
 * 값을 읽었는지가 에러 메시지에 그대로 남도록 한다.
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
    let dataUrl: string
    try {
      dataUrl = await rasterizeSvg(liveSvg, width, height, pixelRatio)
    } catch (e) {
      clone.remove()
      throw new CaptureStageError('rasterizeSvg', `svg#${i} rect=${rect.width.toFixed(0)}x${rect.height.toFixed(0)}`, e)
    }
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

/** toBlob/toPng가 응답 없이 멈추면(구 rAF 이슈 등) 영원히 스피너만 도는 대신 명시적으로 실패시킨다. */
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

// 2026-09-20 — 실기기(아이폰·아이패드 Safari, 안드로이드 Chrome 둘 다)에서
// PNG 결과가 "검은 화면"으로 나오는 걸 확인(다운로드 자체는 됨, 토스트도
// "생성 완료"로 뜸) — 두 브라우저 엔진 모두에서 재현되므로 WebKit 전용
// 문제(prepareCaptureClone을 만든 원래 이유)가 아니라 prepareCaptureClone
// 자체(라이브 노드가 아니라 방금 만든 복제본을 그 자리에서 바로 캡처하는
// 것)가 새로 만든 문제일 가능성이 높다 — advisor 리뷰. 원인을 좁히기 위해
// 이 복제본 경로를 일시적으로 끄고 원본 `node`를 직접 캡처한다(예전에
// "다운로드는 됨, 텍스트는 보임, 피치만 안 보임" 상태를 만들었던 바로 그
// 버전). 검은 화면이 사라지고 다시 "피치만 안 보임"으로 돌아오면
// prepareCaptureClone이 원인으로 확정되고, 그래도 검은 화면이면 이 함수는
// 원인이 아니었다는 뜻이다. PC(사파리 제외, 안드로이드 Chrome 기준)에서
// 재확인되면 prepareCaptureClone을 layout flush를 더해 다시 켠다.
const USE_PITCH_FLATTEN_CLONE = false

export async function exportCard(node: HTMLElement, ratio: '1:1' | '4:5'): Promise<Blob> {
  await waitForMorphing()
  await document.fonts.ready // 웹폰트 로드 전에 캡처하면 폴백 폰트로 찍힌다

  const pixelRatio = 2
  const { target, cleanup } = USE_PITCH_FLATTEN_CLONE
    ? await prepareCaptureClone(node, pixelRatio)
    : { target: node, cleanup: () => {} }

  let blob: Blob | null
  try {
    // toPng(문자열 data: URL)이 아니라 toBlob을 직접 쓴다(advisor 리뷰로
    // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
    // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
    // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약).
    blob = await withTimeout(
      'toBlob',
      toBlob(target, {
        pixelRatio,
        cacheBust: true,
        // GifExportRunner와 같은 이유(2026-09-11) — 이미 로드된 폰트를 다시
        // embed하려다 cross-origin Google Fonts CSS에서 CORS SecurityError가
        // 나며 느려지는 걸 막는다.
        skipFonts: true,
        width: 1080,
        height: ratio === '1:1' ? 1080 : 1350,
      }),
      20_000,
    )
  } finally {
    cleanup()
  }
  if (!blob) throw new CaptureStageError('toBlob', '결과 blob이 null')

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
  const pixelRatio = 2
  const { target, cleanup } = USE_PITCH_FLATTEN_CLONE
    ? await prepareCaptureClone(node, pixelRatio)
    : { target: node, cleanup: () => {} }
  try {
    return await withTimeout('toPng', toPng(target, { pixelRatio, cacheBust: true, skipFonts: true, width, height }), 20_000)
  } finally {
    cleanup()
  }
}
