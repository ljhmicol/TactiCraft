import { useState } from 'react'
import { Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useChangePassword, useChangeUsername, useCurrentUser } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'

/**
 * /profile — 내 정보. 상단 네비게이션의 이메일을 눌러 들어온다(2026-09-11
 * 요청 — "이메일 누르면 내 정보 페이지로 넘어가서 비번·닉네임 바꿀 수 있게").
 *
 * 이메일은 로그인 식별자라 여기서 바꾸지 않는다 — 요청받은 범위(비밀번호·
 * 닉네임)만 구현한다. 두 폼은 서로 독립된 뮤테이션이라 하나가 실패해도
 * 다른 쪽엔 영향이 없다.
 */
export function ProfilePage() {
  const { user, isLoggedIn, isChecking } = useCurrentUser()

  const changeUsernameMutation = useChangeUsername()
  const [username, setUsername] = useState(user?.username ?? '')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSaved, setUsernameSaved] = useState(false)

  const changePasswordMutation = useChangePassword()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSaved, setPasswordSaved] = useState(false)

  if (isChecking) return null
  if (!isLoggedIn || !user) return <Navigate to="/login" replace />

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameError(null)
    setUsernameSaved(false)
    try {
      await changeUsernameMutation.mutateAsync(username)
      setUsernameSaved(true)
    } catch (err) {
      setUsernameError(err instanceof ApiError ? err.message : '사용자명을 바꾸지 못했습니다.')
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSaved(false)
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSaved(true)
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : '비밀번호를 바꾸지 못했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">내 정보</h1>
      <p className="mb-6 text-sm text-muted-foreground">{user.email}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-foreground">사용자명</h2>
        <form onSubmit={handleUsernameSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">닉네임</Label>
            <Input
              id="username"
              type="text"
              required
              minLength={2}
              maxLength={20}
              pattern="[\w가-힣]+"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameSaved(false)
              }}
            />
            <p className="text-xs text-muted-foreground">한글·영문·숫자·밑줄 2~20자 — 댓글에 표시됩니다</p>
          </div>
          {usernameError && <p className="text-sm text-destructive">{usernameError}</p>}
          {usernameSaved && <p className="text-sm text-foreground">변경되었습니다.</p>}
          <Button
            type="submit"
            size="sm"
            className="self-start"
            disabled={changeUsernameMutation.isPending || username === user.username}
          >
            {changeUsernameMutation.isPending ? '변경 중…' : '사용자명 변경'}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">비밀번호</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">현재 비밀번호</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">새 비밀번호</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">8자 이상</p>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          {passwordSaved && (
            <p className="text-sm text-foreground">변경되었습니다. 다른 기기에 로그인돼 있었다면 로그아웃됩니다.</p>
          )}
          <Button type="submit" size="sm" className="self-start" disabled={changePasswordMutation.isPending}>
            {changePasswordMutation.isPending ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </form>
      </section>
    </div>
  )
}
