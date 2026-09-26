import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from '@/hooks/use-toast'
import { useCurrentUser } from '@/hooks/useAuth'
import {
  createRosterTemplate,
  deleteRosterTemplate,
  fetchRosterTemplate,
  fetchRosterTemplates,
  type RosterTemplatePlayer,
} from '@/lib/api'

const ROSTER_TEMPLATES_KEY = ['roster-templates']

/** useAnalyses()와 같은 이유로 로그인 상태에서만 요청한다 — 비로그인이면
 * 서버가 401만 돌려준다. */
export function useRosterTemplates() {
  const { isLoggedIn } = useCurrentUser()
  return useQuery({ queryKey: ROSTER_TEMPLATES_KEY, queryFn: fetchRosterTemplates, enabled: isLoggedIn })
}

export function useRosterTemplate(id: number | undefined) {
  return useQuery({
    queryKey: [...ROSTER_TEMPLATES_KEY, id],
    queryFn: () => fetchRosterTemplate(id!),
    enabled: id !== undefined,
  })
}

export function useCreateRosterTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; players: RosterTemplatePlayer[] }) => createRosterTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROSTER_TEMPLATES_KEY })
      toast({ description: '선수단을 저장했습니다.' })
    },
    onError: () => {
      toast({ variant: 'destructive', description: '선수단을 저장하지 못했습니다.' })
    },
  })
}

export function useDeleteRosterTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRosterTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROSTER_TEMPLATES_KEY })
      toast({ description: '선수단을 삭제했습니다.' })
    },
    onError: () => {
      toast({ variant: 'destructive', description: '삭제하지 못했습니다.' })
    },
  })
}
