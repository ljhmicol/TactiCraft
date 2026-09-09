import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'

/**
 * /register — 이메일/비밀번호 회원가입 (TO-DO 11번). 첫 가입 계정은 로그인
 * 이전에 쌓인 기존 분석을 전부 자동으로 넘겨받는다(2026-09-09 사용자 결정,
 * backend/routers/auth.py의 register 참조) — 별도 UI 안내는 두지 않는다.
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const registerMutation = useRegister()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await registerMutation.mutateAsync({ email, password })
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-6 text-lg font-semibold text-foreground">회원가입</h1>
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
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">8자 이상</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? '가입 중…' : '회원가입'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="text-foreground underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
