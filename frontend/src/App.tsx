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
        <Link to="/login" className="shrink-0 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground">
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
      <Link to="/profile" className="max-w-[40vw] truncate text-sm text-muted-foreground hover:text-foreground" title="내 정보">
        {user?.email}
      </Link>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="shrink-0 whitespace-nowrap rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        로그아웃
      </button>
      <button
        type="button"
        onClick={handleWithdraw}
        disabled={withdrawMutation.isPending}
        className="shrink-0 whitespace-nowrap rounded-sm text-sm text-destructive/80 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          'shrink-0 whitespace-nowrap text-sm underline-offset-4 transition-colors hover:text-foreground',
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

          모바일 대응(2026-09-11 후속, 실기기 리포트 "글자크기들도 안 맞아서
          튀어나오고") — 3분할 그리드를 좁은 화면에도 한 줄로 욱여넣었더니
          "편\n집\n기"처럼 링크 텍스트가 글자 단위로 줄바꿈됐다(anti-patterns.md
          gate 49가 금지하는 "두 줄로 잘리는 클릭 텍스트"). md 미만에서는
          [워드마크 …… 로그인상태]를 1행, 링크 4개를 2행(가로 스크롤, 각
          링크는 whitespace-nowrap로 항상 한 줄)으로 바꾸고, md 이상에서는
          원래 3분할 그리드 한 줄로 되돌아간다 — LayerToggleChips가 이미 쓰는
          "좁으면 가로 스크롤" 패턴과 같은 방식이라 이 앱에서 낯설지 않다.
        */}
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 md:grid md:h-14 md:flex-nowrap md:grid-cols-[1fr_auto_1fr] md:px-6 md:py-0">
            <Link
              to="/"
              onClick={handleLogoClick}
              className="order-1 shrink-0 font-display text-lg font-semibold text-foreground hover:text-foreground/80 md:order-none md:row-start-1 md:justify-self-start"
            >
              TactiCore
            </Link>
            <div className="order-2 flex shrink-0 items-center gap-4 md:order-none md:col-start-3 md:row-start-1 md:justify-self-end">
              <AuthNav />
            </div>
            <nav
              className="order-3 flex w-full items-center gap-5 overflow-x-auto md:order-none md:col-start-2 md:row-start-1 md:w-auto md:justify-self-center md:overflow-visible"
              aria-label="주요 메뉴"
            >
              <NavItem to="/" end>
                편집기
              </NavItem>
              <NavItem to="/analyses">저장 목록</NavItem>
              <NavItem to="/community">커뮤니티</NavItem>
              <NavItem to="/versus">전술 대결</NavItem>
            </nav>
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
