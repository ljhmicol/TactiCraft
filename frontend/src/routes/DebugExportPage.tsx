import { useEffect, useRef, useState } from 'react'

import { OpponentNode } from '@/components/pitch/OpponentNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PlayerNode } from '@/components/pitch/PlayerNode'
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

  if (loadError) return <div style={{ padding: 20 }}>샘플 로드 실패: {loadError}</div>
  if (!analysis) return <div style={{ padding: 20 }}>샘플 불러오는 중…</div>

  const phase = analysis.phases.base

  return (
    <div style={{ padding: 20, fontFamily: 'monospace', fontSize: 13, color: '#111' }}>
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
    </div>
  )
}
