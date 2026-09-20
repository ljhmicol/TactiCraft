import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/hooks/use-toast'
import { fetchAdminUsers, suspendUser, unsuspendUser } from '@/lib/api'

const USERS_KEY = ['admin', 'users']

/** 운영자 전용 회원 목록(2026-09-20, 관리자 요청). 비운영자가 호출하면
 * 서버가 403을 준다 — AdminUsersPage는 이 훅의 에러를 안내 문구로 보여줄
 * 뿐, 실제 접근 제어는 서버에 있다(useOpenReports와 같은 패턴). */
export function useAdminUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: fetchAdminUsers })
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => suspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
      toast({ description: '계정을 정지했습니다.' })
    },
    onError: () => toast({ variant: 'destructive', description: '정지 처리에 실패했습니다.' }),
  })
}

export function useUnsuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => unsuspendUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY })
      toast({ description: '정지를 해제했습니다.' })
    },
    onError: () => toast({ variant: 'destructive', description: '정지 해제에 실패했습니다.' }),
  })
}
