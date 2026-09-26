import { GIFEncoder, quantize, applyPalette } from 'gifenc'

import { RUN_LOOP_DELAY, RUN_LOOP_DURATION } from '@/components/pitch/PlayerNode'
import { ANNOTATION_LINK_EPS, annotationSamplePoints, travelTimes } from '@/lib/annotations'
import { PHASE_TRANSITION_MS } from '@/store/analysisStore'
import type { Annotation, Analysis, PhaseType, Point, PlayerPosition } from '@/types/analysis'

const PHASE_ORDER: PhaseType[] = ['base', 'attack', 'defense']
const TRANSITION_STEPS = 12 // 국면 사이 보간 샘플 수
const HOLD_MS = 1100 // 정지 국면을 보여주는 시간

// run 화살표(오버래핑 런 등) 재생(2026-09-26, "PNG/GIF에서도 화살표대로
// 움직이면 좋겠다"). 편집 화면(PlayerNode)의 반복 애니메이션과 같은 리듬으로
// 만들어야 GIF가 그 화면을 그대로 옮긴 것처럼 보인다 — 값을 복제하는 대신
// PlayerNode.RUN_LOOP_DURATION/RUN_LOOP_DELAY를 그대로 가져와 어긋날 수
// 없게 한다.
const RUN_LOOP_DURATION_MS = RUN_LOOP_DURATION * 1000
const RUN_LOOP_DELAY_MS = RUN_LOOP_DELAY * 1000
// 2026-09-26, "잘됐는데 좀 렉걸린다"(→ 알고보니 완성된 GIF 재생이 뚝뚝
// 끊긴다는 뜻이었다) 피드백 — 편집 화면(PlayerNode)은 전진 후 "역재생 없이
// 순간 리셋"하지만(PlayerNode.tsx 주석 참조 — 그 화면에서는 의도된 설계다),
// 그 순간 리셋을 GIF 프레임으로 그대로 찍으면 반복마다 화면이 뚝 끊기는
// 순간이동처럼 보인다. 라이브 화면과 달리 GIF는 주변 맥락 없이 그 장면만
// 계속 도는 독립된 결과물이라, 여기서는 같은 경로를 매끄럽게 되돌아오는
// 역재생으로 다르게 구현한다 — 편집 화면 자체의 동작은 그대로 둔다.
const RUN_STEPS = 8 // 전진(및 복귀) 구간을 몇 프레임으로 쪼갤지
const RUN_LOOP_CYCLES = 1 // 국면 하나에 머무는 동안 왕복을 몇 번 반복할지(GIF가 어차피 전체 반복되므로 1번으로 충분)
const RUN_SNAP_MS = 40 // 역재생이 정확히 원점까지 못 미친 나머지를 마저 닫는 마지막 프레임의 노출 시간

export interface GifFrameSpec {
  phase: PhaseType
  positions: PlayerPosition[]
  delayMs: number
}

/** 표준 easeInOutCubic — 편집 화면의 cubic-bezier([0.4,0,0.2,1]) 전환과 체감이 비슷하다. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/**
 * from→to를 playerId 기준으로 선형 보간한다. t에는 이미 이징이 적용돼
 * 있다고 가정한다(호출부에서 easeInOutCubic을 먼저 씌운다).
 */
export function interpolatePositions(from: PlayerPosition[], to: PlayerPosition[], t: number): PlayerPosition[] {
  const toById = new Map(to.map((p) => [p.playerId, p]))
  return from.map((f) => {
    const target = toById.get(f.playerId)
    if (!target) return f
    return { playerId: f.playerId, x: f.x + (target.x - f.x) * t, y: f.y + (target.y - f.y) * t }
  })
}

interface RunMatch {
  playerId: string
  points: Point[]
  times: number[]
}

/** 이 국면에서 "이 선수 자리에서 시작하는" run 화살표를 찾아 매칭한다 —
 * PlayerNode.runMatchId 판정과 완전히 같은 규칙(ANNOTATION_LINK_EPS 이내
 * 거리). 화살표가 곡선이면 annotationSamplePoints가 베지어를 8점으로
 * 샘플링해 준다 — PlayerNode가 실제로 따라가는 경로와 같다. */
function findRunMatches(positions: PlayerPosition[], annotations: Annotation[]): RunMatch[] {
  const runAnnotations = annotations.filter((a) => a.type === 'run')
  const matches: RunMatch[] = []
  for (const pos of positions) {
    const arrow = runAnnotations.find((a) => Math.hypot(a.from.x - pos.x, a.from.y - pos.y) <= ANNOTATION_LINK_EPS)
    if (!arrow) continue
    // 첫 점을 정확히 position으로 고정한다 — PlayerNode.runPoints와 같은 이유
    // (손으로 그린 화살표의 from이 position과 완벽히 일치하지 않을 수 있다).
    const [, ...rest] = annotationSamplePoints(arrow)
    const points = [{ x: pos.x, y: pos.y }, ...rest]
    matches.push({ playerId: pos.playerId, points, times: travelTimes(points) })
  }
  return matches
}

/** t(0~1, 이미 이징 적용됨)에 해당하는, points를 따라가는 좌표 — times는
 * travelTimes()가 준 누적 비율. Framer Motion의 keyframe+times 애니메이션과
 * 같은 방식(구간별 선형 보간)으로 좌표를 근사한다. */
function pointAlongPath(points: Point[], times: number[], t: number): Point {
  if (points.length === 1) return points[0]
  let i = 0
  while (i < times.length - 2 && t > times[i + 1]) i++
  const segStart = times[i]
  const segEnd = times[i + 1]
  const segT = segEnd > segStart ? (t - segStart) / (segEnd - segStart) : 0
  const a = points[i]
  const b = points[i + 1]
  return { x: a.x + (b.x - a.x) * segT, y: a.y + (b.y - a.y) * segT }
}

/**
 * run 화살표가 있는 선수를 그 화살표를 따라 전진→도착점에서 잠깐 머묾→
 * 같은 경로로 매끄럽게 되돌아오는 프레임들을 만든다(2026-09-26, "PNG/GIF
 * 에서도 화살표대로 움직이면 좋겠다", 이어서 "재생이 뚝뚝 끊긴다" 피드백으로
 * 순간 리셋 대신 역재생으로 수정) — RUN_LOOP_CYCLES번 반복해 "계속
 * 왔다갔다" 하는 느낌을 준다. 매칭되는 선수가 없으면(대부분의 국면) 원래
 * 정지 프레임 하나만 돌려준다 — 이때 positions는 원본 배열 참조를 그대로
 * 유지한다(exportGif.test.ts가 이 동일성을 검사한다).
 */
function buildHoldFrames(
  phase: PhaseType,
  positions: PlayerPosition[],
  annotations: Annotation[],
  holdMs: number,
): GifFrameSpec[] {
  const matches = findRunMatches(positions, annotations)
  if (matches.length === 0) return [{ phase, positions, delayMs: holdMs }]

  const byId = new Map(matches.map((m) => [m.playerId, m]))
  const atProgress = (t: number): PlayerPosition[] =>
    positions.map((p) => {
      const match = byId.get(p.playerId)
      if (!match) return p
      const point = pointAlongPath(match.points, match.times, t)
      return { playerId: p.playerId, x: point.x, y: point.y }
    })

  const frames: GifFrameSpec[] = []
  const stepMs = RUN_LOOP_DURATION_MS / RUN_STEPS
  for (let cycle = 0; cycle < RUN_LOOP_CYCLES; cycle++) {
    // 전진: 시작점(positions)에서 도착점까지.
    for (let step = 1; step <= RUN_STEPS; step++) {
      frames.push({ phase, positions: atProgress(easeInOutCubic(step / RUN_STEPS)), delayMs: Math.round(stepMs) })
    }
    frames.push({ phase, positions: atProgress(1), delayMs: RUN_LOOP_DELAY_MS }) // 도착점에서 머묾
    // 복귀: 같은 이징 곡선을 거꾸로 밟아 매끄럽게 되돌아온다(전진과 대칭이라
    // "왕복"으로 자연스럽게 보인다) — step=1(t≈0에 가깝지만 정확히 0은 아님)
    // 까지만 밟고, 정확한 시작점은 아래 마지막 프레임이 마저 채운다.
    for (let step = RUN_STEPS - 1; step >= 1; step--) {
      frames.push({ phase, positions: atProgress(easeInOutCubic(step / RUN_STEPS)), delayMs: Math.round(stepMs) })
    }
    frames.push({ phase, positions, delayMs: RUN_SNAP_MS }) // 정확히 시작점에서 짧게 머문 뒤 다음 왕복(또는 국면 전환)으로
  }
  frames.push({ phase, positions, delayMs: holdMs }) // 다음 국면 전환은 원래 위치에서 시작해야 한다
  return frames
}

/**
 * 기본→공격→수비→(기본으로 순환)으로 이어지는 프레임 시퀀스를 만든다
 * (TO-DO 6번). 각 국면은 정지 프레임 하나로 표현하고 — 같은 정지 프레임을
 * 여러 장 찍는 대신 delay 값 하나로 "머무는 시간"을 표현해 인코딩할 프레임
 * 수를 크게 줄인다(단, run 화살표가 매칭되면 buildHoldFrames가 그 시간
 * 동안 화살표를 따라 왕복하는 프레임들로 대신 채운다) — 국면 사이는
 * TRANSITION_STEPS 단계로 보간해 편집 화면의 모프 애니메이션
 * (PHASE_TRANSITION_MS, easeInOut)과 체감 속도를 맞춘다. 화살표·상대팀처럼
 * 위치 보간이 필요 없는 요소는 국면이 바뀌는 "시작" 시점에 곧바로 도착
 * 국면 것으로 전환한다 — 편집 화면에서 국면 탭을 누르면 코멘트 패널이
 * 즉시 바뀌고 선수 위치만 뒤따라 움직이는 것과 같은 규칙이다.
 * AnimatedShareCard가 frame.phase로 그 국면의 코멘트·상대팀·화살표를
 * 그대로 조회해서 이 규칙을 구현한다.
 */
export function buildGifFrameSpecs(analysis: Analysis): GifFrameSpec[] {
  const frames: GifFrameSpec[] = []
  for (let i = 0; i < PHASE_ORDER.length; i++) {
    const current = PHASE_ORDER[i]
    const next = PHASE_ORDER[(i + 1) % PHASE_ORDER.length]
    const currentPhaseData = analysis.phases[current]
    frames.push(...buildHoldFrames(current, currentPhaseData.positions, currentPhaseData.annotations, HOLD_MS))

    const fromPositions = analysis.phases[current].positions
    const toPositions = analysis.phases[next].positions
    for (let step = 1; step <= TRANSITION_STEPS; step++) {
      const t = easeInOutCubic(step / TRANSITION_STEPS)
      frames.push({
        phase: next,
        positions: interpolatePositions(fromPositions, toPositions, t),
        delayMs: Math.round(PHASE_TRANSITION_MS / TRANSITION_STEPS),
      })
    }
  }
  return frames
}

export interface CapturedFrame {
  canvas: HTMLCanvasElement
  delayMs: number
}

/**
 * 캡처된 프레임(canvas + delay)들을 GIF89a 바이너리로 인코딩한다.
 * 프레임마다 개별 팔레트를 256색으로 양자화한다(gifenc는 프레임별 로컬
 * 팔레트를 지원 — 전체 시퀀스에 팔레트 하나를 억지로 맞추는 것보다
 * 화질이 낫다). 이 앱의 색은 사진이 아니라 평면색 위주라 256색 제한이
 * 거의 티 나지 않는다. repeat: 0으로 무한 반복 재생되게 한다.
 */
export function encodeGif(frames: CapturedFrame[]): Blob {
  const gif = GIFEncoder()
  for (const { canvas, delayMs } of frames) {
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    // repeat 기본값(0=무한 반복)은 첫 프레임에서만 실제로 쓰이지만, 매
    // 프레임에 같은 값을 넘겨도 무해하다 — 명시적으로 남겨 의도를 드러낸다.
    gif.writeFrame(index, width, height, { palette, delay: delayMs, repeat: 0 })
  }
  gif.finish()
  // gif.bytes()의 반환 타입(Uint8Array<ArrayBufferLike>)이 BlobPart가 요구하는
  // Uint8Array<ArrayBuffer>보다 넓어서(SharedArrayBuffer 가능성 포함) 그대로
  // 넘기면 타입 에러가 난다 — 복사 생성자로 진짜 ArrayBuffer 기반 배열을 만든다.
  return new Blob([new Uint8Array(gif.bytes())], { type: 'image/gif' })
}
