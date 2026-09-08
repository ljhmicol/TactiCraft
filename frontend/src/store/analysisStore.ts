import { nanoid } from 'nanoid'
import { create } from 'zustand'

import type { PressingLineLevel } from '@/lib/compactness'
import { FORMATIONS } from '@/lib/formations'
import { findGkPlayerId, shiftPositionsToPressingLevel } from '@/lib/pressingLineSteps'
import type {
  Analysis,
  AnnotationType,
  ChangingPoint,
  DrawTool,
  LayerToggles,
  MatchInfo,
  PhaseData,
  PhaseType,
  Player,
  Point,
} from '@/types/analysis'

function emptyPhase(formation: string, players: Player[]) {
  const coords = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
  return {
    positions: players.map((player, i) => ({
      playerId: player.id,
      x: coords[i]?.x ?? 50,
      y: coords[i]?.y ?? 50,
    })),
    comment: '',
    annotations: [],
  }
}

export function createEmptyAnalysis(formation: string, match: MatchInfo): Analysis {
  const players: Player[] = Array.from({ length: 11 }, (_, i) => ({
    id: nanoid(),
    name: '',
    number: i + 1,
  }))

  return {
    schemaVersion: 1,
    match,
    formation,
    players,
    phases: {
      base: emptyPhase(formation, players),
      attack: emptyPhase(formation, players),
      defense: emptyPhase(formation, players),
    },
    summary: '',
  }
}

/** 국면 전환 애니메이션 사양 (2단계 §8). */
export const PHASE_TRANSITION_MS = 600

/**
 * 지금 피치에 보여야 할 데이터 — 타임라인 체인징 포인트를 고른 상태면 그것,
 * 아니면 평소대로 currentPhase (TO-DO 5번). movePlayer 등 모든 편집 액션이
 * "지금 국면"이 아니라 "지금 보이는 곳"에 쓰도록 이 두 헬퍼로 통일한다.
 */
function getActivePhaseData(
  analysis: Analysis,
  currentPhase: PhaseType,
  selectedChangingPointId: string | null,
): PhaseData {
  if (selectedChangingPointId) {
    const cp = analysis.changingPoints?.find((c) => c.id === selectedChangingPointId)
    if (cp) return cp
  }
  return analysis.phases[currentPhase]
}

function withActivePhaseUpdate(
  analysis: Analysis,
  currentPhase: PhaseType,
  selectedChangingPointId: string | null,
  updater: (phase: PhaseData) => PhaseData,
): Analysis {
  if (selectedChangingPointId && analysis.changingPoints?.some((c) => c.id === selectedChangingPointId)) {
    return {
      ...analysis,
      changingPoints: analysis.changingPoints.map((cp) =>
        cp.id === selectedChangingPointId ? { ...cp, ...updater(cp) } : cp,
      ),
    }
  }
  return {
    ...analysis,
    phases: { ...analysis.phases, [currentPhase]: updater(analysis.phases[currentPhase]) },
  }
}

interface AnalysisStore {
  analysis: Analysis | null
  currentPhase: PhaseType
  previousPhase: PhaseType | null // Ghost View(레이어 토글)가 참조하는 "직전 국면"
  layers: LayerToggles
  isMorphing: boolean
  isDirty: boolean
  drawTool: DrawTool // 전술 그리기 도구 (화면 설정 — 저장 대상 아님)
  curvedDraw: boolean // 다음에 그릴 화살표를 곡선으로 — 화면 설정, 저장 대상 아님(2026-09-07)
  editingPlayerId: string | null // 피치의 선수 클릭으로 연 편집 다이얼로그
  isPressingLineDragging: boolean // 압박 라인을 드래그하는 동안 true — PlayerNode가 모프 애니메이션 없이 즉시 따라오게 함(2026-09-08)
  selectedChangingPointId: string | null // 타임라인에서 고른 체인징 포인트 — null이면 평소대로 currentPhase를 보여준다 (TO-DO 5번)

  loadAnalysis: (a: Analysis) => void
  closeAnalysis: () => void // 로고 클릭 등 "처음 화면으로" — 로드된 분석을 비운다(2026-09-07)
  setPhase: (p: PhaseType) => void
  switchPhase: (p: PhaseType) => void // 국면 탭 클릭 — isMorphing/Ghost 타이밍까지 함께 처리, 체인징 포인트 보기는 해제
  setIsMorphing: (v: boolean) => void
  movePlayer: (playerId: string, x: number, y: number) => void // 지금 보이는 곳(국면 또는 체인징 포인트)에만 반영
  moveOpponent: (slot: number, x: number, y: number) => void
  setDrawTool: (t: DrawTool) => void
  toggleCurvedDraw: () => void
  setEditingPlayer: (id: string | null) => void
  addAnnotation: (type: AnnotationType, from: Point, to: Point, curved?: boolean) => void // 지금 보이는 곳에 추가
  removeAnnotation: (id: string) => void
  addOpponents: () => void // 지금 보이는 곳에 상대팀 11명 기본 배치 추가 (자팀 포메이션을 하프라인 기준 대칭)
  addOpponentsFromFormation: (formationName: string) => void // 자팀 대신 지정한 포메이션 템플릿을 대칭 배치 (TO-DO 4번)
  removeOpponents: () => void
  setPressingLineLevel: (level: PressingLineLevel) => void // GK 제외 전원을 평행이동해 압박 라인을 5단계로 지정 (간격 비율 유지)
  setComment: (text: string) => void // 지금 보이는 곳(국면 또는 체인징 포인트)의 코멘트
  setSummary: (text: string) => void
  addChangingPoint: (label: string, minute?: number) => void // 지금 보이는 곳을 스냅샷으로 복제해 새 체인징 포인트 생성 + 선택 (TO-DO 5번). minute을 주면 시간축의 그 위치에 바로 놓인다(2026-09-09, 시간축 클릭 추가)
  renameChangingPoint: (id: string, label: string) => void
  setChangingPointMinute: (id: string, minute: number | undefined) => void
  removeChangingPoint: (id: string) => void
  moveChangingPoint: (id: string, direction: 'left' | 'right') => void // 타임라인 순서 바꾸기
  selectChangingPoint: (id: string | null) => void // null이면 다시 국면 탭 보기로
  setMatchInfo: (patch: Partial<MatchInfo>) => void
  updatePlayer: (playerId: string, patch: Partial<Omit<Player, 'id'>>) => void
  addPlayer: () => void // 벤치 선수 추가 — 항상 배열 끝에 붙인다 (선발 인덱스 0~10 보존, TO-DO 14)
  removePlayer: (playerId: string) => void // 선발(현재 base 국면에 좌표가 있는 선수)은 지울 수 없다
  toggleLayer: (key: keyof LayerToggles) => void
  applyFormation: (name: string) => void // FR-06
  applySavedMeta: (meta: { id: number; createdAt: string; updatedAt: string }) => void // 저장 성공 후 id/시각만 반영
  setPressingLineDragging: (v: boolean) => void
}

const defaultLayers: LayerToggles = {
  channelGrid: true,
  halfSpaces: true,
  pressingLine: true,
  compactness: false,
  overload: false,
  ghostView: false,
}

let morphTimer: ReturnType<typeof setTimeout> | undefined

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  analysis: null,
  currentPhase: 'base',
  previousPhase: null,
  layers: defaultLayers,
  isMorphing: false,
  isDirty: false,
  drawTool: 'select',
  curvedDraw: false,
  editingPlayerId: null,
  isPressingLineDragging: false,
  selectedChangingPointId: null,

  loadAnalysis: (a) =>
    set({
      analysis: a,
      currentPhase: 'base',
      previousPhase: null,
      isDirty: false,
      editingPlayerId: null,
      selectedChangingPointId: null,
    }),

  closeAnalysis: () =>
    set({
      analysis: null,
      currentPhase: 'base',
      previousPhase: null,
      isDirty: false,
      drawTool: 'select',
      curvedDraw: false,
      editingPlayerId: null,
      isPressingLineDragging: false,
      selectedChangingPointId: null,
    }),

  setPhase: (p) => set({ currentPhase: p }),

  switchPhase: (next) => {
    const { currentPhase, selectedChangingPointId } = get()
    // 체인징 포인트를 보던 중이면 같은 국면 탭을 다시 눌러도(next === currentPhase)
    // 국면 탭 보기로 돌아가야 하므로 그 경우엔 조기 반환하지 않는다.
    if (next === currentPhase && !selectedChangingPointId) return

    clearTimeout(morphTimer)

    set({ previousPhase: currentPhase, currentPhase: next, isMorphing: true, selectedChangingPointId: null })

    morphTimer = setTimeout(() => set({ isMorphing: false }), PHASE_TRANSITION_MS)
  },

  setIsMorphing: (v) => set({ isMorphing: v }),

  movePlayer: (playerId, x, y) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        positions: phase.positions.map((pos) => (pos.playerId === playerId ? { ...pos, x, y } : pos)),
      })),
      isDirty: true,
    })
  },

  moveOpponent: (slot, x, y) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => {
        const opp = phase.opponentPositions ? [...phase.opponentPositions] : []
        opp[slot] = { x, y }
        return { ...phase, opponentPositions: opp }
      }),
      isDirty: true,
    })
  },

  setDrawTool: (t) => set({ drawTool: t }),

  toggleCurvedDraw: () => set((s) => ({ curvedDraw: !s.curvedDraw })),

  setEditingPlayer: (id) => set({ editingPlayerId: id }),

  setPressingLineDragging: (v) => set({ isPressingLineDragging: v }),

  addAnnotation: (type, from, to, curved) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        annotations: [...phase.annotations, { id: nanoid(), type, from, to, curved: curved || undefined }],
      })),
      isDirty: true,
    })
  },

  removeAnnotation: (id) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        annotations: phase.annotations.filter((a) => a.id !== id),
      })),
      isDirty: true,
    })
  },

  addOpponents: () => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      // 자팀 포메이션을 하프라인 기준으로 대칭 이동한 좌표를 기본값으로 준다 (y' = 100 - y).
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        opponentPositions: phase.positions.map((p) => ({ x: p.x, y: 100 - p.y })),
      })),
      isDirty: true,
    })
  },

  addOpponentsFromFormation: (formationName) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    const coords = FORMATIONS[formationName]
    if (!coords) return
    set({
      // addOpponents와 같은 대칭 이동(y' = 100 - y) — 자팀 현재 배치 대신
      // 상대가 고를 수 있는 다른 포메이션 템플릿(예: 4-4-2 로우블록)을 그
      // 대칭으로 배치한다(TO-DO 4번, "지금은 11개 점을 일일이 찍어야 함").
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        opponentPositions: coords.map((p) => ({ x: p.x, y: 100 - p.y })),
      })),
      isDirty: true,
    })
  },

  removeOpponents: () => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => {
        const { opponentPositions: _drop, ...rest } = phase
        void _drop
        return rest
      }),
      isDirty: true,
    })
  },

  setPressingLineLevel: (level) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    const phase = getActivePhaseData(analysis, currentPhase, selectedChangingPointId)
    const gkId = findGkPlayerId(analysis.players, analysis.formation)
    const result = shiftPositionsToPressingLevel(phase.positions, gkId, level)
    if (!result) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (p) => ({
        ...p,
        positions: result.positions,
        pressingLineY: result.pressingLineY,
      })),
      isDirty: true,
    })
  },

  setComment: (text) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    set({
      analysis: withActivePhaseUpdate(analysis, currentPhase, selectedChangingPointId, (phase) => ({
        ...phase,
        comment: text,
      })),
      isDirty: true,
    })
  },

  addChangingPoint: (label, minute) => {
    const { analysis, currentPhase, selectedChangingPointId } = get()
    if (!analysis) return
    const source = getActivePhaseData(analysis, currentPhase, selectedChangingPointId)
    const newPoint: ChangingPoint = {
      id: nanoid(),
      label,
      minute,
      positions: source.positions.map((p) => ({ ...p })),
      opponentPositions: source.opponentPositions?.map((p) => ({ ...p })),
      pressingLineY: source.pressingLineY,
      // 코멘트·화살표는 그 시점 고유의 내용이라 새로 쓰게 비워 둔다 — 좌표만 시작점으로 물려받는다.
      comment: '',
      annotations: [],
    }
    set({
      analysis: { ...analysis, changingPoints: [...(analysis.changingPoints ?? []), newPoint] },
      selectedChangingPointId: newPoint.id,
      isDirty: true,
    })
  },

  renameChangingPoint: (id, label) => {
    const { analysis } = get()
    if (!analysis?.changingPoints) return
    set({
      analysis: {
        ...analysis,
        changingPoints: analysis.changingPoints.map((cp) => (cp.id === id ? { ...cp, label } : cp)),
      },
      isDirty: true,
    })
  },

  setChangingPointMinute: (id, minute) => {
    const { analysis } = get()
    if (!analysis?.changingPoints) return
    set({
      analysis: {
        ...analysis,
        changingPoints: analysis.changingPoints.map((cp) => (cp.id === id ? { ...cp, minute } : cp)),
      },
      isDirty: true,
    })
  },

  removeChangingPoint: (id) => {
    const { analysis, selectedChangingPointId } = get()
    if (!analysis?.changingPoints) return
    set({
      analysis: { ...analysis, changingPoints: analysis.changingPoints.filter((cp) => cp.id !== id) },
      selectedChangingPointId: selectedChangingPointId === id ? null : selectedChangingPointId,
      isDirty: true,
    })
  },

  moveChangingPoint: (id, direction) => {
    const { analysis } = get()
    if (!analysis?.changingPoints) return
    const list = [...analysis.changingPoints]
    const idx = list.findIndex((cp) => cp.id === id)
    const swapWith = direction === 'left' ? idx - 1 : idx + 1
    if (idx === -1 || swapWith < 0 || swapWith >= list.length) return
    ;[list[idx], list[swapWith]] = [list[swapWith], list[idx]]
    set({ analysis: { ...analysis, changingPoints: list }, isDirty: true })
  },

  selectChangingPoint: (id) => {
    const { selectedChangingPointId } = get()
    if (id === selectedChangingPointId) return
    clearTimeout(morphTimer)
    set({ selectedChangingPointId: id, isMorphing: true })
    morphTimer = setTimeout(() => set({ isMorphing: false }), PHASE_TRANSITION_MS)
  },

  setSummary: (text) => {
    const { analysis } = get()
    if (!analysis) return
    set({ analysis: { ...analysis, summary: text }, isDirty: true })
  },

  setMatchInfo: (patch) => {
    const { analysis } = get()
    if (!analysis) return
    set({ analysis: { ...analysis, match: { ...analysis.match, ...patch } }, isDirty: true })
  },

  updatePlayer: (playerId, patch) => {
    const { analysis } = get()
    if (!analysis) return
    set({
      analysis: {
        ...analysis,
        players: analysis.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
      },
      isDirty: true,
    })
  },

  addPlayer: () => {
    const { analysis } = get()
    if (!analysis || analysis.players.length >= 23) return
    const usedNumbers = new Set(analysis.players.map((p) => p.number))
    let nextNumber = 12
    while (usedNumbers.has(nextNumber) && nextNumber < 99) nextNumber++
    const newPlayer: Player = { id: nanoid(), name: '', number: nextNumber }
    set({ analysis: { ...analysis, players: [...analysis.players, newPlayer] }, isDirty: true })
  },

  removePlayer: (playerId) => {
    const { analysis } = get()
    if (!analysis || analysis.players.length <= 11) return
    const isStarter = analysis.phases.base.positions.some((p) => p.playerId === playerId)
    if (isStarter) return // 선발은 이 액션으로 지울 수 없다 — 벤치 전용
    set({
      analysis: { ...analysis, players: analysis.players.filter((p) => p.id !== playerId) },
      isDirty: true,
    })
  },

  toggleLayer: (key) => set((state) => ({ layers: { ...state.layers, [key]: !state.layers[key] } })),

  applyFormation: (name) => {
    const { analysis } = get()
    if (!analysis) return
    const coords = FORMATIONS[name]
    if (!coords) return
    // 선발 11명(배열 앞 11자리)에만 새 좌표를 매핑한다 — 벤치 선수는 좌표를 받지 않는다.
    const starters = analysis.players.slice(0, coords.length)
    const phases = { ...analysis.phases }
    for (const phaseType of Object.keys(phases) as PhaseType[]) {
      phases[phaseType] = {
        ...phases[phaseType],
        positions: starters.map((player, i) => ({
          playerId: player.id,
          x: coords[i]?.x ?? 50,
          y: coords[i]?.y ?? 50,
        })),
      }
    }
    set({ analysis: { ...analysis, formation: name, phases }, isDirty: true })
  },

  applySavedMeta: (meta) => {
    const { analysis } = get()
    if (!analysis) return
    set({ analysis: { ...analysis, ...meta }, isDirty: false })
  },
}))
