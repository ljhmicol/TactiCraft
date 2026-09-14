import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface InfoDialogButtonProps {
  title: string
  ariaLabel: string
  color?: string
  children: ReactNode
}

/**
 * "가중점수 옆에 버튼을 하나 만들어서 그 원리를 설명해주는 창을 하나
 * 만들자. 키포인트 포지션에도 버튼을 만들어서..."(TO-DO 46) — 위협 가중
 * 점수(TO-DO 45)와 키포인트 배지(KeyZoneCallout) 둘 다 "왜 이 숫자가
 * 나왔는지"를 짧은 한 줄로는 설명 못 해서 필요해진, 두 곳이 공유하는 작은
 * 안내 버튼 + 모달. 여기 들어가는 설명 텍스트는 매번 렌더링 시점에 현재
 * 좌표·구역으로 다시 계산한 값일 뿐 DB에 저장되는 커뮤니티 댓글이 아니다
 * (AdvantageBadge·KeyZoneCallout 호출부 참조).
 */
export function InfoDialogButton({ title, ariaLabel, color, children }: InfoDialogButtonProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={color ? { color } : undefined}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
