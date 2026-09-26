import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { fetchAnalyticsSummary, recordPageview } from '@/lib/api'

/** 운영자 전용(개선 로드맵, 2026-09-26) — 방문자 통계. AdminAnalyticsPage가
 * 이 훅의 에러를 안내 문구로 보여줄 뿐, 실제 접근 제어는 서버(require_admin)에
 * 있다(useOpenReports와 같은 패턴). */
export function useAnalyticsSummary() {
  return useQuery({ queryKey: ['admin', 'analytics'], queryFn: fetchAnalyticsSummary })
}

/**
 * 라우트가 바뀔 때마다 방문 기록을 남긴다(2026-09-26, "사람들이 사이트
 * 얼마나 사용하는지" 요청). App.tsx 안, BrowserRouter 밑에서 한 번만
 * 마운트한다 — useLocation은 Router 컨텍스트 안에서만 쓸 수 있어 App
 * 컴포넌트 자신(Router를 렌더링하는 쪽)에서는 호출할 수 없다.
 *
 * 실패해도 화면에 아무 영향이 없어야 한다(분석 실패로 사용자 작업을 막으면
 * 안 됨) — recordPageview의 에러를 여기서 조용히 삼킨다. 같은 경로를
 * 새로고침 없이 다시 방문했을 때(뒤로가기 등)도 매번 기록한다 — "그 경로를
 * 몇 번 봤는지"가 목적이라 중복 제거하지 않는다.
 */
export function usePageviewTracking() {
  const location = useLocation()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    recordPageview(location.pathname).catch(() => {
      // 분석 실패는 조용히 무시한다 — 사용자에게 보여줄 이유가 없다.
    })
  }, [location.pathname])
}
