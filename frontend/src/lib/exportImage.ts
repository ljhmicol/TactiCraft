import { toBlob, toPng } from 'html-to-image'

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

  // toPng(문자열 data: URL)이 아니라 toBlob을 직접 쓴다(advisor 리뷰로
  // 정정, 2026-09-20 실기기 Safari 리포트 대응) — data: URL을 <a download>에
  // 그대로 넣으면 Safari(특히 iOS)에서 "다운로드/보기" 액션시트까지는 뜨지만
  // 실제 파일 저장으로 이어지지 않는 경우가 많다(잘 알려진 제약). base64
  // 문자열을 거쳐 다시 Blob으로 fetch하는 왕복도 없앤다 — 1080×1350 캡처를
  // 문자열로 한 번 더 들고 있는 건 메모리가 넉넉하지 않은 기기에서 그 자체로
  // 실패 요인이 될 수 있다.
  const blob = await toBlob(node, {
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
  return toPng(node, { pixelRatio: 2, cacheBust: true, skipFonts: true, width, height })
}
