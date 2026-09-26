import { GitFork } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

import { toast } from '@/hooks/use-toast'
import { useCurrentUser } from '@/hooks/useAuth'
import { useRemixAnalysis } from '@/hooks/useCommunity'
import { cn } from '@/lib/utils'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

/**
 * 커뮤니티 리믹스 버튼(개선 로드맵 §7.3) — 공유 링크(/share/:id, /s/:token)
 * 화면의 좋아요·신고 옆에 둔다. 소유자 본인의 글에는 안 보인다(자기 분석은
 * 이미 복제 저장이 있다, 서버도 400으로 막는다) — `allowRemix`가 꺼져 있어도
 * 안 보인다(눌러도 403만 나는 버튼을 굳이 보여줄 필요는 없다는 판단, 원작자는
 * 에디터의 AllowRemixToggle에서 이미 그 사실을 안다).
 *
 * 성공하면 새로 만들어진 사본을 에디터 스토어에 얹고(`loadAnalysis`) 곧장
 * 편집기로 이동한다 — ManagerPresetPicker 등 `/new`의 다른 선택지들과 같은
 * "고르면 바로 편집 시작" 흐름이다. 지금 편집기에 저장 안 한 변경이 남아
 * 있으면(NewAnalysisPage와 같은 이유) 한 번 확인한다.
 */
export function RemixButton({ analysis, className }: { analysis: Analysis; className?: string }) {
  const { isLoggedIn } = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const loadAnalysis = useAnalysisStore((s) => s.loadAnalysis)
  const isDirty = useAnalysisStore((s) => s.isDirty)
  const remixMutation = useRemixAnalysis()

  if (analysis.isOwner || analysis.id === undefined || !(analysis.allowRemix ?? true)) return null

  const handleClick = async () => {
    // handleLikeClick(SharePage)과 같은 이유·같은 패턴.
    if (!isLoggedIn) {
      toast({ description: '리믹스하려면 로그인이 필요합니다.' })
      navigate('/login', { state: { from: location } })
      return
    }
    if (isDirty && !window.confirm('편집기에 저장하지 않은 변경사항이 있습니다. 리믹스하면 사라집니다. 계속할까요?')) {
      return
    }
    try {
      const remixed = await remixMutation.mutateAsync(analysis.id as number)
      loadAnalysis(remixed)
      navigate('/')
    } catch {
      // useRemixAnalysis의 onError가 이미 토스트로 알렸다 — 여기서는 조용히
      // 삼켜서(실패 시 loadAnalysis·navigate로 이어지지 않게만 막는다)
      // 처리되지 않은 프라미스 거부로 남지 않게 한다.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={remixMutation.isPending}
      title={isLoggedIn ? '이 전술을 복제해서 내 분석으로 편집을 시작합니다' : '로그인이 필요합니다'}
      className={cn(
        'flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none disabled:opacity-50',
        className,
      )}
    >
      <GitFork className="h-4 w-4" />
      {remixMutation.isPending ? '리믹스 중…' : '리믹스'}
    </button>
  )
}
