import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLogin } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'

/**
 * /login — 이메일/비밀번호 로그인 (TO-DO 11번).
 *
 * 로그인 후 원래 화면으로 복귀(개선 로드맵 §6.3, 2026-09-20) — 예전엔
 * 로그인이 필요해 이 화면으로 튕겨온 경우에도 로그인 성공 시 무조건
 * 편집기(`/`)로 보냈다. CommunityPage·SharePage의 좋아요 클릭,
 * ProfilePage의 비로그인 가드가 `navigate('/login', { state: { from:
 * location } })`로 원래 위치를 실어 보내면, 여기서 그 위치로 돌려보낸다.
 * 없으면(주소창에 직접 /login을 친 경우 등) 기존처럼 편집기로 간다.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const loginMutation = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await loginMutation.mutateAsync({ email, password })
      const from = (location.state as { from?: Location } | null)?.from
      navigate(from ? `${from.pathname}${from.search}${from.hash}` : '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인에 실패했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">로그인</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? '로그인 중…' : '로그인'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        계정이 없으신가요?{' '}
        <Link to="/register" state={location.state} className="text-foreground underline">
          회원가입
        </Link>
      </p>
    </div>
  )
}
