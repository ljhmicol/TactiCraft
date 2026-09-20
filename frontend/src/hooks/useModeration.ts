import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchOpenReports, reportAnalysis, reportComment, resolveReport } from '@/lib/api'

const REPORTS_KEY = ['moderation', 'reports']

/** 운영자 전용 신고 목록(개선 로드맵 §5.5). 비운영자가 호출하면 서버가
 * 403을 준다 — AdminReportsPage는 이 훅의 에러를 안내 문구로 보여줄 뿐,
 * 실제 접근 제어는 서버에 있다. */
export function useOpenReports() {
  return useQuery({ queryKey: REPORTS_KEY, queryFn: fetchOpenReports })
}

export function useResolveReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reportId: number) => resolveReport(reportId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY }),
  })
}

export function useReportAnalysis() {
  return useMutation({
    mutationFn: ({ analysisId, reason }: { analysisId: number; reason?: string }) =>
      reportAnalysis(analysisId, reason),
  })
}

export function useReportComment() {
  return useMutation({
    mutationFn: ({ commentId, reason }: { commentId: number; reason?: string }) =>
      reportComment(commentId, reason),
  })
}
