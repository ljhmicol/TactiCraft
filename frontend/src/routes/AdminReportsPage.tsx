import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/useAuth'
import { useOpenReports, useResolveReport } from '@/hooks/useModeration'
import { deleteComment, setAnalysisVisibility } from '@/lib/api'

/**
 * 운영자 신고함(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에 같이").
 *
 * 이 라우트 자체는 App.tsx에서 보호하지 않는다 — 실질적인 권한 경계는
 * 서버에 있다(auth.require_admin, config.py의 admin_emails). 비운영자가
 * URL을 직접 열면 아래 목록 조회가 403으로 실패해 안내 문구만 보인다.
 * user?.isAdmin은 화면을 미리 정리해 보여주는 용도일 뿐이다.
 *
 * "차단" 조치는 새 엔드포인트가 아니라 기존 setAnalysisVisibility(공개
 * 범위 변경)·deleteComment(댓글 삭제)를 그대로 재사용한다 — 운영자에게는
 * 두 엔드포인트 모두 소유자가 아니어도 허용되도록 백엔드가 이미 바뀌어
 * 있다(routers/analyses.py, routers/comments.py 참조). 조치 후에는 같은
 * 신고를 "해결"로 표시해 목록에서 뺀다.
 */
export function AdminReportsPage() {
  const { user, isLoggedIn, isChecking } = useCurrentUser()
  const { data: reports, isLoading, isError } = useOpenReports()
  const resolveMutation = useResolveReport()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<number | null>(null)

  if (isChecking) return null
  if (!isLoggedIn) return <div className="p-6 text-muted-foreground">로그인이 필요합니다.</div>
  if (user && !user.isAdmin) return <div className="p-6 text-destructive">운영자만 볼 수 있는 페이지입니다.</div>
  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중…</div>
  if (isError) {
    return <div className="p-6 text-destructive">신고 목록을 불러오지 못했습니다. 운영자 계정으로 로그인했는지 확인하세요.</div>
  }

  const handleHideAnalysis = async (reportId: number, analysisId: number) => {
    setActingId(reportId)
    setActionError(null)
    try {
      await setAnalysisVisibility(analysisId, 'private')
      await resolveMutation.mutateAsync(reportId)
      queryClient.invalidateQueries({ queryKey: ['community', 'analyses'] })
      queryClient.invalidateQueries({ queryKey: ['analyses', analysisId] })
    } catch {
      setActionError('분석을 비공개로 전환하지 못했습니다.')
    } finally {
      setActingId(null)
    }
  }

  const handleDeleteComment = async (reportId: number, commentId: number) => {
    setActingId(reportId)
    setActionError(null)
    try {
      await deleteComment(commentId)
      await resolveMutation.mutateAsync(reportId)
    } catch {
      setActionError('댓글을 삭제하지 못했습니다.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-foreground">신고함</h1>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      {reports && reports.length === 0 && <p className="text-sm text-muted-foreground">처리할 신고가 없습니다.</p>}
      <ul className="flex flex-col gap-3">
        {reports?.map((r) => (
          <li key={r.id} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {r.targetType === 'analysis' ? '분석' : '댓글'} · {r.reporterUsername}님 신고
              </span>
              <span>{r.createdAt.replace('T', ' ')}</span>
            </div>
            <p className="text-sm text-foreground">{r.targetPreview ?? '(이미 삭제된 대상)'}</p>
            {r.reason && <p className="mt-1 text-sm text-muted-foreground">사유: {r.reason}</p>}
            <div className="mt-2 flex justify-end gap-2">
              {r.targetType === 'analysis' && r.targetPreview && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={actingId === r.id}
                  onClick={() => handleHideAnalysis(r.id, r.targetId)}
                >
                  비공개로 전환
                </Button>
              )}
              {r.targetType === 'comment' && r.targetPreview && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={actingId === r.id}
                  onClick={() => handleDeleteComment(r.id, r.targetId)}
                >
                  댓글 삭제
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={resolveMutation.isPending}
                onClick={() => resolveMutation.mutate(r.id)}
              >
                조치 없이 해결
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
