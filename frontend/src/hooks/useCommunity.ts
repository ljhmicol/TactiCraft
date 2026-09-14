import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchCommunityAnalyses, setAnalysisPublic, toggleLike } from '@/lib/api'

const COMMUNITY_KEY = ['community', 'analyses']

/** 커뮤니티 목록(TO-DO 12번 후속) — useComments와 같은 이유로 로그인 여부와
 * 무관하게 항상 조회한다(누구나 둘러볼 수 있어야 "커뮤니티"다). sort(TO-DO
 * 41 후속)별로 쿼리 키를 나눠서 최신순↔인기순을 오갈 때 서로 캐시를
 * 덮어쓰지 않고 각자 캐시된다(둘 다 자주 왕복할 만한 토글이라 재요청 없이
 * 즉시 전환되는 게 자연스럽다). */
export function useCommunityAnalyses(sort: 'recent' | 'popular' = 'recent') {
  return useQuery({ queryKey: [...COMMUNITY_KEY, sort], queryFn: () => fetchCommunityAnalyses(sort) })
}

/** 좋아요 토글(TO-DO 41 후속). 성공하면 커뮤니티 목록(정렬 무관 전부)을
 * 무효화한다 — 인기순 정렬 중이면 순서 자체가 바뀔 수 있어서 부분 갱신
 * 대신 다시 불러오는 쪽이 안전하다. */
export function useToggleLike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (analysisId: number) => toggleLike(analysisId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY })
    },
  })
}

/** 에디터의 "커뮤니티에 공유" 토글이 쓴다. 성공하면 커뮤니티 목록과 이
 * 분석의 상세 캐시(analyses/:id) 둘 다 무효화한다 — 목록에 새로 들어가거나
 * 빠지는 것과, 토글 버튼 자신이 보여주는 현재 상태 둘 다 갱신돼야 한다. */
export function useSetAnalysisPublic(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (isPublic: boolean) => setAnalysisPublic(analysisId, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY })
      queryClient.invalidateQueries({ queryKey: ['analyses', analysisId] })
    },
  })
}
