import { useState } from 'react'
import type { RefObject } from 'react'

import { GifExportRunner } from '@/components/export/GifExportRunner'
import { MultiPhaseShareCard } from '@/components/export/MultiPhaseShareCard'
import { ShareCard } from '@/components/export/ShareCard'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CardRatio } from '@/hooks/useCardExport'
import type { Analysis, PhaseType } from '@/types/analysis'

// lib/exportImage.ts의 exportCard와 같은 이유로 문서에 붙였다 떼고, revoke를
// 미룬다(advisor 리뷰로 발견 — Safari에서 클릭 직후 바로 revoke하면 아직
// 시작도 안 한 다운로드가 레이스로 끊길 수 있다, 2026-09-20).
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * PNG·GIF 카드 내보내기 UI. 비율(1:1/4:5)은 PNG 전용 — GIF는 프레임을
 * 수십 장 인코딩해야 해서 1:1 정사각형 하나로 범위를 좁혔다(TO-DO 6번).
 * 하단 텍스트는 국면별로 다르다 — 기본은 종합 평가, 공격·수비는 해당
 * 국면 코멘트.
 *
 * GIF는 PNG처럼 ref 하나를 한 번 캡처하는 게 아니라 프레임마다 다시
 * 렌더링→캡처해야 해서(GifExportRunner) 버튼을 누른 시점에만 그 러너를
 * 마운트하고, 다 끝나면(onDone/onError) 언마운트한다.
 *
 * PNG 쪽 상태(ratio·exporting·cardRef·handleExport)는 2026-09-20(개선
 * 로드맵 §6.2)부터 이 컴포넌트가 직접 갖지 않고 `useCardExport`를 호출한
 * `EditorPage`에서 props로 받는다 — 모바일 하단 시트(BottomActionBar)도
 * 같은 캡처 대상을 트리거해야 하는데, `ShareCard`(아래)는 두 번 마운트하면
 * 안 되므로 한 곳(여기)에만 마운트하고 상태만 공유한다. GIF는 로드맵
 * 범위가 PNG만이라 이 컴포넌트에 로컬로 남겨뒀다.
 */
export function ExportControls({
  analysis,
  phase,
  ratio,
  setRatio,
  exporting,
  onExport,
  cardRef,
  multiPhaseExporting,
  onMultiPhaseExport,
  multiPhaseCardRef,
}: {
  analysis: Analysis
  phase: PhaseType
  ratio: CardRatio
  setRatio: (r: CardRatio) => void
  exporting: boolean
  onExport: () => Promise<void>
  cardRef: RefObject<HTMLDivElement>
  multiPhaseExporting: boolean
  onMultiPhaseExport: () => Promise<void>
  multiPhaseCardRef: RefObject<HTMLDivElement>
}) {
  const [exportingGif, setExportingGif] = useState(false)
  const [gifRunning, setGifRunning] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)

  const handleGifExport = () => {
    setGifError(null)
    setExportingGif(true)
    setGifRunning(true)
  }

  const handleGifDone = (blob: Blob) => {
    downloadBlob(blob, `tacticore_${Date.now()}.gif`)
    setGifRunning(false)
    setExportingGif(false)
  }

  const handleGifError = (err: unknown) => {
    console.error('GIF 내보내기 실패', err)
    setGifError(err instanceof Error ? err.message : 'GIF 내보내기에 실패했습니다.')
    setGifRunning(false)
    setExportingGif(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={ratio} onValueChange={(v) => setRatio(v as CardRatio)}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1:1">1:1</SelectItem>
            <SelectItem value="4:5">4:5</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={onExport} disabled={exporting}>
          {exporting ? '내보내는 중…' : 'PNG 내보내기'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleGifExport} disabled={exportingGif}>
          {exportingGif ? 'GIF 만드는 중…' : 'GIF 내보내기'}
        </Button>
        <Button size="sm" variant="outline" onClick={onMultiPhaseExport} disabled={multiPhaseExporting}>
          {multiPhaseExporting ? '내보내는 중…' : '3국면 한번에 PNG'}
        </Button>
      </div>
      {gifError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{gifError}</p>}

      <ShareCard ref={cardRef} analysis={analysis} phase={phase} ratio={ratio} />
      <MultiPhaseShareCard ref={multiPhaseCardRef} analysis={analysis} />
      {gifRunning && <GifExportRunner analysis={analysis} onDone={handleGifDone} onError={handleGifError} />}
    </div>
  )
}
