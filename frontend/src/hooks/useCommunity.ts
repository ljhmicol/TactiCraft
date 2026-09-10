import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchCommunityAnalyses, setAnalysisPublic } from '@/lib/api'

const COMMUNITY_KEY = ['community', 'analyses']

/** 커뮤니티 목록(TO-DO 12번 후속) — useComments와 같은 이유로 로그인 여부와
 * 무관하게 항상 조회한다(누구나 둘러볼 수 있어야 "커뮤니티"다). */
export function useCommunityAnalyses() {
  return useQuery({ queryKey: COMMUNITY_KEY, queryFn: fetchCommunityAnalyses })
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
