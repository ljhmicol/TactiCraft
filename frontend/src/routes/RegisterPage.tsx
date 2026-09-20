import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Location } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegister } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'

/**
 * /register — 이메일/사용자명/비밀번호 회원가입 (TO-DO 11번). 첫 가입 계정은
 * 로그인 이전에 쌓인 기존 분석을 전부 자동으로 넘겨받는다(2026-09-09 사용자
 * 결정, backend/routers/auth.py의 register 참조) — 별도 UI 안내는 두지 않는다.
 *
 * 사용자명(TO-DO 12번, 댓글)은 가입 시점부터 받는다 — "커뮤니티에서 서로
 * 얘기할 때 이름이 있는 게 좋다"(2026-09-10 사용자 결정). 백엔드 정규식
 * `^[\w가-힣]{2,20}$`과 맞춰 한글·영문·숫자·밑줄 2~20자만 허용한다(공백 금지 —
 * 댓글 목록에서 작성자명이 한 줄로 또렷하게 보이도록).
 */
export function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const registerMutation = useRegister()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await registerMutation.mutateAsync({ email, username, password })
      // LoginPage와 같은 이유(개선 로드맵 §6.3) — "로그인이 필요합니다" 안내로
      // 여기 왔을 수도 있는 사람이 비계정자일 가능성이 더 높다(advisor
      // 리뷰로 발견 — 이 경로를 안 챙기면 원래 화면 복귀 기능이 로그인
      // 경로에서만 동작하고 회원가입 경로에서는 조용히 깨진다).
      const from = (location.state as { from?: Location } | null)?.from
      navigate(from ? `${from.pathname}${from.search}${from.hash}` : '/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '회원가입에 실패했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">회원가입</h1>
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
          <Label htmlFor="username">사용자명</Label>
          <Input
            id="username"
            type="text"
            required
            minLength={2}
            maxLength={20}
            pattern="[\w가-힣]+"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">한글·영문·숫자·밑줄 2~20자 — 댓글에 표시됩니다</p>
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
        <Link to="/login" state={location.state} className="text-foreground underline">
          로그인
        </Link>
      </p>
    </div>
  )
}
