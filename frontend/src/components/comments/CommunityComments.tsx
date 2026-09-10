import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/hooks/useAuth'
import { useComments, useCreateComment, useDeleteComment } from '@/hooks/useComments'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

interface CommunityCommentsProps {
  analysisId: number
  /** 지금 보는 사람이 이 분석의 소유자인가 — 소유자는 남의 댓글도 지울 수 있다
   * (2026-09-10 사용자 결정). Analysis.isOwner를 그대로 넘겨받는다. */
  isOwner: boolean
}

/**
 * 댓글(TO-DO 12번, 커뮤니티) — 공유된 분석(SharePage) 전체에 붙는 평평한
 * 목록. 2026-09-10 사용자 결정 3가지를 그대로 따른다:
 * 1) 작성은 로그인한 사용자만(회원가입 때 사용자명도 받는다 — RegisterPage)
 * 2) 댓글은 스레드 없이 분석 전체 하나에
 * 3) 삭제는 작성자 본인 또는 분석 소유자만(백엔드 routers/comments.py가
 *    403으로 강제 — 여기서는 버튼 노출 여부만 판정한다)
 *
 * EditorPage(자기 분석 편집)가 아니라 SharePage(읽기 전용 공개 뷰)에만
 * 붙인다 — TO-DO 항목 설명이 "공유된 분석에 의견"이라 이 화면이 자연스러운
 * 자리이고, EditorPage는 이미 레이아웃이 복잡해 더 끼워 넣으면 산만해진다.
 * 소유자도 자기 분석의 공유 링크를 열면 댓글을 보고 지울 수 있다.
 */
export function CommunityComments({ analysisId, isOwner }: CommunityCommentsProps) {
  const { data: comments, isLoading } = useComments(analysisId)
  const { user, isLoggedIn } = useCurrentUser()
  const createMutation = useCreateComment(analysisId)
  const deleteMutation = useDeleteComment(analysisId)
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setError(null)
    try {
      await createMutation.mutateAsync(body)
      setBody('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 남기지 못했습니다.')
    }
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-2xl">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        댓글{comments && comments.length > 0 ? ` (${comments.length})` : ''}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      {!isLoading && comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">아직 댓글이 없습니다. 첫 의견을 남겨보세요.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => {
            const canDelete = isLoggedIn && (c.userId === user?.id || isOwner)
            return (
              <li key={c.id} className="rounded-md border border-border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{c.username}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{c.createdAt.replace('T', ' ')}</span>
                    {canDelete && (
                      <button
                        type="button"
                        aria-label="댓글 삭제"
                        title="댓글 삭제"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(c.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4">
        {isLoggedIn ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="의견을 남겨보세요"
              maxLength={2000}
              rows={3}
              disabled={createMutation.isPending}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              size="sm"
              className="self-end"
              disabled={createMutation.isPending || !body.trim()}
            >
              {createMutation.isPending ? '등록 중…' : '댓글 등록'}
            </Button>
          </form>
        ) : (
          <p className={cn('rounded-md border border-dashed border-border p-3 text-center text-sm text-muted-foreground')}>
            댓글을 남기려면 로그인이 필요합니다.
          </p>
        )}
      </div>
    </section>
  )
}
