import { Link } from 'react-router-dom'

import { AnalysisList } from '@/components/analyses/AnalysisList'
import { useAnalyses } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { useServerHealth } from '@/hooks/useServerHealth'

/**
 * /analyses — 저장 목록. 서버 미기동 시 목록 대신 안내 카드 (2단계 §6, §11.3).
 * 비로그인 시 로그인 안내로 대체한다(TO-DO 11번) — 서버가 떠 있어도 목록
 * 조회는 로그인이 필요하므로, isServerUp만으로는 401을 설명할 수 없다.
 */
export function AnalysesPage() {
  const { isServerUp, isChecking } = useServerHealth()
  const { isLoggedIn, isChecking: isCheckingAuth } = useCurrentUser()
  const { data, isLoading, isError } = useAnalyses()

  return (
    <div className="p-6">
      <h1 className="mb-4 text-lg font-semibold text-foreground">저장된 분석</h1>

      {isChecking || isCheckingAuth ? (
        <p className="text-muted-foreground">서버 확인 중…</p>
      ) : !isServerUp ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          백엔드 서버가 꺼져 있어 저장된 분석 목록을 불러올 수 없습니다.
          <br />
          <code className="text-xs">uvicorn main:app --reload</code>로 서버를 켠 뒤 새로고침하세요.
        </div>
      ) : !isLoggedIn ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          로그인이 필요합니다.
          <br />
          <Link to="/login" className="text-foreground underline">
            로그인
          </Link>{' '}
          또는{' '}
          <Link to="/register" className="text-foreground underline">
            회원가입
          </Link>
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : isError ? (
        <p className="text-destructive">목록을 불러오지 못했습니다.</p>
      ) : (
        <AnalysisList analyses={data ?? []} />
      )}
    </div>
  )
}
