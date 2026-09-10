import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MouseEvent } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'

import { useCurrentUser, useLogout, useWithdraw } from '@/hooks/useAuth'
import { AnalysesPage } from '@/routes/AnalysesPage'
import { AnalysisDetailPage } from '@/routes/AnalysisDetailPage'
import { CommunityPage } from '@/routes/CommunityPage'
import { EditorPage } from '@/routes/EditorPage'
import { LoginPage } from '@/routes/LoginPage'
import { NewAnalysisPage } from '@/routes/NewAnalysisPage'
import { ProfilePage } from '@/routes/ProfilePage'
import { RegisterPage } from '@/routes/RegisterPage'
import { SharePage } from '@/routes/SharePage'
import { VersusPage } from '@/routes/VersusPage'
import { useAnalysisStore } from '@/store/analysisStore'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

function AuthNav() {
  const { user, isLoggedIn, isChecking } = useCurrentUser()
  const logoutMutation = useLogout()
  const withdrawMutation = useWithdraw()
  const closeAnalysis = useAnalysisStore((s) => s.closeAnalysis)
  const navigate = useNavigate()

  if (isChecking) return null

  if (!isLoggedIn) {
    return (
      <>
        <Link to="/login" className="hover:text-foreground">
          로그인
        </Link>
        <Link to="/register" className="hover:text-foreground">
          회원가입
        </Link>
      </>
    )
  }

  // 탈퇴(TO-DO 11번 연장) — 본인 소유 분석까지 서버에서 함께 지워지므로
  // 되돌릴 수 없다는 걸 확인창에서 분명히 알린다.
  const handleWithdraw = async () => {
    if (!window.confirm('탈퇴하면 저장한 분석이 모두 함께 삭제됩니다. 되돌릴 수 없습니다. 계속할까요?')) return
    await withdrawMutation.mutateAsync()
    closeAnalysis()
    navigate('/')
  }

  return (
    <>
      <Link to="/profile" className="text-muted-foreground hover:text-foreground" title="내 정보">
        {user?.email}
      </Link>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="hover:text-foreground"
      >
        로그아웃
      </button>
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={withdrawMutation.isPending}
        className="text-destructive hover:text-destructive/80"
      >
        회원 탈퇴
      </button>
    </>
  )
}

function App() {
  const closeAnalysis = useAnalysisStore((s) => s.closeAnalysis)
  const isDirty = useAnalysisStore((s) => s.isDirty)

  // 로고는 지금 어느 화면에 있든 항상 처음 화면(빈 편집기)으로 보낸다
  // (2026-09-07 사용자 요청) — "/"로만 이동하면 이미 로드된 분석이 store에
  // 그대로 남아 있어 편집기가 그 분석을 계속 보여준다. closeAnalysis로
  // 비워야 진짜 "처음 화면"이 된다. 저장 안 한 변경이 있으면 조용히 버리지
  // 않고 한 번 확인한다.
  const handleLogoClick = (e: MouseEvent) => {
    if (isDirty && !window.confirm('저장하지 않은 변경사항이 있습니다. 처음 화면으로 돌아갈까요?')) {
      e.preventDefault()
      return
    }
    closeAnalysis()
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex h-14 items-center justify-between border-b border-border px-6">
          <Link to="/" onClick={handleLogoClick} className="font-semibold text-foreground hover:text-foreground/80">
            TactiCore
          </Link>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              편집기
            </Link>
            <Link to="/analyses" className="hover:text-foreground">
              저장 목록
            </Link>
            <Link to="/community" className="hover:text-foreground">
              커뮤니티
            </Link>
            <Link to="/versus" className="hover:text-foreground">
              전술 대결
            </Link>
            <AuthNav />
          </nav>
        </div>
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/new" element={<NewAnalysisPage />} />
          <Route path="/analyses" element={<AnalysesPage />} />
          <Route path="/analyses/:id" element={<AnalysisDetailPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/share/:id" element={<SharePage />} />
          <Route path="/versus" element={<VersusPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
