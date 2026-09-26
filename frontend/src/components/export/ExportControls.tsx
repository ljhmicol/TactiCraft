import { useState } from 'react'
import type { RefObject } from 'react'

import { GifExportRunner } from '@/components/export/GifExportRunner'
import { MultiPhaseShareCard } from '@/components/export/MultiPhaseShareCard'
import { ShareCard } from '@/components/export/ShareCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CardRatio } from '@/hooks/useCardExport'
import { cn } from '@/lib/utils'
import type { Analysis, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }

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
 * PNG·GIF 카드 내보내기 UI. 비율(1:1/4:5/9:16)은 PNG·GIF 공용 — 같은
 * `ratio` 상태를 공유해서(2026-09-26, "GIF도 비율 설정할 수 있으면
 * 좋겠어") 한 번 고르면 PNG와 GIF 둘 다에 적용된다. 하단 텍스트는 국면별로
 * 다르다 — 기본은 종합 평가, 공격·수비는 해당 국면 코멘트.
 *
 * PNG 내보내기는 "범위" 선택이 있다(2026-09-23) — 처음엔 "3국면 한번에
 * PNG"를 별도 버튼으로 뒀는데, 버튼이 하나 더 느는 것보다 기존 PNG
 * 버튼을 누르면 범위(현재 국면 / 3국면 한번에)를 고르는 게 낫다는 사용자
 * 피드백으로 다이얼로그 방식으로 바꿨다. 범위가 "3국면"이면 카드 자체가
 * 고정 크기(MultiPhaseShareCard)라 비율 선택은 의미가 없어서 숨긴다.
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
 * 범위가 PNG만이라 이 컴포넌트에 로컬로 남겨뒀다. 3국면 카드(`multiPhase*`
 * props)도 같은 이유로 `EditorPage`의 `useMultiPhaseExport`에서 내려받는다.
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
  const [pngDialogOpen, setPngDialogOpen] = useState(false)
  const [gifDialogOpen, setGifDialogOpen] = useState(false)
  const [scope, setScope] = useState<'current' | 'all'>('current')

  const handleGifExport = () => {
    setGifDialogOpen(false)
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

  const generating = scope === 'current' ? exporting : multiPhaseExporting

  const handleGenerate = async () => {
    if (scope === 'current') await onExport()
    else await onMultiPhaseExport()
    setPngDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Dialog open={pngDialogOpen} onOpenChange={setPngDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">PNG 내보내기</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>PNG로 내보내기</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'current' as const, label: `현재 국면 (${PHASE_LABELS[phase]})` },
                    { value: 'all' as const, label: '3국면 한번에' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      scope === opt.value
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {scope === 'current' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">비율</span>
                  <Select value={ratio} onValueChange={(v) => setRatio(v as CardRatio)}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="4:5">4:5</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? '내보내는 중…' : 'PNG 생성'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={gifDialogOpen} onOpenChange={setGifDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={exportingGif}>
              {exportingGif ? 'GIF 만드는 중…' : 'GIF 내보내기'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>GIF로 내보내기</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'current' as const, label: `현재 국면 (${PHASE_LABELS[phase]})` },
                    { value: 'all' as const, label: '3국면 한번에' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setScope(opt.value)}
                    className={cn(
                      'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      scope === opt.value
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">비율</span>
                <Select value={ratio} onValueChange={(v) => setRatio(v as CardRatio)}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="4:5">4:5</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleGifExport} disabled={exportingGif}>
                GIF 생성
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {gifError && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{gifError}</p>}

      <ShareCard ref={cardRef} analysis={analysis} phase={phase} ratio={ratio} />
      <MultiPhaseShareCard ref={multiPhaseCardRef} analysis={analysis} />
      {gifRunning && (
        <GifExportRunner
          analysis={analysis}
          ratio={ratio}
          scope={scope === 'all' ? 'all' : phase}
          onDone={handleGifDone}
          onError={handleGifError}
        />
      )}
    </div>
  )
}
