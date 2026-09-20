import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchCommunityAnalyses, setAnalysisVisibility, toggleLike } from '@/lib/api'
import type { Visibility } from '@/types/analysis'

const COMMUNITY_KEY = ['community', 'analyses']

/** 커뮤니티 목록(TO-DO 12번 후속) — useComments와 같은 이유로 로그인 여부와
 * 무관하게 항상 조회한다(누구나 둘러볼 수 있어야 "커뮤니티"다). sort(TO-DO
 * 41 후속)별로 쿼리 키를 나눠서 최신순↔인기순을 오갈 때 서로 캐시를
 * 덮어쓰지 않고 각자 캐시된다(둘 다 자주 왕복할 만한 토글이라 재요청 없이
 * 즉시 전환되는 게 자연스럽다). */
export function useCommunityAnalyses(sort: 'recent' | 'popular' = 'recent') {
  return useQuery({ queryKey: [...COMMUNITY_KEY, sort], queryFn: () => fetchCommunityAnalyses(sort) })
}

/** 좋아요 토글(TO-DO 41 후속) — 커뮤니티 목록 카드와 공유 링크 상세
 * 화면(/share/:id·/s/:token, TO-DO 58) 양쪽에서 같이 쓴다. 성공하면 커뮤니티
 * 목록(정렬 무관 전부)을 무효화한다 — 인기순 정렬 중이면 순서 자체가
 * 바뀔 수 있어서 부분 갱신 대신 다시 불러오는 쪽이 안전하다. 이 분석의
 * 상세 캐시(analyses/:id)도 같이 무효화해야 SharePage의 좋아요 버튼·
 * 카운트가 즉시 갱신된다 — setAnalysisVisibility와 같은 이유. `['share']`도
 * 같이 무효화한다(두 번째 인자 token 없이 접두어로) — 링크 공개
 * 페이지(/s/:token, useSharedAnalysis)는 analysisId가 아니라 token으로
 * 캐시되므로 위 두 무효화만으론 그 화면의 하트가 안 갱신된다. */
export function useToggleLike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (analysisId: number) => toggleLike(analysisId),
    onSuccess: (_result, analysisId) => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY })
      queryClient.invalidateQueries({ queryKey: ['analyses', analysisId] })
      queryClient.invalidateQueries({ queryKey: ['share'] })
    },
  })
}

/** 에디터의 공개 범위 선택(개선 로드맵 §5.2)이 쓴다. 성공하면 커뮤니티
 * 목록과 이 분석의 상세 캐시(analyses/:id) 둘 다 무효화한다 — 목록에 새로
 * 들어가거나 빠지는 것과, 선택 UI 자신이 보여주는 현재 상태 둘 다
 * 갱신돼야 한다. */
export function useSetAnalysisVisibility(analysisId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (visibility: Visibility) => setAnalysisVisibility(analysisId, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEY })
      queryClient.invalidateQueries({ queryKey: ['analyses', analysisId] })
    },
  })
}
