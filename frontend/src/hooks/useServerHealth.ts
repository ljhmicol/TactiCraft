import { useQuery } from '@tanstack/react-query'

import { fetchHealth } from '@/lib/api'

/**
 * 서버 미기동을 감지한다 (FR-08 폴백). 서버가 꺼져 있어도 편집·PNG 내보내기는
 * 동작해야 하므로, 이 훅은 저장/목록 UI 활성화 여부만 판단하는 데 쓴다.
 *
 * 제한된 백오프 재시도(개선 로드맵 §5.6, 2026-09-20) — Fly.io 콜드 스타트
 * (TO-DO 59, `min_machines_running = 0`) 동안은 첫 시도가 실패해도 몇 초 뒤
 * 재시도하면 성공할 가능성이 높다. `retry: false`였던 예전 설정은 실패를
 * 영구적인 것처럼 취급해, 실제로는 곧 뜰 서버인데도 "서버 미기동" 화면이
 * 고정돼버렸다(이 화면을 쓰는 AnalysesPage·CommunityPage·VersusPage·
 * DuplicateButton·SaveButton 전부 이 훅 하나로 판단하므로, 여기서 고치면
 * 전부 같이 좋아진다). 최대 2회 재시도(총 3회 시도), 지수 백오프
 * 1.5초→3초(6초 상한) — "제한된" 재시도이지 무한 재시도가 아니다.
 *
 * 실패 상태에서 주기적으로 자동 재확인(`refetchInterval`)하는 안은
 * 일부러 넣지 않았다 — "백엔드가 꺼져 있어도 편집·PNG 내보내기는 동작해야
 * 합니다"가 이 프로젝트가 지원하는 정식 개발 흐름인데(CLAUDE.md), 그 상태로
 * 화면을 켜 두면 영원히 실패하는 요청을 계속 폴링하게 된다. 지금은 콜드
 * 스타트 동안 "화면을 새로고침하면 재확인된다"는 기존 동작(AnalysesPage 등의
 * 안내 문구)에 기대고, 이 한 번의 마운트 안에서 재시도 폭을 넓히는 데
 * 그친다.
 */
export function useServerHealth() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1500 * 2 ** attemptIndex, 6000),
    staleTime: 30_000,
  })

  return {
    isServerUp: query.isSuccess,
    isChecking: query.isLoading,
    recheck: query.refetch,
  }
}
