import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { AnalysisList } from '@/components/analyses/AnalysisList'
import { Input } from '@/components/ui/input'
import { useAnalyses } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { useServerHealth } from '@/hooks/useServerHealth'
import { groupByDate } from '@/lib/dateGrouping'

type GroupMode = 'none' | 'day' | 'week'

const GROUP_MODE_OPTIONS: { value: GroupMode; label: string }[] = [
  { value: 'none', label: '전체' },
  { value: 'day', label: '일별' },
  { value: 'week', label: '주별' },
]

/**
 * /analyses — 저장 목록. 서버 미기동 시 목록 대신 안내 카드 (2단계 §6, §11.3).
 * 비로그인 시 로그인 안내로 대체한다(TO-DO 11번) — 서버가 떠 있어도 목록
 * 조회는 로그인이 필요하므로, isServerUp만으로는 401을 설명할 수 없다.
 *
 * 검색·태그 필터·일별/주별 그룹핑(TO-DO 7번, 2026-09-09 후속 요청)은
 * 목록이 수십 개 규모라 서버 왕복 없이 프론트에서 처리한다 — 이미 다
 * 받아온 데이터를 다시 걸러내고 나누는 것뿐이라 새 API가 필요 없다.
 * 그룹 기준은 경기 일자(matchDate) — 언제 저장했는지가 아니라 그
 * 경기가 언제였는지가 전술 라이브러리를 훑어볼 때 더 자연스럽다.
 */
export function AnalysesPage() {
  const { isServerUp, isChecking } = useServerHealth()
  const { isLoggedIn, isChecking: isCheckingAuth } = useCurrentUser()
  const { data, isLoading, isError } = useAnalyses()
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [groupMode, setGroupMode] = useState<GroupMode>('none')

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const a of data ?? []) for (const t of a.tags) set.add(t)
    return [...set].sort()
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((a) => {
      const matchesSearch =
        !q ||
        [a.matchName, a.homeTeam, a.awayTeam, a.matchDate].some((field) => field.toLowerCase().includes(q))
      const matchesTag = !activeTag || a.tags.includes(activeTag)
      return matchesSearch && matchesTag
    })
  }, [data, search, activeTag])

  const groups = useMemo(
    () => (groupMode === 'none' ? null : groupByDate(filtered, groupMode)),
    [filtered, groupMode],
  )

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold text-foreground">저장된 분석</h1>

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
        <>
          <div className="mb-3 flex flex-col gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="매치명·팀·날짜 검색"
              className="max-w-xs"
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setActiveTag((cur) => (cur === tag ? null : tag))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      activeTag === tag
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              {GROUP_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGroupMode(opt.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    groupMode === opt.value
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {(data?.length ?? 0) > 0 && filtered.length === 0 ? (
            <p className="text-muted-foreground">검색·필터 조건에 맞는 분석이 없습니다.</p>
          ) : groups ? (
            <div className="space-y-6">
              {groups.map((group) => (
                <section key={group.key}>
                  <h2 className="mb-2 text-sm font-semibold text-foreground">{group.label}</h2>
                  <AnalysisList analyses={group.items} />
                </section>
              ))}
            </div>
          ) : (
            <AnalysisList analyses={filtered} />
          )}
        </>
      )}
    </div>
  )
}
