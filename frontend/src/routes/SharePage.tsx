import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { PrintOpponentNode } from '@/components/pitch/PrintOpponentNode'
import { SharePlayerNode } from '@/components/pitch/SharePlayerNode'
import { useAnalysis } from '@/hooks/useAnalyses'
import { cn } from '@/lib/utils'
import type { LayerToggles, PhaseData, PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = { base: '기본', attack: '공격', defense: '수비' }
const PHASES: PhaseType[] = ['base', 'attack', 'defense']

type ViewKey = { kind: 'phase'; phase: PhaseType } | { kind: 'cp'; id: string }

/**
 * /share/:id — 저장된 분석의 읽기 전용 공개 뷰(TO-DO 8번). 편집기와 달리
 * `useAnalysisStore`를 전혀 쓰지 않는다 — 이 페이지가 보여주는 분석은 지금
 * 브라우저에 "열려 있는" 분석과 무관할 수 있어서(다른 사람이 링크로 바로
 * 들어옴), 스토어에 얹으면 그 사람이 우연히 편집기를 열었을 때 남의 분석이
 * 뜨는 문제가 생긴다. 대신 드래그 불가능한 읽기 전용 컴포넌트로 그린다 —
 * 자팀은 `SharePlayerNode`(run 화살표 반복 루프는 재현하되 드래그는 없음),
 * 상대팀은 `PrintOpponentNode`(GIF 내보내기와 공용).
 */
export function SharePage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : undefined
  const { data: analysis, isLoading, isError } = useAnalysis(numericId)

  const [view, setView] = useState<ViewKey>({ kind: 'phase', phase: 'base' })
  const [layers, setLayers] = useState<LayerToggles>({
    channelGrid: true,
    halfSpaces: true,
    pressingLine: true,
    compactness: false,
    overload: false,
    ghostView: false,
  })

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중…</div>
  if (isError || !analysis) return <div className="p-6 text-destructive">분석을 찾을 수 없습니다.</div>

  const changingPoints = analysis.changingPoints ?? []
  const phase: PhaseData =
    view.kind === 'cp' ? (changingPoints.find((cp) => cp.id === view.id) ?? analysis.phases.base) : analysis.phases[view.phase]
  const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
  const title =
    view.kind === 'cp' ? (changingPoints.find((cp) => cp.id === view.id)?.label ?? '') : PHASE_LABELS[view.phase]
  const bodyText = view.kind === 'phase' && view.phase === 'base' ? analysis.summary : phase.comment
  // 기본 국면은 정지 상태여야 한다(에디터의 PlayerNode와 동일 규칙) — 그 외
  // (공격/수비/체인징 포인트)에서만 run 화살표 반복 루프를 켠다.
  const runAnnotations =
    view.kind === 'phase' && view.phase === 'base' ? undefined : phase.annotations.filter((a) => a.type === 'run')

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">읽기 전용 공유 링크</p>
        <h1 className="text-xl font-semibold text-foreground">
          {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {analysis.match.matchDate}
          {analysis.match.competition ? ` · ${analysis.match.competition}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          {PHASES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setView({ kind: 'phase', phase: p })}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
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
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
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

      <div className="mx-auto h-[65vh] w-full max-w-md" data-testid="share-pitch">
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
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
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
    </div>
  )
}
