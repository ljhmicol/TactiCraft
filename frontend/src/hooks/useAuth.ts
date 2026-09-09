import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchCurrentUser, loginUser, logoutUser, registerUser, withdrawUser } from '@/lib/api'

const ME_KEY = ['auth', 'me']

/**
 * 로그인 상태(TO-DO 11번). 비로그인 상태는 401(ApiError)로 오므로 에러가 곧
 * "로그아웃 상태"다 — retry하지 않는다(useServerHealth와 같은 패턴).
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 30_000,
  })

  return {
    user: query.data,
    isLoggedIn: query.isSuccess,
    isChecking: query.isLoading,
  }
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => loginUser(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user)
      queryClient.invalidateQueries({ queryKey: ['analyses'] })
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => registerUser(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user)
      queryClient.invalidateQueries({ queryKey: ['analyses'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(ME_KEY, undefined)
      queryClient.invalidateQueries({ queryKey: ME_KEY })
      queryClient.invalidateQueries({ queryKey: ['analyses'] })
    },
  })
}

/** 회원 탈퇴 — 본인 소유 분석까지 서버에서 함께 삭제된다(2026-09-09 사용자 결정). */
export function useWithdraw() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: withdrawUser,
    onSuccess: () => {
      queryClient.setQueryData(ME_KEY, undefined)
      queryClient.invalidateQueries({ queryKey: ME_KEY })
      queryClient.invalidateQueries({ queryKey: ['analyses'] })
    },
  })
}
