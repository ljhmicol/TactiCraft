import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PitchFieldBackdrop } from '@/components/decor/PitchFieldBackdrop'
import { BottomActionBar } from '@/components/editor/BottomActionBar'
import { RecentAnalyses } from '@/components/editor/RecentAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { CommentPanel } from '@/components/editor/CommentPanel'
import { DuplicateButton } from '@/components/editor/DuplicateButton'
import { LayerToggleChips } from '@/components/editor/LayerToggleChips'
import { MatchInfoForm } from '@/components/editor/MatchInfoForm'
import { TagInput } from '@/components/editor/TagInput'
import { PhaseTabs } from '@/components/editor/PhaseTabs'
import { PlayerEditDialog } from '@/components/editor/PlayerEditDialog'
import { PlayerForm } from '@/components/editor/PlayerForm'
import { SaveButton } from '@/components/editor/SaveButton'
import { CommunityShareToggle } from '@/components/editor/CommunityShareToggle'
import { ShareLinkButton } from '@/components/editor/ShareLinkButton'
import { Timeline } from '@/components/editor/Timeline'
import { ToolPalette } from '@/components/editor/ToolPalette'
import { UndoRedoButtons } from '@/components/editor/UndoRedoButtons'
import { ExportControls } from '@/components/export/ExportControls'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { CompactnessBox } from '@/components/pitch/CompactnessBox'
import { DrawOverlay } from '@/components/pitch/DrawOverlay'
import { GhostLayer } from '@/components/pitch/GhostLayer'
import { OpponentNode } from '@/components/pitch/OpponentNode'
import { OverloadLayer } from '@/components/pitch/OverloadLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PlayerNode } from '@/components/pitch/PlayerNode'
import { PressingLine } from '@/components/pitch/PressingLine'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { pressingLineLevel, type PressingLineLevel } from '@/lib/compactness'
import { FORMATION_NAMES } from '@/lib/formations'
import { currentPressingLineLevel, findGkPlayerId, PRESSING_LINE_LEVELS } from '@/lib/pressingLineSteps'
import { useAnalysisStore } from '@/store/analysisStore'
import type { PhaseType } from '@/types/analysis'

const PHASE_LABELS: Record<PhaseType, string> = {
  base: '기본',
  attack: '공격',
  defense: '수비',
}

/**
 * / — 편집기. 분석이 없으면 빈 안내, 있으면 피치 + 경기정보/선수 패널을 보여준다.
 * 레이어 z-순서(2단계 §9): 채널 그리드 → 콤팩트니스 → 압박 라인 → 오버로드 → Ghost → 선수 노드(최상단).
 *
 * 모바일(§11.2): 국면 탭 sticky, 레이어 칩 가로 스크롤(LayerToggleChips 자체 구현),
 * 하단 고정 액션 바. 데스크톱(§11.1)에서는 2단 그리드로 배치된다.
 *
 * 선수 목록은 기본 접힘이다(2026-09-07 확정) — 한때 기본 펼침으로 바꿨다가
 * 사용자 요청으로 다시 접힘으로 되돌렸다. 못 찾는 문제는 펼침 여부가
 * 아니라 헤더가 클릭 가능해 보이지 않던 게 원인이었어서, 셰브런 아이콘 +
 * hover 배경으로 아코디언처럼 보이게 하는 쪽으로 해결했다.
 *
 * 선수 목록은 피치의 왼쪽에 별도 컬럼으로 있다(2026-09-07, 2차 수정 —
 * "아예 필드 왼쪽이면 좋겠어") — 처음엔 피치와 같은 컬럼 안에 아래로
 * 붙였는데, 그게 아니라 피치 옆(왼쪽)에 나란히 두길 원했다. 데스크톱
 * 그리드는 [선수 목록 300px] [피치 flex] [경기정보 380px] 3열이고,
 * DOM 순서는 피치 → 선수 목록 → 경기정보를 유지한 채(모바일 1열 스택 시
 * 피치가 먼저 보이도록) `lg:order-first`로 데스크톱에서만 맨 왼쪽으로
 * 시각적으로 옮긴다. 목록 내용물 div에만 `overflow-y-auto`를 줘서
 * 선수가 많아져도(최대 23명) 그 박스 안에서만 스크롤되고 페이지 전체
 * 높이는 늘어나지 않는다 — 헤더(summary)는 스크롤 대상 밖이라 항상 보인다.
 */
export function EditorPage() {
  const analysis = useAnalysisStore((s) => s.analysis)
  const currentPhase = useAnalysisStore((s) => s.currentPhase)
  const previousPhase = useAnalysisStore((s) => s.previousPhase)
  const selectedChangingPointId = useAnalysisStore((s) => s.selectedChangingPointId)
  const mergedStepIndex = useAnalysisStore((s) => s.mergedStepIndex)
  const layers = useAnalysisStore((s) => s.layers)
  const drawTool = useAnalysisStore((s) => s.drawTool)
  const addOpponents = useAnalysisStore((s) => s.addOpponents)
  const addOpponentsFromFormation = useAnalysisStore((s) => s.addOpponentsFromFormation)
  const removeOpponents = useAnalysisStore((s) => s.removeOpponents)
  const setPressingLineLevel = useAnalysisStore((s) => s.setPressingLineLevel)
  const setPressingLineDragging = useAnalysisStore((s) => s.setPressingLineDragging)
  const removeAnnotation = useAnalysisStore((s) => s.removeAnnotation)
  const addPlayer = useAnalysisStore((s) => s.addPlayer)
  // 화살표 선택 상태. 피치 어디를 눌러도(pointerdown 버블링) 해제된다 —
  // 화살표 자체는 stopPropagation으로 해제를 막는다.
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const { isLoggedIn, isChecking: isCheckingAuth } = useCurrentUser()

  if (!analysis) {
    return (
      <div className="relative">
        {/* 2026-09-11 "첫번째 화면에서도 이렇게 나오면 좋겠어" — /new의 축구장
         * 배경을 앱을 열었을 때 가장 먼저 보이는 이 빈 안내 화면(/)에도 확장. */}
        <PitchFieldBackdrop />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-24 text-center">
          <div className="flex flex-col items-center gap-4">
            <p className="text-muted-foreground">아직 분석이 없습니다.</p>
            <div className="flex flex-col items-center gap-2">
              <Button asChild>
                <Link to="/new">새 분석 시작</Link>
              </Button>
              {!isCheckingAuth && !isLoggedIn && (
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline">
                    <Link to="/login">로그인</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/register">회원가입</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
          <RecentAnalyses />
        </div>
      </div>
    )
  }

  // 타임라인에서 체인징 포인트를 골랐으면 그 스냅샷을, 아니면 평소대로
  // currentPhase를 피치에 보여준다 — 편집 액션은 스토어가 알아서 같은 곳에
  // 쓴다(TO-DO 5번). 찾지 못하면(삭제 직후 등) 국면으로 안전하게 되돌아간다.
  const changingPoint = selectedChangingPointId
    ? analysis.changingPoints?.find((cp) => cp.id === selectedChangingPointId)
    : undefined
  // 병합된 시점(steps 보유)을 고르면 스토어가 mergedStepIndex를 0부터 자동으로
  // 증가시킨다(TIMELINE_STEP_INTERVAL_MS 간격) — 재생 중엔 그 스텝의 스냅샷을,
  // 다 재생되면(null) 이 체인징 포인트 자체(전체 화살표 요약)를 보여준다
  // (2026-09-09, "병합하면 시간순으로 자연스럽게 이어지게").
  const mergedStep =
    changingPoint?.steps && mergedStepIndex !== null ? changingPoint.steps[mergedStepIndex] : undefined
  const phase = mergedStep ?? changingPoint ?? analysis.phases[currentPhase]
  // 스텝을 다 재생하고 정착한 요약 프레임(mergedStep이 없어지는 순간)의
  // annotations는 8~10개 다리를 전부 이어붙인 하나의 긴 체인이다 — 공이
  // 그 전체 구간을 처음부터 다시 흐르며 재생된다. 그런데 이 프레임에
  // 도달하는 유일한 경로가 "방금 스텝별로 한 다리씩 다 보여준 뒤"뿐이라
  // (steps가 있으면 selectChangingPoint가 항상 0번부터 재생한다), 선수는
  // 이미 도착해 가만히 있는데 공만 전체 경로를 처음부터 한 번 더 훑는
  // 것처럼 보였다(2026-09-10 사용자 리포트 "이후엔 선수들은 가만히 있고
  // 공만 움직인다"). 이 프레임에서만 공 애니메이션을 끄고 화살표만
  // 정적으로 남긴다 — 스텝 재생 중(mergedStep이 있을 때)과 병합되지 않은
  // 보통 화면은 그대로 애니메이션을 보여준다.
  const isSettledMergeSummary = Boolean(changingPoint?.steps && changingPoint.steps.length > 1 && !mergedStep)
  // 국면 전환 때 잠깐 자동으로 뜨던 고스트는 없앴다(2026-09-08 "잠깐 보이는 고스트
  // 없애줘") — 이제 레이어 칩으로 켠 경우에만(Ghost View, 수동 토글) 보인다.
  // 체인징 포인트를 보는 중엔 "직전 국면"이라는 개념이 없어 항상 끈다.
  const showGhost = !changingPoint && Boolean(previousPhase) && previousPhase !== currentPhase && layers.ghostView
  const hasOpponent = Boolean(phase.opponentPositions && phase.opponentPositions.length > 0)
  const gkId = findGkPlayerId(analysis.players, analysis.formation)
  const pressingLevel = currentPressingLineLevel(phase.positions, gkId)

  return (
    <div className="flex flex-col gap-4 p-6 pb-24 lg:pb-6">
      <div
        id="export-toolbar"
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"
      >
        <div>
          <p className="font-semibold text-foreground">
            {analysis.match.matchName || `${analysis.match.homeTeam} vs ${analysis.match.awayTeam}` || '새 분석'}
          </p>
          <p className="text-xs text-muted-foreground">{analysis.match.matchDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton analysis={analysis} />
          <DuplicateButton analysis={analysis} />
          <ShareLinkButton analysis={analysis} />
          <CommunityShareToggle analysis={analysis} />
          <ExportControls analysis={analysis} phase={currentPhase} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(420px,1fr)_380px]">
        <div className="flex flex-col items-center gap-3">
          <div className="sticky top-0 z-10 w-full max-w-md bg-background py-2">
            <PhaseTabs />
          </div>
          <Timeline />
          <div className="flex w-full max-w-md justify-end">
            <UndoRedoButtons />
          </div>
          <ToolPalette />
          {/* 실기기 리포트(2026-09-11, "그래도 전술판이 안 보여") — 화면에 직접
           * 찍은 진단 배너로 실제 iPhone Safari에서 이 div의 계산된 너비가
           * 0px임을 확인했다(높이는 474px로 정상). 원인: 이 div는 `flex-col
           * items-center`인 부모의 flex 아이템인데 너비 클래스가 전혀
           * 없었다 — 형제 요소들(PhaseTabs 줄·UndoRedoButtons 줄)은 전부
           * `w-full max-w-md`를 명시하는데 이 div만 빠져 있었다. 너비가
           * 없는 flex 아이템은 `align-items:center`에서 내용물 기준으로
           * shrink-to-fit되는데, 내용물(Pitch)이 다시 퍼센트(`w-full`)로
           * 이 div를 기준 삼는 순환 참조라 데스크톱 엔진(Chromium·데스크톱
           * WebKit)은 남는 공간으로 관대하게 처리했지만 이 iOS Safari
           * 빌드는 0으로 접었다. `vh`→`dvh`(아래)는 높이 쪽 문제였고 실제
           * 사라진 원인은 이 너비 누락이었다 — 형제와 같은 `w-full
           * max-w-md`를 명시해 순환 참조 자체를 없앤다. */}
          <div
            className="h-[65vh] w-full max-w-md supports-[height:100dvh]:h-[65dvh]"
            data-testid="editor-pitch"
            onPointerDown={() => setSelectedAnnotationId(null)}
          >
            <Pitch>
              {layers.channelGrid && <ChannelGrid halfSpaces={layers.halfSpaces} />}
              {layers.compactness && <CompactnessBox positions={phase.positions} />}
              {layers.pressingLine && (
                <PressingLine
                  positions={phase.positions}
                  pressingLineY={phase.pressingLineY}
                  onDragY={(y) => setPressingLineLevel(pressingLineLevel(y))}
                  onDragStart={() => setPressingLineDragging(true)}
                  onDragEnd={() => setPressingLineDragging(false)}
                />
              )}
              {layers.overload && hasOpponent && <OverloadLayer phase={phase} />}
              {showGhost && previousPhase && (
                <GhostLayer
                  previousPositions={analysis.phases[previousPhase].positions}
                  currentPositions={phase.positions}
                />
              )}
              <AnnotationLayer
                annotations={phase.annotations}
                animated={!isSettledMergeSummary}
                interactive={{
                  selectedId: selectedAnnotationId,
                  onSelect: setSelectedAnnotationId,
                  onRemove: (id) => {
                    removeAnnotation(id)
                    setSelectedAnnotationId(null)
                  },
                }}
              />
              {phase.opponentPositions?.map((pos, i) => (
                <OpponentNode key={i} slot={i} position={pos} />
              ))}
              {analysis.players.map((player) => {
                const pos = phase.positions.find((p) => p.playerId === player.id)
                if (!pos) return null
                return <PlayerNode key={player.id} player={player} position={pos} />
              })}
              <DrawOverlay tool={drawTool} />
            </Pitch>
          </div>
          <div className="flex w-full max-w-md flex-wrap items-center justify-between gap-3">
            <LayerToggleChips hasOpponent={hasOpponent} />
            <div className="flex items-center gap-2">
              {/* 상대 포메이션을 고르면 그 모양을 하프라인 기준 대칭으로 즉시 배치한다
                  (TO-DO 4번) — "상대팀 추가" 버튼(자팀과 동일한 배치)과 별개로,
                  자팀과 다른 모양(예: 4-4-2 로우블록)의 상대를 11개 점을 일일이
                  드래그하지 않고 바로 켤 수 있게 한다. */}
              <Select onValueChange={addOpponentsFromFormation}>
                <SelectTrigger className="h-9 w-[128px]" aria-label="상대 포메이션 선택">
                  <SelectValue placeholder="상대 포메이션" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATION_NAMES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={hasOpponent ? removeOpponents : addOpponents}>
                {hasOpponent ? '상대팀 제거' : '상대팀 추가'}
              </Button>
            </div>
          </div>
          <div className="flex w-full max-w-md items-center gap-2">
            {/* FM 스타일 압박 라인 5단계(2026-09-08 사용자 요청) — GK를 제외한 전원을
                평행이동해서 공격·미드·수비 라인 사이 간격(비율)은 그대로 두고
                대형 전체를 밀어올리거나 내린다(lib/pressingLineSteps.ts). 현재
                단계를 그대로 선택값으로 보여준다(쓰기 전용 트리거가 아님) —
                "지금 몇 단계인지" 자체가 정보라서. */}
            <span className="text-xs text-muted-foreground">압박 라인</span>
            <Select value={pressingLevel ?? undefined} onValueChange={(v) => setPressingLineLevel(v as PressingLineLevel)}>
              <SelectTrigger className="h-9 w-[110px]" aria-label="압박 라인 단계 선택">
                <SelectValue placeholder="단계 선택" />
              </SelectTrigger>
              <SelectContent>
                {PRESSING_LINE_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="w-full lg:order-first">
          <details className="group rounded-md border border-border">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-md p-3 text-sm font-semibold text-foreground hover:bg-secondary [&::-webkit-details-marker]:hidden">
              <span>선수 (선발 11 + 벤치 {Math.max(0, analysis.players.length - 11)})</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            {/* 목록 자체만 스크롤된다 — 선수가 많아져도(최대 23명) 페이지 전체가
                늘어나지 않고 이 박스 안에서만 스크롤바가 생긴다 (2026-09-07). */}
            <div className="max-h-[70vh] supports-[height:100dvh]:max-h-[70dvh] space-y-2 overflow-y-auto px-3 pb-3">
              {analysis.players.map((player, i) => (
                <PlayerForm key={player.id} player={player} index={i} />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={analysis.players.length >= 23}
                onClick={addPlayer}
              >
                선수 추가
              </Button>
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">경기 정보</h2>
            <MatchInfoForm match={analysis.match} />
            <div className="mt-3">
              <TagInput tags={analysis.tags} />
            </div>
          </section>

          <section>
            <CommentPanel
              title={changingPoint ? changingPoint.label : PHASE_LABELS[currentPhase]}
              comment={phase.comment}
              summary={analysis.summary}
            />
          </section>
        </div>
      </div>

      <BottomActionBar analysis={analysis} />
      <PlayerEditDialog />
    </div>
  )
}
