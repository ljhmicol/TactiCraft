import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 지금 보이는 곳(국면 또는 타임라인 체인징 포인트)의 코멘트 + 종합 평가
 * (FR-04, TO-DO 5번). 제목이 그 이름을 따라 바뀐다 — 어디에 쓰는 중인지
 * 헷갈리는 것이 가장 흔한 실수다 (2단계 §11.1).
 */
export function CommentPanel({
  title,
  comment,
  summary,
}: {
  title: string
  comment: string
  summary: string
}) {
  const setComment = useAnalysisStore((s) => s.setComment)
  const setSummary = useAnalysisStore((s) => s.setSummary)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="phase-comment">{title} 코멘트</Label>
        <Textarea id="phase-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      </div>
      <div>
        <Label htmlFor="summary">종합 평가</Label>
        <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
      </div>
    </div>
  )
}
