import { Keyboard } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: 'Tab / Shift+Tab', desc: '선수·상대 선수 노드 간 이동' },
  { keys: '방향키', desc: '선택된 선수·상대 선수를 세밀하게 이동(1유닛)' },
  { keys: 'Shift + 방향키', desc: '선택된 선수·상대 선수를 크게 이동(5유닛)' },
  { keys: 'Enter / Space', desc: '선택된 선수의 정보 수정 열기(상대 선수는 지원 안 함)' },
  { keys: 'Ctrl/Cmd + Z', desc: '실행 취소' },
  { keys: 'Ctrl/Cmd + Shift + Z', desc: '다시 실행' },
  { keys: '?', desc: '이 도움말 열기·닫기' },
  { keys: 'Esc', desc: '열린 창 닫기' },
]

/**
 * 접근성 5단계(개선 로드맵 §6.4 마지막 항목, 2026-09-22) — 4단계에서 추가한
 * 키보드 조작(방향키 이동 등)을 입력 필드가 아니고서야 직접 시도해보지
 * 않으면 알 방법이 없어서, 목록을 모아 보여주는 도움말을 추가한다.
 *
 * "?" 단축키는 UndoRedoButtons의 Ctrl+Z와 같은 이유로 입력 필드에
 * 포커스가 있을 때는 가로채지 않는다(물음표는 메모·코멘트 같은 텍스트
 * 입력에 흔히 쓰이는 문자라 더 중요하다).
 */
export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isEditable =
        !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isEditable || e.key !== '?') return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 px-2.5"
          aria-label="키보드 단축키 도움말 열기"
          title="키보드 단축키 (?)"
        >
          <Keyboard className="h-4 w-4" />
          단축키
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                {s.keys}
              </dt>
              <dd className="text-right text-muted-foreground">{s.desc}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
