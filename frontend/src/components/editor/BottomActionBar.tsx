import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useState } from 'react'

import { SaveButton } from '@/components/editor/SaveButton'
import { Button } from '@/components/ui/button'
import type { CardRatio } from '@/hooks/useCardExport'
import { cn } from '@/lib/utils'
import type { Analysis } from '@/types/analysis'

/**
 * 모바일 전용 하단 고정 액션 바 (2단계 §11.2) — `[저장] [PNG 내보내기]`.
 *
 * 예전엔 PNG 버튼이 실제로 내보내지 않고 헤더 툴바(ExportControls)로
 * 스크롤만 시켰다 — ShareCard(캡처 대상)를 두 번 마운트하지 않으려는
 * 절충이었는데, 개선 로드맵 §6.2(2026-09-20)가 "버튼이 실제로 동작해야
 * 한다"고 지목했다. `EditorPage`가 `useCardExport`를 한 번만 호출해
 * ExportControls·여기 둘 다에 같은 상태(ratio·cardRef·handleExport)를
 * 내려주므로, ShareCard는 여전히 ExportControls 한 곳에만 마운트된 채로
 * 이 바텀 시트에서도 같은 캡처를 트리거할 수 있다.
 *
 * 범위 선택(현재 국면/3국면 한번에)은 ExportControls와 같은 이유로
 * 추가했다(2026-09-23) — 3국면 카드도 `EditorPage`의 `useMultiPhaseExport`
 * 한 곳에서만 마운트되므로(ExportControls 쪽), 여기서는 상태와 트리거
 * 함수만 받는다.
 */
export function BottomActionBar({
  analysis,
  ratio,
  setRatio,
  exporting,
  onExport,
  multiPhaseExporting,
  onMultiPhaseExport,
}: {
  analysis: Analysis
  ratio: CardRatio
  setRatio: (r: CardRatio) => void
  exporting: boolean
  onExport: () => Promise<void>
  multiPhaseExporting: boolean
  onMultiPhaseExport: () => Promise<void>
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [scope, setScope] = useState<'current' | 'all'>('current')

  const generating = scope === 'current' ? exporting : multiPhaseExporting

  const handleGenerate = async () => {
    // onExport/onMultiPhaseExport는 실패를 내부에서 삼키고 토스트로 원인을
    // 보여준다(2026-09-20) — 여기선 성공/실패와 무관하게 시트만 닫으면 된다.
    if (scope === 'current') await onExport()
    else await onMultiPhaseExport()
    setSheetOpen(false)
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 border-t border-border bg-background p-3 lg:hidden">
        <SaveButton analysis={analysis} />
        <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
          PNG 내보내기
        </Button>
      </div>

      <DialogPrimitive.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl border-t border-border bg-background p-4 pb-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom">
            <DialogPrimitive.Title className="mb-3 text-sm font-semibold text-foreground">
              PNG로 내보내기
            </DialogPrimitive.Title>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([
                { value: 'current' as const, label: '현재 국면' },
                { value: 'all' as const, label: '3국면 한번에' },
              ]).map((opt) => (
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
              <div className="mb-3 flex items-center gap-2">
                {(['1:1', '4:5'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRatio(r)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      ratio === r
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={handleGenerate} disabled={generating}>
              {generating ? '내보내는 중…' : 'PNG 생성'}
            </Button>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
