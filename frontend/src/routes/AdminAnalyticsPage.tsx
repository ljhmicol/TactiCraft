import { useState } from 'react'

import { useAnalyticsSummary } from '@/hooks/useAnalytics'
import { useCurrentUser } from '@/hooks/useAuth'
import type { DailyViewStat } from '@/lib/api'

/** 막대 하나 — 끝(위쪽)만 둥글게 깎는다(마크 스펙: "베이스라인에 붙는
 * 4px 둥근 끝"). 아래쪽은 베이스라인에 그대로 닿아야 하므로 각지게 둔다. */
function barPath(x: number, yTop: number, width: number, yBase: number, radius: number): string {
  const r = Math.min(radius, width / 2, Math.max(yBase - yTop, 0))
  if (r <= 0) return `M${x},${yBase} H${x + width} V${yTop} H${x} Z`
  return [
    `M${x},${yBase}`,
    `V${yTop + r}`,
    `A${r},${r} 0 0 1 ${x + r},${yTop}`,
    `H${x + width - r}`,
    `A${r},${r} 0 0 1 ${x + width},${yTop + r}`,
    `V${yBase}`,
    'Z',
  ].join(' ')
}

/** 일별 조회수 막대 그래프 — 단일 지표(조회수)라 범례 없이 제목으로 계열을
 * 밝힌다(dataviz 스킬: "단일 계열은 범례 박스 불필요"). 막대 위에 마우스를
 * 올리면 정확한 날짜·조회수·순 방문자를 보여주는 툴팁이 뜬다. */
function DailyViewsChart({ data }: { data: DailyViewStat[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">최근 방문 기록이 없습니다.</p>
  }

  const width = 640
  const height = 180
  const padding = { top: 12, right: 4, bottom: 20, left: 4 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const maxViews = Math.max(...data.map((d) => d.views), 1)
  const gap = 4
  const barWidth = Math.max((plotW - gap * (data.length - 1)) / data.length, 2)
  const hovered = hoverIndex != null ? data[hoverIndex] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="최근 일별 조회수">
        {/* 베이스라인 */}
        <line
          x1={padding.left}
          y1={padding.top + plotH}
          x2={padding.left + plotW}
          y2={padding.top + plotH}
          stroke="hsl(var(--border))"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const x = padding.left + i * (barWidth + gap)
          const barH = (d.views / maxViews) * plotH
          const yTop = padding.top + plotH - barH
          const isHovered = hoverIndex === i
          return (
            <g key={d.date}>
              {/* 히트 영역 — 막대 자체보다 넓게 잡아 손가락/커서로도 쉽게 짚는다 */}
              <rect
                x={x - gap / 2}
                y={padding.top}
                width={barWidth + gap}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              />
              <path
                d={barPath(x, yTop, barWidth, padding.top + plotH, 3)}
                fill="hsl(var(--primary))"
                opacity={isHovered ? 1 : 0.85}
              />
            </g>
          )
        })}
      </svg>
      {hovered && (
        <div className="pointer-events-none absolute left-2 top-0 rounded-sm border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm">
          <div className="font-medium">{hovered.date}</div>
          <div className="text-muted-foreground">
            조회 {hovered.views}회 · 순 방문자 {hovered.uniqueVisitors}명
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value.toLocaleString('ko-KR')}</div>
    </div>
  )
}

/**
 * 방문자 통계(2026-09-26, "사람들이 사이트 얼마나 사용하는지 알 수 있는
 * 방법 있어?" 요청). Umami/Plausible 같은 외부 서비스 대신 이 앱의 기존
 * SQLite에 방문 기록을 쌓는 방식을 사용자가 직접 선택했다(routers/
 * analytics.py 참조) — IP·유저 에이전트는 저장하지 않는다.
 *
 * AdminReportsPage와 같은 패턴 — 이 라우트 자체는 App.tsx에서 보호하지
 * 않는다. 실질적인 권한 경계는 서버에 있다(auth.require_admin).
 */
export function AdminAnalyticsPage() {
  const { user, isLoggedIn, isChecking } = useCurrentUser()
  const { data, isLoading, isError } = useAnalyticsSummary()

  if (isChecking) return null
  if (!isLoggedIn) return <div className="p-6 text-muted-foreground">로그인이 필요합니다.</div>
  if (user && !user.isAdmin) return <div className="p-6 text-destructive">운영자만 볼 수 있는 페이지입니다.</div>
  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중…</div>
  if (isError || !data) {
    return <div className="p-6 text-destructive">방문자 통계를 불러오지 못했습니다. 운영자 계정으로 로그인했는지 확인하세요.</div>
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">방문자 통계</h1>
        <p className="mt-1 text-sm text-muted-foreground">최근 30일 · IP·기기 정보는 저장하지 않습니다.</p>
      </div>

      <div className="flex gap-3">
        <StatTile label="오늘 조회수" value={data.todayViews} />
        <StatTile label="30일 조회수" value={data.totalViews} />
        <StatTile label="30일 순 방문자" value={data.uniqueVisitors} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">일별 조회수</h2>
        <DailyViewsChart data={data.dailyViews} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-foreground">많이 본 페이지</h2>
        {data.topPaths.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 기록이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-1 font-normal">경로</th>
                <th className="py-1 font-normal text-right">조회수</th>
              </tr>
            </thead>
            <tbody>
              {data.topPaths.map((p) => (
                <tr key={p.path} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{p.path}</td>
                  <td className="py-1.5 text-right text-foreground">{p.views.toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
