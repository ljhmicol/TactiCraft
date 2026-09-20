import { Heart } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { CommunityComments } from '@/components/comments/CommunityComments'
import { ReportButton } from '@/components/common/ReportButton'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { PrintOpponentNode } from '@/components/pitch/PrintOpponentNode'
import { SharePlayerNode } from '@/components/pitch/SharePlayerNode'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SharePngCard } from '@/components/export/SharePngCard'
import { useAnalysis, useSharedAnalysis } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { useToggleLike } from '@/hooks/useCommunity'
import { useReportAnalysis } from '@/hooks/useModeration'
import { exportCard } from '@/lib/exportImage'
import { cn } from '@/lib/utils'
import type { Analysis, LayerToggles, PhaseData, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }
const PHASES: PhaseType[] = ['base', 'attack', 'defense']

type ViewKey = { kind: 'phase'; phase: PhaseType } | { kind: 'cp'; id: string }

/**
 * /share/:id(커뮤니티 공개) + /s/:token(링크 공개, 2026-09-18 개선 로드맵
 * §5.2) — 저장된 분석의 읽기 전용 공개 뷰(TO-DO 8번). 두 라우트가 fetch
 * 방식만 다르고(`SharePage`는 id로 `/api/analyses/:id`, `SharedLinkPage`는
 * 토큰으로 `/api/share/:token`) 나머지 렌더링은 100% 같아서 `ShareView`
 * 하나를 공유한다 — "비공개 분석이 id 스캔으로 새던 문제"를 고치면서
 * "링크 공개"라는 새 접근 경로가 생겼을 뿐, 화면 자체가 달라질 이유는
 * 없었다.
 *
 * 편집기와 달리
 * `useAnalysisStore`를 전혀 쓰지 않는다 — 이 페이지가 보여주는 분석은 지금
 * 브라우저에 "열려 있는" 분석과 무관할 수 있어서(다른 사람이 링크로 바로
 * 들어옴), 스토어에 얹으면 그 사람이 우연히 편집기를 열었을 때 남의 분석이
 * 뜨는 문제가 생긴다. 대신 드래그 불가능한 읽기 전용 컴포넌트로 그린다 —
 * 자팀은 `SharePlayerNode`(run 화살표 반복 루프는 재현하되 드래그는 없음),
 * 상대팀은 `PrintOpponentNode`(GIF 내보내기와 공용).
 *
 * PNG 다운로드(TO-DO 26번)는 에디터의 `ShareCard`/`exportCard`와 같은
 * 방식(고정 1080px 카드를 화면 밖에 렌더링해 캡처)이지만 `useAnalysisStore`를
 * 읽지 않는 `SharePngCard`를 따로 쓴다 — 레이어 토글을 이 페이지의 로컬
 * state로 props를 통해 넘긴다.
 *
 * 댓글(TO-DO 12번)도 여기 붙는다 — "공유된 분석에 의견"이라는 항목 설명과
 * 맞는 자리이자, EditorPage(자기 분석 편집)에 더 끼워 넣기엔 이미 레이아웃이
 * 복잡하다. `isOwner`는 GET 응답에 서버가 계산해 넣어준다(비로그인 방문자는
 * 항상 false) — 소유자는 자기 분석의 공유 링크에서 남의 댓글도 지울 수 있다.
 *
 * 좋아요(TO-DO 58, 2026-09-17) — "커뮤니티에서 게시물에 좋아요 누르는
 * 방법이 없어" 리포트로 추가. 좋아요 자체는 TO-DO 41 후속에서 이미
 * 구현됐지만 `/community` 목록 카드의 작은 하트에만 있었고, 실제로 게시물을
 * 읽는 이 화면(/share/:id)엔 없었다 — "게시물"이라는 단위를 생각하면 목록
 * 카드보다 여기가 더 자연스러운 자리다. CommunityPage와 같은
 * `useToggleLike` 훅을 그대로 재사용한다(같은 API, 성공 시 이 분석의
 * 상세 캐시도 같이 무효화하도록 훅 쪽을 확장했다).
 */
export function SharePage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : undefined
  const { data: analysis, isLoading, isError } = useAnalysis(numericId)
  return <ShareView analysis={analysis} isLoading={isLoading} isError={isError} />
}

/** /s/:token — 링크 공개(개선 로드맵 §5.2) 전용 진입점. SharePage와 렌더링은
 * 같고 fetch만 토큰 기반이다(useSharedAnalysis). */
export function SharedLinkPage() {
  const { token } = useParams<{ token: string }>()
  const { data: analysis, isLoading, isError } = useSharedAnalysis(token)
  return <ShareView analysis={analysis} isLoading={isLoading} isError={isError} />
}

function ShareView({
  analysis,
  isLoading,
  isError,
}: {
  analysis: Analysis | undefined
  isLoading: boolean
  isError: boolean
}) {
  const { isLoggedIn } = useCurrentUser()
  const navigate = useNavigate()
  const toggleLike = useToggleLike()
  const reportAnalysis = useReportAnalysis()

  const [view, setView] = useState<ViewKey>({ kind: 'phase', phase: 'base' })
  const [layers, setLayers] = useState<LayerToggles>({
    channelGrid: true,
    halfSpaces: true,
    pressingLine: true,
    compactness: false,
    overload: false,
    ghostView: false,
  })
  const [ratio, setRatio] = useState<'1:1' | '4:5'>('1:1')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중…</div>
  if (isError || !analysis) return <div className="p-6 text-destructive">분석을 찾을 수 없습니다.</div>

  const changingPoints = analysis.changingPoints ?? []
  const phase: PhaseData =
    view.kind === 'cp' ? (changingPoints.find((cp) => cp.id === view.id) ?? analysis.phases.base) : analysis.phases[view.phase]
  const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
  const title =
    view.kind === 'cp' ? (changingPoints.find((cp) => cp.id === view.id)?.label ?? '') : PHASE_LABELS[view.phase]
  const cardTitle = view.kind === 'phase' ? `${title} 국면` : title
  const bodyText = view.kind === 'phase' && view.phase === 'base' ? analysis.summary : phase.comment
  // 기본 국면은 정지 상태여야 한다(에디터의 PlayerNode와 동일 규칙) — 그 외
  // (공격/수비/체인징 포인트)에서만 run 화살표 반복 루프를 켠다.
  const runAnnotations =
    view.kind === 'phase' && view.phase === 'base' ? undefined : phase.annotations.filter((a) => a.type === 'run')

  const handleExport = async () => {
    if (!cardRef.current) return
    setExporting(true)
    try {
      await exportCard(cardRef.current, ratio)
    } finally {
      setExporting(false)
    }
  }

  const handleLikeClick = () => {
    if (!analysis.id) return
    if (!isLoggedIn) {
      navigate('/login')
      return
    }
    toggleLike.mutate(analysis.id)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">읽기 전용 공유 링크</p>
          <h1 className="text-2xl font-semibold text-foreground">
            {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {analysis.match.matchDate}
            {analysis.match.competition ? ` · ${analysis.match.competition}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={ratio} onValueChange={(v) => setRatio(v as '1:1' | '4:5')}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1</SelectItem>
              <SelectItem value="4:5">4:5</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? '내보내는 중…' : 'PNG 다운로드'}
          </Button>
        </div>
      </div>

      <SharePngCard
        ref={cardRef}
        analysis={analysis}
        phase={phase}
        title={cardTitle}
        bodyText={bodyText}
        runAnnotations={runAnnotations}
        layers={layers}
        ratio={ratio}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setView({ kind: 'phase', phase: p })}
              className={cn(
                'whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                view.kind === 'phase' && view.phase === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {PHASE_LABELS[p]}
            </button>
          ))}
        </div>
        {changingPoints.map((cp) => (
          <button
            key={cp.id}
            type="button"
            onClick={() => setView({ kind: 'cp', id: cp.id })}
            className={cn(
              'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              view.kind === 'cp' && view.id === cp.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {cp.minute != null ? `${cp.minute}' ` : ''}
            {cp.label}
          </button>
        ))}
      </div>

      {/* EditorPage와 같은 이유(2026-09-11)로 dvh 폴백 — 모바일 실기기에서만
       * 주소창 때문에 vh가 잘못 계산되는 문제 대응. */}
      <div
        className="mx-auto h-[65vh] w-full max-w-md supports-[height:100dvh]:h-[65dvh]"
        data-testid="share-pitch"
      >
        <Pitch>
          {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
          {layers.compactness && <CompactnessBox positions={phase.positions} />}
          {layers.pressingLine && <PressingLine positions={phase.positions} pressingLineY={phase.pressingLineY} />}
          {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
          <AnnotationLayer annotations={phase.annotations} />
          {phase.opponentPositions?.map((pos, i) => <PrintOpponentNode key={i} position={pos} />)}
          {analysis.players.map((player, index) => {
            const pos = phase.positions.find((p) => p.playerId === player.id)
            if (!pos) return null
            return (
              <SharePlayerNode
                key={player.id}
                player={player}
                position={pos}
                formation={analysis.formation}
                index={index}
                runAnnotations={runAnnotations}
              />
            )
          })}
        </Pitch>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['channelGrid', '5채널'],
            ['halfSpaces', '하프'],
            ['pressingLine', '압박'],
            ['compactness', '콤팩'],
            ['overload', '오버'],
          ] as [keyof LayerToggles, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            disabled={key === 'overload' && !hasOpponent}
            onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
            className={cn(
              'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              key === 'overload' && !hasOpponent
                ? 'cursor-not-allowed bg-secondary text-slate-300'
                : layers[key]
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {bodyText && (
        <div>
          <p className="mb-1 text-sm font-semibold text-foreground">{title} 코멘트</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{bodyText}</p>
        </div>
      )}

      {/* 좋아요(TO-DO 58) 위치 — 처음엔 제목 아래(상단)에 뒀다가, "좋아요를
       * 댓글 바로 위로 이동시켜줘"(2026-09-17) 요청으로 여기로 옮겼다.
       * "게시물을 다 읽고 반응한다"는 순서(먼저 전술판·코멘트를 보고,
       * 그다음 반응 표시 → 댓글)가 소셜 피드에서 더 흔한 배치라는 판단. */}
      <button
        type="button"
        onClick={handleLikeClick}
        disabled={toggleLike.isPending}
        title={isLoggedIn ? undefined : '로그인이 필요합니다'}
        className={cn(
          'flex items-center gap-1.5 self-start text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none disabled:opacity-50',
          analysis.likedByMe && 'text-rose-400 hover:text-rose-400',
        )}
        aria-label={analysis.likedByMe ? '좋아요 취소' : '좋아요'}
      >
        <Heart className={cn('h-4 w-4', analysis.likedByMe && 'fill-current')} />
        {analysis.likeCount ?? 0}
      </button>

      {/* 신고(개선 로드맵 §5.5, 2026-09-20) — 좋아요 바로 옆, 같은 "게시물에
       * 대한 반응" 그룹으로 묶었다. 소유자가 자기 글을 신고하는 것도 막지는
       * 않는다(막을 이유가 없고, 서버도 막지 않는다). */}
      {analysis.id !== undefined && (
        <ReportButton
          isLoggedIn={isLoggedIn}
          onReport={(reason) => reportAnalysis.mutateAsync({ analysisId: analysis.id as number, reason })}
        />
      )}

      {analysis.id !== undefined && <CommunityComments analysisId={analysis.id} isOwner={Boolean(analysis.isOwner)} />}
    </div>
  )
}
