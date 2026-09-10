import { MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useCommunityAnalyses } from '@/hooks/useCommunity'
import { useServerHealth } from '@/hooks/useServerHealth'

/**
 * /community — 커뮤니티 공개 목록(TO-DO 12번 후속, 2026-09-10).
 *
 * "커뮤니티는 어디있어?"라는 질문에서 시작 — 처음엔 저장 목록에 공유
 * 페이지로 가는 링크만 추가했지만, 이어서 "커뮤니티 창을 새로 만드는 게
 * 낫지 않겠냐"는 요청으로 전용 화면을 만들었다. AskUserQuestion으로
 * "작성자가 공유하기를 누른 것만" 보이는 opt-in 모델을 확정했다(전체 저장
 * 분석 자동 공개는 기각 — 로그인만 하면 누구나 공유 여부를 스스로
 * 고를 수 있어야 한다는 판단).
 *
 * 저장 목록(AnalysesPage)과 달리 로그인이 필요 없다 — 댓글 읽기와 같은
 * 이유로 누구나 둘러볼 수 있어야 "커뮤니티"다. 그 대신 글쓴이(작성자)
 * 표시명과 댓글 수를 카드에 보여줘 "누가 무엇을 공유했고 얼마나
 * 논의됐는지"가 한눈에 보이게 한다 — 저장 목록은 반대로 이 정보가
 * 필요 없다(전부 내 것이므로).
 */
export function CommunityPage() {
  const { isServerUp, isChecking } = useServerHealth()
  const { data, isLoading, isError } = useCommunityAnalyses()

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-foreground">커뮤니티</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        다른 사람이 공유한 분석을 둘러보고 댓글을 남겨보세요. 로그인 없이도 볼 수 있습니다.
      </p>

      {isChecking ? (
        <p className="text-muted-foreground">서버 확인 중…</p>
      ) : !isServerUp ? (
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          백엔드 서버가 꺼져 있어 커뮤니티 목록을 불러올 수 없습니다.
        </div>
      ) : isLoading ? (
        <p className="text-muted-foreground">불러오는 중…</p>
      ) : isError ? (
        <p className="text-destructive">목록을 불러오지 못했습니다.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-muted-foreground">
          아직 공유된 분석이 없습니다. 에디터에서 &quot;커뮤니티에 공유&quot;를 눌러 첫 번째로 공유해보세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {data.map((a) => (
            <Link
              key={a.id}
              to={`/share/${a.id}`}
              className="group flex flex-col overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
            >
              <div className="aspect-[68/105] w-full bg-muted">
                {a.thumbnail ? (
                  <img src={a.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    미리보기 없음
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-sm font-medium text-foreground group-hover:underline">
                  {a.matchName || `${a.homeTeam} vs ${a.awayTeam}`}
                </p>
                <p className="text-xs text-muted-foreground">{a.matchDate}</p>
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span className="truncate">{a.ownerUsername}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {a.commentCount}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
