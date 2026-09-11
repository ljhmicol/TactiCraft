import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MouseEvent } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useCurrentUser, useLogout, useWithdraw } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
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

  // 로그아웃 상태 — N1b(component-cookbook.md) 패턴의 "로그인 텍스트 링크 +
  // 채워진 CTA" 조합. 로그인된 쪽엔 이 짝에 대응하는 단일 주요 동작이
  // 없어서(이메일·로그아웃·탈퇴 셋 다 동급) 그 상태는 아래에서 텍스트로만 둔다.
  if (!isLoggedIn) {
    return (
      <>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
          로그인
        </Link>
        <Button asChild size="sm">
          <Link to="/register">회원가입</Link>
        </Button>
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
      <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground" title="내 정보">
        {user?.email}
      </Link>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        로그아웃
      </button>
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={withdrawMutation.isPending}
        className="text-sm text-destructive/80 hover:text-destructive"
      >
        회원 탈퇴
      </button>
    </>
  )
}

/** 상단 내비 가운데 클러스터의 링크 하나 — 지금 보고 있는 경로면 밑줄+본문색,
 * 아니면 옅은 회색. 예전 내비는 활성 경로 표시가 아예 없었다. */
function NavItem({ to, children, end }: { to: string; children: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'text-sm underline-offset-4 transition-colors hover:text-foreground',
          isActive ? 'text-foreground underline' : 'text-muted-foreground',
        )
      }
    >
      {children}
    </NavLink>
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
        {/*
          Hallmark 감사(2026-09-11) 후속 — 내비게이션 재설계. 예전 구조는
          워드마크 왼쪽 고정 + 인라인 텍스트 링크 여러 개 + CTA 오른쪽 고정,
          h-14, border-b — anti-patterns.md가 "가장 많이 인식되는 AI 내비
          지문"으로 지목하는 모양과 거의 일치했다(N1a). component-cookbook.md
          라우팅표의 modern-minimal 기본값 N1b(Canonical SaaS three-section)로
          교체 — TactiCore가 실제로 "진짜 목적지 4개 + 로그인 상태"를 가진
          제품 내비라 이 아키타입의 "Use when"과 정확히 맞는다.
          knob 선택: 가운데 링크 4개 · 드롭다운 없음 · scroll state=always-solid
          (원본 예시의 "투명하게 시작해 스크롤하면 프로스트"는 마케팅 히어로
          이미지 위에 얹는 용도라, 항상 조밀한 유틸리티 화면인 이 앱에는 안
          맞아 always-solid를 골랐다 — N1b 문서가 이걸 정식 knob 값으로
          제공한다) · CTA 쌍=로그인 텍스트+회원가입 채움(로그아웃 상태만).
          그리드 3분할(brand-start / links-center / auth-end)이라, 예전처럼
          모든 걸 오른쪽 한 덩어리로 밀어붙이지 않고 시각적으로 구역이 나뉜다.
        */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto grid h-14 max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center px-6">
            <Link
              to="/"
              onClick={handleLogoClick}
              className="justify-self-start font-display text-lg font-semibold text-foreground hover:text-foreground/80"
            >
              TactiCore
            </Link>
            <nav className="col-start-2 flex items-center gap-5 justify-self-center" aria-label="주요 메뉴">
              <NavItem to="/" end>
                편집기
              </NavItem>
              <NavItem to="/analyses">저장 목록</NavItem>
              <NavItem to="/community">커뮤니티</NavItem>
              <NavItem to="/versus">전술 대결</NavItem>
            </nav>
            <div className="col-start-3 flex items-center gap-4 justify-self-end">
              <AuthNav />
            </div>
          </div>
        </header>
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
