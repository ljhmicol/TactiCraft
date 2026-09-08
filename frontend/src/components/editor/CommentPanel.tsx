import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { findTacticalRole } from '@/lib/tacticalRoles'
import { useAnalysisStore } from '@/store/analysisStore'
import type { PlayerPosition } from '@/types/analysis'

/**
 * 지금 보이는 곳(국면 또는 타임라인 체인징 포인트)의 코멘트 + 종합 평가
 * (FR-04, TO-DO 5번). 제목이 그 이름을 따라 바뀐다 — 어디에 쓰는 중인지
 * 헷갈리는 것이 가장 흔한 실수다 (2단계 §11.1).
 *
 * 전술 역할 문구 삽입(TO-DO 20)은 코멘트를 대신 써주는 게 아니라, 지금
 * 배치된 선수 중 전술 역할이 지정된 선수의 역할 설명 한 줄을 코멘트 끝에
 * 붙여주는 보조 기능이다. 자동 생성이 아니라 사용자가 눌러야만 들어간다.
 */
export function CommentPanel({
  title,
  comment,
  summary,
  phasePositions,
}: {
  title: string
  comment: string
  summary: string
  phasePositions: PlayerPosition[]
}) {
  const setComment = useAnalysisStore((s) => s.setComment)
  const setSummary = useAnalysisStore((s) => s.setSummary)
  const players = useAnalysisStore((s) => s.analysis?.players)

  const roleSuggestions = (phasePositions ?? [])
    .map((pos) => {
      const player = players?.find((p) => p.id === pos.playerId)
      const role = findTacticalRole(player?.tacticalRole)
      return player && role ? { player, role } : null
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)

  const insertSuggestion = (text: string) => {
    setComment(comment ? `${comment}\n${text}` : text)
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="phase-comment">{title} 코멘트</Label>
        <Textarea id="phase-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        {roleSuggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roleSuggestions.map(({ player, role }) => (
              <button
                key={player.id}
                type="button"
                onClick={() => insertSuggestion(`${player.name}(${role.label}) — ${role.blurb}`)}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title="클릭하면 이 역할 설명을 코멘트 끝에 붙입니다"
              >
                + {player.name} · {role.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="summary">종합 평가</Label>
        <Textarea id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
      </div>
    </div>
  )
}
