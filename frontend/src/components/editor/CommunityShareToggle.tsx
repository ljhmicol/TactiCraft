import { Button } from '@/components/ui/button'
import { useSetAnalysisPublic } from '@/hooks/useCommunity'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

/**
 * 커뮤니티(/community) 공개 토글(TO-DO 12번 후속). ShareLinkButton과 같이
 * "저장된 분석만"(analysis.id 존재) 대상이다 — 저장 전 임시 상태를 공개
 * 목록에 올릴 방법이 없다. 전체 저장(PUT)과 별개인 전용 PATCH를 쓴다
 * (`useSetAnalysisPublic`) — 에디터에 남은 다른 미저장 변경과 뒤섞이지
 * 않게 이 필드 하나만 서버에 반영한다.
 *
 * 성공하면 스토어의 `analysis.isPublic`도 즉시 갱신한다(`applyPublicFlag`)
 * — EditorPage가 React Query가 아니라 스토어에서 analysis를 읽으므로,
 * 캐시 무효화만으로는 이 버튼 자신의 라벨이 안 바뀐다.
 */
export function CommunityShareToggle({ analysis }: { analysis: Analysis }) {
  const applyPublicFlag = useAnalysisStore((s) => s.applyPublicFlag)
  const toggleMutation = useSetAnalysisPublic(analysis.id ?? -1)

  if (!analysis.id) {
    return (
      <Button size="sm" variant="outline" disabled title="먼저 저장해야 커뮤니티에 공유할 수 있습니다">
        커뮤니티에 공유
      </Button>
    )
  }

  const isPublic = Boolean(analysis.isPublic)

  const handleToggle = async () => {
    const next = !isPublic
    await toggleMutation.mutateAsync(next)
    applyPublicFlag(next)
  }

  return (
    <Button
      size="sm"
      variant={isPublic ? 'default' : 'outline'}
      onClick={handleToggle}
      disabled={toggleMutation.isPending}
      title={isPublic ? '커뮤니티 목록에서 내립니다' : '커뮤니티 목록에 올립니다 — 누구나 보고 댓글을 남길 수 있습니다'}
    >
      {toggleMutation.isPending ? '변경 중…' : isPublic ? '커뮤니티에 공유됨 ✓' : '커뮤니티에 공유'}
    </Button>
  )
}
