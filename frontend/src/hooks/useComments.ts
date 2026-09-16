import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createComment, deleteComment, fetchComments, toggleCommentReaction } from '@/lib/api'

/**
 * 댓글(TO-DO 12번, 커뮤니티) + 대댓글·좋아요/싫어요(TO-DO 54). 읽기는
 * useAnalyses와 달리 로그인 여부와 무관하게 항상 활성화한다 — 공유 링크
 * 방문자 누구나 댓글을 읽을 수 있어야 하기 때문이다(작성·반응만 로그인
 * 필수, 서버가 401로 막는다).
 */
export function useComments(analysisId: number | undefined) {
  return useQuery({
    queryKey: ['comments', analysisId],
    queryFn: () => fetchComments(analysisId!),
    enabled: analysisId !== undefined,
  })
}

/** parentId를 주면 대댓글로 등록된다(TO-DO 54). */
export function useCreateComment(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: number }) =>
      createComment(analysisId, body, parentId),
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

/** 댓글 좋아요/싫어요 토글(TO-DO 54) — 서버가 최신 카운트·내 반응을 같이
 * 돌려주므로 전체 목록을 다시 불러오는 대신 캐시 안의 해당 댓글만 바꿔
 * 끼운다(반응 하나 누를 때마다 댓글 목록 전체를 리페치하면 화면이 깜빡여
 * 입력 중인 답글 textarea까지 초기화될 위험이 있다). */
export function useToggleCommentReaction(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, value }: { commentId: number; value: 'like' | 'dislike' }) =>
      toggleCommentReaction(commentId, value),
    onSuccess: (result, { commentId }) => {
      queryClient.setQueryData(
        ['comments', analysisId],
        (prev: import('@/lib/api').Comment[] | undefined) =>
          prev?.map((c) =>
            c.id === commentId
              ? { ...c, likeCount: result.likeCount, dislikeCount: result.dislikeCount, myReaction: result.myReaction }
              : c,
          ),
      )
    },
  })
}
