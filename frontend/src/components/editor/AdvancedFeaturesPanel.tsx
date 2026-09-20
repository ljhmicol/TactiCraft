import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import { LayerToggleChips } from '@/components/editor/LayerToggleChips'
import { Timeline } from '@/components/editor/Timeline'
import { toast } from '@/hooks/use-toast'
import { hasSeenAdvancedIntro, markAdvancedIntroSeen } from '@/lib/onboardingStorage'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * "고급 기능" 영역(개선 로드맵 §6.1, 2026-09-20) — 타임라인(매치 체인징
 * 포인트)·압박·콤팩트니스·오버로드를 기본 화면에서 접어 둔다. 기존
 * 선수 목록 아코디언(EditorPage.tsx)과 같은 네이티브 `<details>` 패턴을
 * 그대로 재사용했다 — 이 저장소엔 Radix Accordion/Collapsible이 아직 없고,
 * 접힘 UI가 하나 더 필요하다고 새 의존성을 추가할 이유가 없었다.
 *
 * 기본 닫힘 상태다. `<details>`가 닫혀 있어도 내용물은 DOM에서 사라지지
 *않고 `display:none`으로만 숨겨진다 — 그래서 타임라인에서 이미 선택된
 * 체인징 포인트가 있으면(스토어 상태) 패널이 닫혀 있어도 피치는 계속 그
 * 스냅샷을 보여준다(EditorPage의 `selectedChangingPointId` 로직은 이
 * 패널의 열림 여부와 무관하게 그대로 동작한다). 단순히 시점 하나를 골라
 * 보는 것뿐이면 국면 탭(PhaseTabs, 이 패널 바깥에 항상 보임)을 눌러
 * 언제든 빠져나올 수 있다 — `switchPhase`가 `selectedChangingPointId`를
 * 같이 지운다(analysisStore.ts).
 *
 * 문제는 "자동재생 중"이다 — `display:none`이어도 setInterval은 계속
 * 돌기 때문에, 패널을 접어 정지 버튼을 숨겨버리면 재생을 멈출 방법이
 * 없어진다(2026-09-20, advisor 리뷰로 발견). 그래서 타임라인 자동재생
 * (`timelineAutoplay`)이나 병합 시점 재생(`mergedStepIndex`)이 진행 중인
 * 동안은 패널을 닫지 못하게 막는다 — 닫기 시도를 즉시 되돌리고 토스트로
 * 이유를 알린다.
 *
 * 처음 펼쳤을 때만 짧은 설명을 보여준다 — 다시 펼쳐도 두 번째부터는 안
 * 보인다(`onboardingStorage.ts`의 localStorage 플래그, draftStorage와
 * 같은 패턴). "봤다"로 표시하는 시점은 **닫힐 때**다 — 여는 순간 바로
 * 표시해버리면 state 갱신·리렌더가 같은 이벤트 처리 중에 끝나버려 설명이
 * 뜨자마자 사라지는 깜빡임이 생긴다. 열려 있는 동안은 계속 보이다가, 그
 * 패널을 닫을 때 비로소 "이번에 봤다"로 기록해 다음부터는 안 보이게 한다.
 */
export function AdvancedFeaturesPanel({ hasOpponent }: { hasOpponent: boolean }) {
  const [showIntro, setShowIntro] = useState(() => !hasSeenAdvancedIntro())
  const timelineAutoplay = useAnalysisStore((s) => s.timelineAutoplay)
  const isReplayingMerged = useAnalysisStore((s) => s.mergedStepIndex !== null)

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) return
    if (timelineAutoplay || isReplayingMerged) {
      e.currentTarget.open = true
      toast({ description: '재생 중에는 고급 기능 패널을 접을 수 없습니다. 먼저 재생을 멈춰주세요.' })
      return
    }
    if (showIntro) {
      markAdvancedIntroSeen()
      setShowIntro(false)
    }
  }

  return (
    <details className="group w-full max-w-md rounded-md border border-border" onToggle={handleToggle}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md p-3 text-sm font-semibold text-foreground hover:bg-secondary [&::-webkit-details-marker]:hidden">
        <span>고급 기능</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 px-3 pb-3">
        {showIntro && (
          <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            타임라인(매치 체인징 포인트)·압박·콤팩트니스·오버로드 — 경기 흐름을 더 깊이 분석할 때 쓰는 도구입니다.
            하나씩 눌러 결과를 확인해보세요.
          </p>
        )}
        <Timeline />
        <LayerToggleChips hasOpponent={hasOpponent} variant="advanced" />
      </div>
    </details>
  )
}
