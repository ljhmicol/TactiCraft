import { useQuery } from '@tanstack/react-query'

import { fetchHealth } from '@/lib/api'

/**
 * 서버 미기동을 감지한다 (FR-08 폴백). 서버가 꺼져 있어도 편집·PNG 내보내기는
 * 동작해야 하므로, 이 훅은 저장/목록 UI 활성화 여부만 판단하는 데 쓴다.
 */
export function useServerHealth() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
    staleTime: 30_000,
  })

  return {
    isServerUp: query.isSuccess,
    isChecking: query.isLoading,
    recheck: query.refetch,
  }
}
