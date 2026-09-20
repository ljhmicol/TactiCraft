import { Button } from '@/components/ui/button'
import { useAdminUsers, useSuspendUser, useUnsuspendUser } from '@/hooks/useAdminUsers'
import { useCurrentUser } from '@/hooks/useAuth'

/**
 * 운영자 회원 관리(2026-09-20, 관리자 요청 "회원들이 회원가입을 하면
 * 내가 관리를 해야할 것 같은데").
 *
 * AdminReportsPage와 같은 패턴 — 이 라우트 자체는 App.tsx에서 보호하지
 * 않는다. 실질적인 권한 경계는 서버(auth.require_admin)에 있고,
 * user?.isAdmin은 화면을 미리 정리해 보여주는 용도일 뿐이다.
 *
 * "정지"는 로그인 차단만 한다(사용자가 명시적으로 고른 범위) — 저장한
 * 분석·댓글은 그대로 둔다. 문제 콘텐츠 자체를 숨기거나 지우는 조치는
 * 신고함(/admin/reports)의 몫이라 여기서 다루지 않는다.
 */
export function AdminUsersPage() {
  const { user, isLoggedIn, isChecking } = useCurrentUser()
  const { data: users, isLoading, isError } = useAdminUsers()
  const suspendMutation = useSuspendUser()
  const unsuspendMutation = useUnsuspendUser()

  if (isChecking) return null
  if (!isLoggedIn) return <div className="p-6 text-muted-foreground">로그인이 필요합니다.</div>
  if (user && !user.isAdmin) return <div className="p-6 text-destructive">운영자만 볼 수 있는 페이지입니다.</div>
  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중…</div>
  if (isError) {
    return <div className="p-6 text-destructive">회원 목록을 불러오지 못했습니다. 운영자 계정으로 로그인했는지 확인하세요.</div>
  }

  const isBusy = (id: number) =>
    (suspendMutation.isPending && suspendMutation.variables === id) ||
    (unsuspendMutation.isPending && unsuspendMutation.variables === id)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-foreground">회원 관리</h1>
      <ul className="flex flex-col gap-2">
        {users?.map((u) => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {u.username ?? u.email.split('@')[0]}
                {u.isSuspended && <span className="ml-2 text-xs font-normal text-destructive">정지됨</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {u.email} · 가입 {u.createdAt.replace('T', ' ')} · 분석 {u.analysisCount}개
              </p>
            </div>
            {u.isSuspended ? (
              <Button size="sm" variant="ghost" disabled={isBusy(u.id)} onClick={() => unsuspendMutation.mutate(u.id)}>
                정지 해제
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                disabled={isBusy(u.id) || u.id === user?.id}
                title={u.id === user?.id ? '자기 자신은 정지할 수 없습니다' : undefined}
                onClick={() => suspendMutation.mutate(u.id)}
              >
                정지
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
