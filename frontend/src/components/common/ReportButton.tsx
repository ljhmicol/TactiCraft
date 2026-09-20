import { Flag } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ReportButtonProps {
  isLoggedIn: boolean
  onReport: (reason: string) => Promise<unknown>
  className?: string
}

/**
 * 신고 버튼(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에 같이"). 분석
 * 상세(ShareView)와 댓글(CommunityComments) 양쪽에서 재사용한다.
 *
 * 클릭하면 사유를 적는 인라인 폼이 펼쳐진다 — CommunityComments의 답글
 * 폼과 같은 패턴이다. window.prompt/confirm 같은 네이티브 다이얼로그
 * 대신 기존 UI를 따랐다(별도 확인 모달 없이 폼 자체가 "정말 신고할지"를
 * 한 번 더 생각하게 만든다).
 *
 * 같은 대상을 이미 신고했으면 서버가 409를 주는데, 그 경우도 "신고
 * 접수됨" 문구로 귀결시킨다 — 이 브라우저 세션 기준으로는 이미 신고
 * 상태라는 사실이 사용자에게 더 유용한 정보이기 때문이다.
 */
export function ReportButton({ isLoggedIn, onReport, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
    return <span className={cn('text-xs text-muted-foreground', className)}>신고 접수됨</span>
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onReport(reason)
      setDone(true)
      setOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDone(true)
      } else {
        setError('신고를 접수하지 못했습니다.')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        disabled={!isLoggedIn}
        title={isLoggedIn ? '신고' : '로그인이 필요합니다'}
        aria-label="신고"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none disabled:opacity-50',
          open && 'text-destructive',
        )}
      >
        <Flag className="h-3.5 w-3.5" />
        신고
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="신고 사유(선택)"
            maxLength={500}
            rows={2}
            disabled={pending}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {pending ? '접수 중…' : '신고하기'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
