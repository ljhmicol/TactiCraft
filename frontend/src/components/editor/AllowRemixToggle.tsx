import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useSetAnalysisRemixSettings } from '@/hooks/useCommunity'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

/**
 * 리믹스 허용 토글(개선 로드맵 §7.3) — VisibilitySelect 바로 옆에 둔다.
 * "비공개"일 때는 아무도 이 분석을 볼 수조차 없어 리믹스 여부 자체가
 * 의미 없으므로 숨긴다(VisibilitySelect가 이미 "비공개"면 링크·커뮤니티
 * 공개로 바꾸라고 안내하는 것과 같은 판단).
 */
export function AllowRemixToggle({ analysis }: { analysis: Analysis }) {
  const applyRemixSettings = useAnalysisStore((s) => s.applyRemixSettings)
  const mutation = useSetAnalysisRemixSettings(analysis.id ?? -1)

  if (!analysis.id || (analysis.visibility ?? 'private') === 'private') return null

  const allowRemix = analysis.allowRemix ?? true

  const handleToggle = async () => {
    const next = !allowRemix
    try {
      await mutation.mutateAsync(next)
      applyRemixSettings(next)
      toast({ description: next ? '다른 사람이 리믹스할 수 있습니다.' : '리믹스를 막았습니다.' })
    } catch {
      toast({ variant: 'destructive', description: '리믹스 설정을 바꾸지 못했습니다.' })
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleToggle}
      disabled={mutation.isPending}
      title="다른 사람이 이 분석을 자기 분석으로 복제(리믹스)할 수 있는지 정합니다"
    >
      {mutation.isPending ? '변경 중…' : allowRemix ? '리믹스 허용' : '리믹스 금지'}
    </Button>
  )
}
