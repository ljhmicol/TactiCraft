import { useEffect, useRef, useState } from 'react'

import { OpponentNode } from '@/components/pitch/OpponentNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PlayerNode } from '@/components/pitch/PlayerNode'
import { captureThumbnail } from '@/lib/exportImage'
import { loadSampleAnalysis } from '@/lib/loadSample'
import type { Analysis } from '@/types/analysis'

/**
 * 임시 진단 페이지(2026-09-20) — TO-DO 71 "PNG 내보내기에서 전술판이 안
 * 보임" 버그가 아이폰/아이패드 Safari에서만 재현되는데, 이 세션엔 Mac이
 * 없어 Safari 원격 디버깅으로 콘솔을 볼 방법이 없다. advisor 권고로,
 * 추측성 수정을 더 배포하는 대신 이 페이지가 각 단계의 결과를 화면에
 * 텍스트로 그대로 찍어서 사용자가 스크린샷 한 장으로 전달할 수 있게 한다.
 *
 * 조사가 끝나면 이 라우트·파일은 지운다 — 실제 기능이 아니라 일회성
 * 진단 도구다.
 */
export function DebugExportPage() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [captureLog, setCaptureLog] = useState<string[]>([])
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null)
  const pitchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadSampleAnalysis('/samples/managers/guardiola.json')
      .then(setAnalysis)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  const appendLog = (line: string) => setLog((l) => [...l, line])

  const runDiagnostic = async () => {
    setLog([])
    try {
      await document.fonts.ready
      appendLog('1. 폰트 로드 완료')

      const svg = pitchWrapRef.current?.querySelector('svg')
      if (!svg) {
        appendLog('2. svg를 못 찾음 — 여기서 중단')
        return
      }
      const rect = svg.getBoundingClientRect()
      appendLog(`2. 화면에 그려진 svg 크기: ${rect.width.toFixed(1)} x ${rect.height.toFixed(1)}`)

      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(Math.round(rect.width)))
      clone.setAttribute('height', String(Math.round(rect.height)))
      const svgString = new XMLSerializer().serializeToString(clone)
      appendLog(`3. 직렬화된 svg 문자열 길이: ${svgString.length}자`)

      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`
      const img = new Image()
      let onloadFired = false
      img.onload = () => {
        onloadFired = true
      }
      img.onerror = () => appendLog('   (img onerror 이벤트 발생)')
      img.src = svgDataUrl

      await new Promise((resolve) => setTimeout(resolve, 80))
      appendLog(`4. img.onload가 80ms 안에 발생했는가: ${onloadFired}`)
      appendLog(`   img.complete=${img.complete}, naturalWidth=${img.naturalWidth}, naturalHeight=${img.naturalHeight}`)

      let decodeOk = false
      let decodeError = ''
      try {
        await img.decode()
        decodeOk = true
      } catch (e) {
        decodeError = e instanceof Error ? e.message : String(e)
      }
      appendLog(`5. img.decode() 성공: ${decodeOk}${decodeError ? ` / 에러: ${decodeError}` : ''}`)
      appendLog(`   decode 후 naturalWidth=${img.naturalWidth}, naturalHeight=${img.naturalHeight}`)

      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(rect.width * 2))
      canvas.height = Math.max(1, Math.round(rect.height * 2))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        appendLog('6. 캔버스 컨텍스트를 못 만듦 — 여기서 중단')
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const center = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data
      const corner = ctx.getImageData(Math.round(canvas.width * 0.05), Math.round(canvas.height * 0.05), 1, 1).data
      appendLog(`6. 캔버스 중앙 픽셀 RGBA: ${Array.from(center).join(',')}`)
      appendLog(`7. 캔버스 모서리 픽셀 RGBA: ${Array.from(corner).join(',')}  (피치 배경색이면 27,94,63,255에 가까워야 함)`)

      const outUrl = canvas.toDataURL('image/png')
      appendLog(`8. 최종 PNG data URL 길이: ${outUrl.length}자 (수백 자 수준이면 사실상 빈 이미지)`)
      appendLog('진단 완료 — 위 로그 전체를 스크린샷해서 보내주세요.')
    } catch (e) {
      appendLog(`예외 발생: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
    }
  }

  const appendCaptureLog = (line: string) => setCaptureLog((l) => [...l, line])

  /**
   * 2번째 테스트(2026-09-20) — 원인이 확정된 뒤, 실제 프로덕션 함수
   * (`lib/exportImage.ts`의 `captureThumbnail`, PNG 내보내기와 완전히
   * 같은 파이프라인)를 그대로 호출한다. html-to-image의 `toCanvas`가
   * 내부에서 쓰는 `createImage`는 `decode()` 다음 `requestAnimationFrame`
   * 콜백을 기다리는데, 실기기 진단으로 이 rAF 콜백이 전혀 호출되지 않아
   * 캡처 전체가 멈추는 걸 확인했다(Chromium에서도 재현) — `exportImage.ts`를
   * html-to-image의 `toSvg`(안정적으로 확인됨)까지만 쓰고, 그 결과를
   * 이미지로 불러와 캔버스에 그리는 마지막 단계는 rAF 없이 `decode()`만
   * 쓰도록 고쳤다. 결과를 다운로드하지 않고 이 페이지에 바로 띄워서,
   * 파일 앱을 거치지 않고도 피치가 보이는지 눈으로 바로 확인할 수 있다.
   */
  const runFullCaptureTest = async () => {
    setCaptureLog([])
    setCapturedImageUrl(null)
    try {
      const cardNode = pitchWrapRef.current
      if (!cardNode) {
        appendCaptureLog('카드를 못 찾음 — 여기서 중단')
        return
      }
      appendCaptureLog('1. captureThumbnail(실제 프로덕션 함수) 호출 시작…')

      const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15000))
      const result = await Promise.race([captureThumbnail(cardNode, 220, 340), timeout])

      if (result === 'timeout') {
        appendCaptureLog('2. 15초 안에 응답 없음(타임아웃) — 여전히 멈추는 지점이 있음')
        return
      }
      appendCaptureLog(`2. captureThumbnail 성공 (data URL 길이 ${result.length}자)`)
      setCapturedImageUrl(result)
      appendCaptureLog('3. 아래에 캡처된 이미지를 띄웠습니다 — 피치가 보이는지 확인해주세요.')
    } catch (e) {
      appendCaptureLog(`예외 발생: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`)
    }
  }

  if (loadError) return <div style={{ padding: 20 }}>샘플 로드 실패: {loadError}</div>
  if (!analysis) return <div style={{ padding: 20 }}>샘플 불러오는 중…</div>

  const phase = analysis.phases.base

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, color: '#111', background: '#fff', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>전술판 내보내기 진단 (임시)</h1>
      <p style={{ marginBottom: 12 }}>
        아래 피치가 눈에 정상적으로 보이는지 먼저 확인해주세요. 그다음 "진단 실행"을 누르고, 아래 로그
        전체가 화면에 다 나오면 스크린샷해서 보내주세요(스크롤해서 잘린 부분 없이).
      </p>
      <button
        type="button"
        onClick={runDiagnostic}
        style={{ padding: '10px 20px', fontSize: 16, marginBottom: 16 }}
      >
        진단 실행
      </button>
      <div ref={pitchWrapRef} style={{ width: 220, height: 340, marginBottom: 16, border: '1px solid #999' }}>
        <Pitch>
          {phase.opponentPositions?.map((pos, i) => (
            <OpponentNode key={i} slot={i} position={pos} />
          ))}
          {analysis.players.map((player) => {
            const pos = phase.positions.find((p) => p.playerId === player.id)
            if (!pos) return null
            return <PlayerNode key={player.id} player={player} position={pos} />
          })}
        </Pitch>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#eee', padding: 10, borderRadius: 6 }}>
        {log.length > 0 ? log.join('\n') : '(아직 실행 안 함)'}
      </pre>

      <h2 style={{ fontSize: 16, marginTop: 32, marginBottom: 8 }}>테스트 2 — 실제 캡처 전체 파이프라인</h2>
      <p style={{ marginBottom: 12 }}>
        위 테스트가 전부 정상이었다면, 이번엔 실제로 쓰는 캡처 함수(html-to-image)까지 그대로 실행해서
        결과 이미지를 이 페이지에 바로 띄웁니다 — 파일 앱을 열 필요 없이 여기서 바로 피치가 보이는지
        확인할 수 있습니다.
      </p>
      <button
        type="button"
        onClick={runFullCaptureTest}
        style={{ padding: '10px 20px', fontSize: 16, marginBottom: 16 }}
      >
        전체 캡처 테스트 실행
      </button>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#eee', padding: 10, borderRadius: 6, marginBottom: 16 }}>
        {captureLog.length > 0 ? captureLog.join('\n') : '(아직 실행 안 함)'}
      </pre>
      {capturedImageUrl && (
        <div>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>캡처된 이미지 (아래에 피치가 보이나요?):</p>
          <img src={capturedImageUrl} alt="캡처 결과" style={{ maxWidth: '100%', border: '2px solid red' }} />
        </div>
      )}
    </div>
  )
}
