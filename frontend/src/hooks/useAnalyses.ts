import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/hooks/use-toast'
import { useCurrentUser } from '@/hooks/useAuth'
import {
  createAnalysis,
  deleteAnalysis,
  fetchAnalyses,
  fetchAnalysis,
  fetchSharedAnalysis,
  updateAnalysis,
} from '@/lib/api'
import type { Analysis } from '@/types/analysis'

const ANALYSES_KEY = ['analyses']

/** 목록 조회는 로그인이 필요하다(TO-DO 11번) — 비로그인 상태에선 어차피 401만
 * 돌아오므로 요청 자체를 보내지 않는다. */
export function useAnalyses() {
  const { isLoggedIn } = useCurrentUser()
  return useQuery({ queryKey: ANALYSES_KEY, queryFn: fetchAnalyses, enabled: isLoggedIn })
}

export function useAnalysis(id: number | undefined) {
  return useQuery({
    queryKey: [...ANALYSES_KEY, id],
    queryFn: () => fetchAnalysis(id!),
    enabled: id !== undefined,
  })
}

/** 공유 토큰으로 읽는 "링크 공개"(개선 로드맵 §5.2) 전용 조회 — /s/:token
 * 라우트(SharePage.tsx)가 쓴다. id 기반 useAnalysis와 캐시 키를 분리해
 * 같은 분석이라도 토큰 경로와 id 경로가 서로의 캐시를 덮어쓰지 않게 한다. */
export function useSharedAnalysis(token: string | undefined) {
  return useQuery({
    queryKey: ['share', token],
    queryFn: () => fetchSharedAnalysis(token!),
    enabled: token !== undefined,
  })
}

/** id 없으면 POST(생성), 있으면 PUT(전체 교체)으로 저장한다. */
export function useSaveAnalysis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (analysis: Analysis) => {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = analysis
      void _id
      void _createdAt
      void _updatedAt
      return analysis.id ? updateAnalysis(analysis.id, payload) : createAnalysis(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYSES_KEY })
    },
  })
}

/**
 * 원본은 그대로 두고 새 id로 복제 저장한다(TO-DO 25번, "다른 이름으로
 * 저장"). id/createdAt/updatedAt을 비운 채 항상 POST하는 점이
 * `useSaveAnalysis`와 다르다 — 저장된 분석이든 아니든 항상 새 행을 만든다.
 * 목록에서 원본과 구분되게 매치명 끝에 "(복제)"를 붙인다.
 */
export function useDuplicateAnalysis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (analysis: Analysis) => {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = analysis
      void _id
      void _createdAt
      void _updatedAt
      return createAnalysis({
        ...payload,
        match: { ...payload.match, matchName: `${payload.match.matchName || '분석'} (복제)` },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYSES_KEY })
      // 개선 로드맵 §6.3 — 복제가 끝나면 에디터가 새 사본으로 조용히
      // 전환된다(DuplicateButton.handleDuplicate의 loadAnalysis 호출).
      // 화면이 미묘하게 바뀌는 것 말고는 "복제됐다"는 신호가 없었다.
      toast({ description: '분석을 복제했습니다.' })
    },
    // 실패 상세(필드별 검증 오류 등)는 DuplicateButton이 여전히 인라인
    // 목록으로 보여준다 — 여기 토스트는 "뭔가 실패했다"는 빠른 신호만 준다.
    onError: () => {
      toast({ variant: 'destructive', description: '복제하지 못했습니다.' })
    },
  })
}

export function useDeleteAnalysis() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteAnalysis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANALYSES_KEY })
      // 개선 로드맵 §6.3 — 전엔 AnalysisList의 삭제가 완전히 fire-and-forget
      // 이었다(성공/실패 모두 아무 피드백 없음).
      toast({ description: '분석을 삭제했습니다.' })
    },
    onError: () => {
      toast({ variant: 'destructive', description: '삭제하지 못했습니다.' })
    },
  })
}
