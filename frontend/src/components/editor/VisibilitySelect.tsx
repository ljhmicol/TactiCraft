import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSetAnalysisVisibility } from '@/hooks/useCommunity'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis, Visibility } from '@/types/analysis'

const LABELS: Record<Visibility, string> = {
  private: '비공개',
  link: '링크 공개',
  community: '커뮤니티 공개',
}

/**
 * 공개 범위 선택(2026-09-18, 개선 로드맵 §5.2) — 기존 CommunityShareToggle의
 * 이진(공개/비공개) 토글을 3단계로 대체한다. "비공개"만으로는 순차 id
 * 스캔으로 새던 실제 취약점이 있었고(백엔드 analyses.py 참조), "링크만 아는
 * 사람에게 공유"라는 중간 단계가 아예 없었다.
 *
 * ShareLinkButton과 같이 "저장된 분석만"(analysis.id 존재) 대상이다 — 저장
 * 전 임시 상태를 공개 범위를 가질 방법이 없다. 전체 저장(PUT)과 별개인
 * 전용 PATCH를 쓴다(`useSetAnalysisVisibility`) — 에디터에 남은 다른
 * 미저장 변경과 뒤섞이지 않게 이 필드 하나만 서버에 반영한다.
 *
 * 성공하면 스토어의 `analysis.visibility`도 즉시 갱신한다(`applyVisibility`)
 * — EditorPage가 React Query가 아니라 스토어에서 analysis를 읽으므로,
 * 캐시 무효화만으로는 이 선택 UI 자신의 값이 안 바뀐다.
 */
export function VisibilitySelect({ analysis }: { analysis: Analysis }) {
  const applyVisibility = useAnalysisStore((s) => s.applyVisibility)
  const mutation = useSetAnalysisVisibility(analysis.id ?? -1)

  if (!analysis.id) {
    return (
      <Button size="sm" variant="outline" disabled title="먼저 저장해야 공개 범위를 바꿀 수 있습니다">
        비공개
      </Button>
    )
  }

  const visibility = analysis.visibility ?? 'private'

  const handleChange = async (next: Visibility) => {
    if (next === visibility) return
    await mutation.mutateAsync(next)
    applyVisibility(next)
  }

  return (
    <Select value={visibility} onValueChange={(v) => void handleChange(v as Visibility)} disabled={mutation.isPending}>
      <SelectTrigger className="w-32" title="누가 이 분석을 볼 수 있는지 정합니다">
        <SelectValue>{mutation.isPending ? '변경 중…' : LABELS[visibility]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="private">비공개</SelectItem>
        <SelectItem value="link">링크 공개</SelectItem>
        <SelectItem value="community">커뮤니티 공개</SelectItem>
      </SelectContent>
    </Select>
  )
}
