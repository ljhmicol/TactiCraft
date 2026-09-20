import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  ApiError,
  changePassword,
  changeUsername,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  withdrawUser,
} from '@/lib/api'

const ME_KEY = ['auth', 'me']

/**
 * 로그인 상태(TO-DO 11번). 비로그인 상태는 401(ApiError)로 오므로 그 경우는
 * 에러가 곧 "로그아웃 상태"라 재시도하지 않는다 — 대부분의 방문이 비로그인
 * 상태라, 여기서 재시도하면 익명 방문자 전원이 매번 불필요한 지연을 겪는다.
 *
 * 403(정지된 계정, 2026-09-20 회원 관리)도 재시도하지 않는다 — 콜드
 * 스타트처럼 다시 시도한다고 나아질 상태가 아니라 계정 자체가 막힌
 * 것이라, 401과 마찬가지로 곧바로 "로그아웃 상태"로 정착시킨다(advisor
 * 리뷰로 발견 — 그냥 두면 이 상태도 콜드 스타트로 오인해 몇 초 동안
 * 재시도하다가 뒤늦게 로그인 필요 화면으로 정착한다).
 *
 * 401·403이 **아닌** 실패(개선 로드맵 §5.6, 2026-09-20 정정)는 재시도한다 —
 * Fly.io 콜드 스타트(TO-DO 59) 중 이 요청이 일시적으로 실패하면 로그인한
 * 사용자도 `isLoggedIn`이 false로 굳어버렸다. SaveButton이 `!isLoggedIn`
 * 이면 "로그인이 필요합니다"로 저장 버튼을 막는데, 실제로는 로그인 상태고
 * 서버만 깨어나는 중인 상황을 구분하지 못해 §5.6이 고치려던 버그가
 * 그대로 재현됐다 — useServerHealth와 같은 백오프로 맞춘다.
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchCurrentUser,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1500 * 2 ** attemptIndex, 6000),
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
    mutationFn: ({ email, username, password }: { email: string; username: string; password: string }) =>
      registerUser(email, username, password),
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

/** 내 정보 페이지(ProfilePage)의 닉네임 변경 — 헤더의 표시명도 즉시 갱신된다. */
export function useChangeUsername() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (username: string) => changeUsername(username),
    onSuccess: (user) => {
      queryClient.setQueryData(ME_KEY, user)
    },
  })
}

/** 내 정보 페이지의 비밀번호 변경. 성공하면 이 탭은 로그인 상태를 유지하지만
 * (백엔드가 현재 세션은 지우지 않는다) 다른 기기의 세션은 서버에서 끊긴다. */
export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
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
