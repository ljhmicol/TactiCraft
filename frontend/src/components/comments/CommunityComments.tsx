import { Reply, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ReportButton } from '@/components/common/ReportButton'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentUser } from '@/hooks/useAuth'
import { useComments, useCreateComment, useDeleteComment, useToggleCommentReaction } from '@/hooks/useComments'
import { useReportComment } from '@/hooks/useModeration'
import { ApiError } from '@/lib/api'
import type { Comment } from '@/lib/api'
import { cn } from '@/lib/utils'

interface CommunityCommentsProps {
  analysisId: number
  /** 지금 보는 사람이 이 분석의 소유자인가 — 소유자는 남의 댓글도 지울 수 있다
   * (2026-09-10 사용자 결정). Analysis.isOwner를 그대로 넘겨받는다. */
  isOwner: boolean
}

interface CommentRowProps {
  comment: Comment
  isReply: boolean
  canDelete: boolean
  deletePending: boolean
  isLoggedIn: boolean
  onDelete: () => void
  onReact: (value: 'like' | 'dislike') => void
  reactPending: boolean
  onReplyClick: () => void
  replyOpen: boolean
  onReport: (reason: string) => Promise<unknown>
}

function CommentRow({
  comment: c,
  isReply,
  canDelete,
  deletePending,
  isLoggedIn,
  onDelete,
  onReact,
  reactPending,
  onReplyClick,
  replyOpen,
  onReport,
}: CommentRowProps) {
  return (
    <div className={cn('rounded-md border border-border p-3', isReply && 'border-dashed bg-muted/30')}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{c.username}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{c.createdAt.replace('T', ' ')}</span>
          {canDelete && (
            <button
              type="button"
              aria-label="댓글 삭제"
              title="댓글 삭제"
              disabled={deletePending}
              onClick={onDelete}
              className="rounded-sm text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <button
          type="button"
          disabled={!isLoggedIn || reactPending}
          title={isLoggedIn ? '좋아요' : '로그인이 필요합니다'}
          aria-label="좋아요"
          onClick={() => onReact('like')}
          className={cn(
            'flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none disabled:opacity-50',
            c.myReaction === 'like' && 'text-rose-400 hover:text-rose-400',
          )}
        >
          <ThumbsUp className={cn('h-3.5 w-3.5', c.myReaction === 'like' && 'fill-current')} />
          {c.likeCount}
        </button>
        <button
          type="button"
          disabled={!isLoggedIn || reactPending}
          title={isLoggedIn ? '싫어요' : '로그인이 필요합니다'}
          aria-label="싫어요"
          onClick={() => onReact('dislike')}
          className={cn(
            'flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none disabled:opacity-50',
            c.myReaction === 'dislike' && 'text-sky-400 hover:text-sky-400',
          )}
        >
          <ThumbsDown className={cn('h-3.5 w-3.5', c.myReaction === 'dislike' && 'fill-current')} />
          {c.dislikeCount}
        </button>
        {!isReply && (
          <button
            type="button"
            disabled={!isLoggedIn}
            title={isLoggedIn ? '답글' : '로그인이 필요합니다'}
            aria-label="답글 달기"
            onClick={onReplyClick}
            className={cn(
              'flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-none disabled:opacity-50',
              replyOpen && 'text-foreground',
            )}
          >
            <Reply className="h-3.5 w-3.5" />
            답글
          </button>
        )}
        {/* 신고(개선 로드맵 §5.5, 2026-09-20) — 작성자 본인 댓글도 신고 버튼은
         * 그대로 둔다(신고 자체를 막을 이유가 없다). */}
        <ReportButton isLoggedIn={isLoggedIn} onReport={onReport} />
      </div>
    </div>
  )
}

/**
 * 댓글(TO-DO 12번, 커뮤니티) + 대댓글·좋아요/싫어요(TO-DO 54, 2026-09-16).
 * 공유된 분석(SharePage) 전체에 붙는 목록. 2026-09-10 사용자 결정 3가지를
 * 그대로 따르되, 2026-09-16에 "대댓글을 남길 수 있으면 좋겠어. 그리고
 * 댓글에 좋아요 싫어요 기능도 추가해줘"로 스레드 없음 결정이 번복됐다:
 * 1) 작성은 로그인한 사용자만
 * 2) 대댓글은 1단계 깊이만(대댓글에 또 답글을 달면 백엔드가 최상위 댓글로
 *    평탄화 — crud.create_comment 참조). 무한 중첩 UI를 피하기 위한
 *    설계 판단(사용자 확인 전)
 * 3) 삭제는 작성자 본인 또는 분석 소유자만(백엔드가 403으로 강제)
 * 좋아요/싫어요는 상호 배타적 토글이다 — 좋아요를 누른 상태에서 싫어요를
 * 누르면 좋아요가 취소되고 싫어요로 전환된다(analyses 좋아요와 달리
 * "중립"도 있는 3상태).
 *
 * EditorPage가 아니라 SharePage(읽기 전용 공개 뷰)에만 붙인다 — 기존
 * 배치 이유 그대로.
 */
export function CommunityComments({ analysisId, isOwner }: CommunityCommentsProps) {
  const { data: comments, isLoading } = useComments(analysisId)
  const { user, isLoggedIn } = useCurrentUser()
  const createMutation = useCreateComment(analysisId)
  const deleteMutation = useDeleteComment(analysisId)
  const reactMutation = useToggleCommentReaction(analysisId)
  const reportMutation = useReportComment()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)

  const topLevel = comments?.filter((c) => !c.parentId) ?? []
  const repliesByParent = new Map<number, Comment[]>()
  for (const c of comments ?? []) {
    if (!c.parentId) continue
    const list = repliesByParent.get(c.parentId) ?? []
    list.push(c)
    repliesByParent.set(c.parentId, list)
  }
  const totalCount = comments?.length ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setError(null)
    try {
      await createMutation.mutateAsync({ body })
      setBody('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 남기지 못했습니다.')
    }
  }

  const handleReplySubmit = async (e: React.FormEvent, parentId: number) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    setReplyError(null)
    try {
      await createMutation.mutateAsync({ body: replyBody, parentId })
      setReplyBody('')
      setReplyingTo(null)
    } catch (err) {
      setReplyError(err instanceof ApiError ? err.message : '답글을 남기지 못했습니다.')
    }
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-2xl">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        댓글{totalCount > 0 ? ` (${totalCount})` : ''}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">불러오는 중…</p>}

      {!isLoading && topLevel.length === 0 && (
        <p className="text-sm text-muted-foreground">아직 댓글이 없습니다. 첫 의견을 남겨보세요.</p>
      )}

      {topLevel.length > 0 && (
        <ul className="flex flex-col gap-3">
          {topLevel.map((c) => {
            const replies = repliesByParent.get(c.id) ?? []
            return (
              <li key={c.id} className="flex flex-col gap-2">
                <CommentRow
                  comment={c}
                  isReply={false}
                  canDelete={isLoggedIn && (c.userId === user?.id || isOwner)}
                  deletePending={deleteMutation.isPending}
                  isLoggedIn={isLoggedIn}
                  onDelete={() => deleteMutation.mutate(c.id)}
                  onReact={(value) => reactMutation.mutate({ commentId: c.id, value })}
                  reactPending={reactMutation.isPending}
                  onReplyClick={() => {
                    setReplyingTo(replyingTo === c.id ? null : c.id)
                    setReplyError(null)
                  }}
                  replyOpen={replyingTo === c.id}
                  onReport={(reason) => reportMutation.mutateAsync({ commentId: c.id, reason })}
                />

                {replies.length > 0 && (
                  <ul className="ml-6 flex flex-col gap-2">
                    {replies.map((r) => (
                      <li key={r.id}>
                        <CommentRow
                          comment={r}
                          isReply
                          canDelete={isLoggedIn && (r.userId === user?.id || isOwner)}
                          deletePending={deleteMutation.isPending}
                          isLoggedIn={isLoggedIn}
                          onDelete={() => deleteMutation.mutate(r.id)}
                          onReact={(value) => reactMutation.mutate({ commentId: r.id, value })}
                          reactPending={reactMutation.isPending}
                          onReplyClick={() => {}}
                          replyOpen={false}
                          onReport={(reason) => reportMutation.mutateAsync({ commentId: r.id, reason })}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {replyingTo === c.id && (
                  <form onSubmit={(e) => handleReplySubmit(e, c.id)} className="ml-6 flex flex-col gap-2">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder={`${c.username}님에게 답글`}
                      maxLength={2000}
                      rows={2}
                      disabled={createMutation.isPending}
                      autoFocus
                    />
                    {replyError && <p className="text-sm text-destructive">{replyError}</p>}
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyingTo(null)
                          setReplyBody('')
                          setReplyError(null)
                        }}
                      >
                        취소
                      </Button>
                      <Button type="submit" size="sm" disabled={createMutation.isPending || !replyBody.trim()}>
                        {createMutation.isPending ? '등록 중…' : '답글 등록'}
                      </Button>
                    </div>
                  </form>
                )}
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
