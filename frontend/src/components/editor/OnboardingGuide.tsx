import { X } from 'lucide-react'
import { useState } from 'react'

import { dismissOnboarding, isOnboardingDismissed } from '@/lib/onboardingStorage'
import { cn } from '@/lib/utils'

const STEPS = [
  '선수를 드래그해 기본 배치를 만드세요',
  '화살표 도구로 패스·움직임을 그려보세요',
  '공격·수비 탭에서 국면별로 다른 배치를 만들어보세요',
  '저장하고 공유 링크로 공유해보세요',
]

/**
 * 최초 사용자 가이드(개선 로드맵 §6.1, 2026-09-20). 저장 전(id 없음)
 * 새 분석에서만 보이고, 닫으면 이 브라우저에서 다시 뜨지 않는다(draftStorage
 * 와 같은 localStorage 패턴, `onboardingStorage.ts`) — "최초 사용자"를
 * 안내하는 게 목적이라 한 번 보면 충분하고, 매 분석마다 다시 뜨면 반복
 * 사용자에게는 잡음이다.
 *
 * 진행 상황을 실시간으로 체크하지는 않는다(예: "1번을 완료했다"를 감지해
 * 체크 표시하는 것) — 무엇을 "완료"로 볼지 애매한 항목이 많고(예: "국면별로
 * 다른 배치를 만들었다"를 어떻게 판정할지), 잘못 판정하면 안내가 오히려
 * 혼란을 준다. 4단계를 정적 목록으로 보여주는 것만으로 로드맵의 "네 단계로
 * 안내한다"는 요구를 충족한다고 판단했다.
 */
export function OnboardingGuide({ className }: { className?: string }) {
  const [dismissed, setDismissed] = useState(() => isOnboardingDismissed())

  if (dismissed) return null

  const handleDismiss = () => {
    dismissOnboarding()
    setDismissed(true)
  }

  return (
    <div className={cn('rounded-md border border-dashed border-border bg-muted/30 p-4', className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">시작 가이드</p>
        <button
          type="button"
          aria-label="가이드 닫기"
          title="가이드 닫기"
          onClick={handleDismiss}
          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-2">
            <span className="shrink-0 text-foreground">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
