import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createComment, deleteComment, fetchComments } from '@/lib/api'

/**
 * 댓글(TO-DO 12번, 커뮤니티) — 분석 전체 하나에 붙는 평평한 목록. 읽기는
 * useAnalyses와 달리 로그인 여부와 무관하게 항상 활성화한다 — 공유 링크
 * 방문자 누구나 댓글을 읽을 수 있어야 하기 때문이다(작성만 로그인 필수,
 * 서버가 401로 막는다).
 */
export function useComments(analysisId: number | undefined) {
  return useQuery({
    queryKey: ['comments', analysisId],
    queryFn: () => fetchComments(analysisId!),
    enabled: analysisId !== undefined,
  })
}

export function useCreateComment(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => createComment(analysisId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', analysisId] })
    },
  })
}

export function useDeleteComment(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commentId: number) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', analysisId] })
    },
  })
}
