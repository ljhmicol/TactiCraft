import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import { LayerToggleChips } from '@/components/editor/LayerToggleChips'
import { hasSeenAdvancedIntro, markAdvancedIntroSeen } from '@/lib/onboardingStorage'

/**
 * "고급 기능" 영역(개선 로드맵 §6.1, 2026-09-20) — 압박·콤팩트니스·오버로드
 * 레이어 칩을 기본 화면에서 접어 둔다. 기존 선수 목록 아코디언
 * (EditorPage.tsx)과 같은 네이티브 `<details>` 패턴을 그대로 재사용했다 —
 * 이 저장소엔 Radix Accordion/Collapsible이 아직 없고, 접힘 UI가 하나 더
 * 필요하다고 새 의존성을 추가할 이유가 없었다.
 *
 * 타임라인(매치 체인징 포인트)은 원래 이 패널 안에 있었지만(2026-09-20),
 * 다음 날 "타임라인만 예전처럼 항상 펼쳐진 상태로" 요청을 받아
 * `EditorPage.tsx`로 빼냈다 — 접힌 걸 못 알아채고 "타임라인이 안 보인다"는
 * 리포트로 이어졌다. 타임라인이 빠지면서, 패널이 닫혀 있는 동안 재생
 * 중지 버튼이 숨어버리는 문제(자동재생 중 닫기 방지 가드가 있었던 이유)도
 * 같이 해소돼 그 가드는 제거했다 — 이 패널에 남은 압박·콤팩트니스·오버로드
 * 칩은 재생 상태와 무관하다.
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

  const handleToggle = (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (!e.currentTarget.open && showIntro) {
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
            압박·콤팩트니스·오버로드 — 경기 흐름을 더 깊이 분석할 때 쓰는 도구입니다. 하나씩 눌러 결과를 확인해보세요.
          </p>
        )}
        <LayerToggleChips hasOpponent={hasOpponent} variant="advanced" />
      </div>
    </details>
  )
}
