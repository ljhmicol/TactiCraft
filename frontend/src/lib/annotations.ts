import { PITCH_LENGTH_M, PITCH_WIDTH_M } from '@/lib/zones'
import type { Annotation, AnnotationType, Point } from '@/types/analysis'

/**
 * 화살표(전술 그리기) 렌더링 지원.
 *
 * Pitch가 preserveAspectRatio="none"(x/y 축척 다름)이라 그냥 그리면 화살촉이
 * 방향에 따라 일그러진다. 모든 기하를 "균일 축척 공간"(y에 K=105/68를 곱해
 * 실제 화면 비율과 맞춘 좌표계)에서 계산한 뒤 다시 피치 좌표로 되돌린다.
 * circularRadius()가 원을 축별로 보정하는 것과 같은 원리다.
 */
const K = PITCH_LENGTH_M / PITCH_WIDTH_M // y 단위가 화면에서 약 1.54배 길다

export interface ArrowGeometry {
  /** 화살대(선분)의 끝점 — 화살촉에 묻히지 않도록 머리 길이만큼 감소시킨다 */
  shaftEnd: Point
  /** 화살촉 삼각형. [0]이 tip(=to), [1]·[2]이 양 날 */
  head: [Point, Point, Point]
}

/** 균일 축척 공간에서 계산한 화살표 형상을 반환한다. */
export function arrowGeometry(from: Point, to: Point, headLength = 2.4, headWidth = 1.9): ArrowGeometry {
  // 균일 공간으로 올린다 (x는 그대로, y는 K배)
  const fx = from.x
  const fy = from.y * K
  const tx = to.x
  const ty = to.y * K
  const dx = tx - fx
  const dy = ty - fy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { shaftEnd: to, head: [to, to, to] }

  const ux = dx / len // 진행 방향 단위 벡터
  const uy = dy / len
  const px = -uy // 수직 방향 단위 벡터
  const py = ux
  const half = headWidth / 2

  // 균일 공간 좌표 → 피치 좌표
  const toPitch = (x: number, y: number): Point => ({ x, y: y / K })
  // tip에서 뒤로 d, 옆으로 w만큼 이동한 점
  const back = (d: number, w: number) => toPitch(tx + ux * d + px * w, ty + uy * d + py * w)

  const shaft = Math.max(0, len - headLength * 0.7)
  return {
    shaftEnd: toPitch(fx + ux * shaft, fy + uy * shaft),
    head: [to, back(-headLength, half), back(-headLength, -half)],
  }
}

export interface CurvedArrowGeometry {
  /** SVG 경로 d 속성(2차 베지어) — from에서 시작해 control을 거쳐 to로 */
  path: string
  control: Point
  /** 화살촉 삼각형. [0]이 tip(=to), [1]·[2]이 양 날. 방향은 to 지점에서의
   * 베지어 접선(제어점→끝점)을 쓴다 — 직선 화살표와 달리 시작→끝 직선
   * 방향을 그대로 쓰면 곡선 끝에서 화살촉이 삐딱하게 보인다. */
  head: [Point, Point, Point]
}

const CURVE_BOW_RATIO = 0.16 // 현(직선 거리) 대비 바깥으로 부풀리는 비율

/**
 * 오버래핑 풀백처럼 바깥으로 도는 움직임을 곡선 화살표로 그린다
 * (2026-09-07 — "풀백들이 바깥으로 해서 오버랩하면 곡선 형태로도 표현").
 * 부풀리는 방향은 항상 피치 중앙(x=50)에서 더 멀어지는 쪽 — 오버랩처럼
 * 터치라인 쪽으로 도는 움직임이 대부분이라 방향을 사용자가 고르게 하는
 * 대신 자동으로 "바깥쪽"을 택한다.
 *
 * 2차 베지어의 중점(t=0.5)은 `0.25*from + 0.5*control + 0.25*to`라서,
 * 현의 중점에서 실제로 bow만큼 부풀리려면 control을 중점에서 `2*bow`만큼
 * 밀어야 한다(대수적으로 유도됨) — arrowGeometry와 같은 균일 축척(K) 공간
 * 에서 계산해야 화면 비율 왜곡 없이 대칭으로 부풀어 보인다.
 */
export function curvedArrowGeometry(from: Point, to: Point, headLength = 2.4, headWidth = 1.9): CurvedArrowGeometry {
  const fx = from.x
  const fy = from.y * K
  const tx = to.x
  const ty = to.y * K
  const dx = tx - fx
  const dy = ty - fy
  const len = Math.hypot(dx, dy)
  const toPitch = (x: number, y: number): Point => ({ x, y: y / K })
  if (len < 1e-6) return { path: `M ${from.x} ${from.y}`, control: from, head: [to, to, to] }

  const ux = dx / len
  const uy = dy / len
  let px = -uy // 수직 방향 후보 (부호는 아래서 "바깥쪽"으로 고른다)
  let py = ux

  const mx = (fx + tx) / 2
  const my = (fy + ty) / 2
  const bow = len * CURVE_BOW_RATIO
  // x는 균일 공간에서도 그대로이므로(K는 y에만 곱함) 중앙(50)에서 더 멀어지는
  // 쪽을 그대로 비교해 고를 수 있다.
  const distIfPositive = Math.abs(mx + px * bow - 50)
  const distIfNegative = Math.abs(mx - px * bow - 50)
  if (distIfNegative > distIfPositive) {
    px = -px
    py = -py
  }
  const cx = mx + px * bow * 2
  const cy = my + py * bow * 2
  const control = toPitch(cx, cy)

  // to 지점에서의 접선(제어점 → 끝점) 방향으로 화살촉을 세운다.
  const tdx = tx - cx
  const tdy = ty - cy
  const tlen = Math.hypot(tdx, tdy) || 1
  const tux = tdx / tlen
  const tuy = tdy / tlen
  const tpx = -tuy
  const tpy = tux
  const half = headWidth / 2
  const back = (d: number, w: number) => toPitch(tx + tux * d + tpx * w, ty + tuy * d + tpy * w)

  return {
    path: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
    control,
    head: [to, back(-headLength, half), back(-headLength, -half)],
  }
}

/**
 * 2차 베지어 위의 t(0~1) 지점을 피치 좌표로 구한다. 베지어는 아핀 변환과
 * 교환되므로(curve(affine(P)) = affine(curve(P))) 균일 축척 공간이 아니라
 * curvedArrowGeometry가 이미 피치 좌표로 되돌려놓은 control을 그대로 써도
 * 화면에 그려지는 실제 곡선 위의 점과 일치한다 — PassBall이 곡선 패스를
 * 따라가는 데 쓴다.
 */
export function bezierPoint(from: Point, control: Point, to: Point, t: number): Point {
  const mt = 1 - t
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y,
  }
}

/**
 * points를 따라 이동할 때 각 지점에 도달하는 시간 비율(0~1, 실제 거리 비례) —
 * Framer Motion 키프레임 애니메이션의 `times`에 그대로 쓴다. 거리 비례가
 * 아니면 짧은 구간과 긴 구간을 같은 시간에 지나가버려 부자연스럽다.
 * PassChainBall·RunGhost·PlayerNode(달리기 모션)가 공유한다.
 */
export function travelTimes(points: Point[]): number[] {
  if (points.length < 2) return points.map(() => 0)
  const distances = [0]
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = distances[distances.length - 1]
  return total > 1e-6 ? distances.map((d) => d / total) : points.map((_, i) => i / (points.length - 1))
}

/** 화살촉 배지를 피하면서 클릭 지점(선분 중점)을 구한다. */
export function arrowMidpoint(a: { from: Point; to: Point }): Point {
  return { x: (a.from.x + a.to.x) / 2, y: (a.from.y + a.to.y) / 2 }
}

/** 공 애니메이션이 곡선을 따라가도록 샘플링하는 t값(PassBall/RunGhost 공용). */
export const BALL_SAMPLE_TS = [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1]

/** 화살표 하나를 따라가는 점 목록(직선이면 양끝 2개, 곡선이면 베지어 샘플). */
export function annotationSamplePoints(ann: { from: Point; to: Point; curved?: boolean }): Point[] {
  if (!ann.curved) return [ann.from, ann.to]
  const { control } = curvedArrowGeometry(ann.from, ann.to)
  return BALL_SAMPLE_TS.map((t) => bezierPoint(ann.from, control, ann.to, t))
}

// 패스 체인 공 애니메이션의 구간(하나의 패스)당 소요 시간(초) — "패스 되는 공
// 속도가 너무 느려" 피드백(2026-09-08)으로 1.1초에서 0.45초로 단축했다가,
// "아주 조금만 더 느리게"(2026-09-08, 2차) 요청으로 0.55초로 소폭 재조정.
// 체인 전체 길이는 chainBallDuration()으로 계산한다 — 직접 곱하지 말 것.
export const BALL_SEGMENT_DURATION = 0.55

/**
 * 드리블(carry) 체인의 공이 이동하는 시간(초). 공을 몰고 가는 선수의 국면 전환
 * 모프(store의 PHASE_TRANSITION_MS)와 반드시 같아야 둘이 함께 움직인다 —
 * lib이 store를 import하지 않도록 값을 여기 따로 두고, 두 값이 어긋나지
 * 않는지는 annotations.test.ts가 검사한다.
 */
export const CARRY_BALL_DURATION = 0.6

/**
 * 패스 체인 공 애니메이션의 총 소요 시간(초) — "패스 한 번당 BALL_SEGMENT_DURATION".
 *
 * 반드시 화살표 개수로 세야 한다. chainSamplePoints는 곡선(curved) 화살표를
 * 베지어 8점으로 샘플링하므로, 점 개수로 세면 곡선 패스 하나가 직선 패스
 * 8개만큼 느려진다(2026-09-10 — 비야 프리셋의 감아차기 슛이 시점 자동재생
 * 간격 1.8초 안에 골대까지 못 가고 잘리던 원인). 직선만 있는 체인에서는
 * 점 개수 - 1 == 화살표 개수라 기존 동작과 완전히 같다.
 */
export function chainBallDuration(chain: { curved?: boolean; carry?: boolean }[]): number {
  // 전 구간이 드리블이면 공은 선수와 "같이" 가야 하므로 모프와 같은 시간에 끝낸다
  // — 화살표 개수로 세면(메시의 캐리 두 구간 = 1.1초) 공이 선수보다 느려진다
  // (2026-09-10 사용자 리포트 "지금 공이 좀 더 느리다").
  if (chain.length > 0 && chain.every((a) => a.carry === true)) return CARRY_BALL_DURATION
  return BALL_SEGMENT_DURATION * Math.max(chain.length, 1)
}

/** 이 거리(피치 좌표 단위) 이내면 "같은 지점"으로 본다 — 패스 체인 연결
 * 판정과 PlayerNode의 "이 선수 자리에서 시작하는 run 화살표" 판정이 공유. */
export const ANNOTATION_LINK_EPS = 3
const CHAIN_ENDPOINT_EPS = ANNOTATION_LINK_EPS

/**
 * 연결된 패스를 하나의 흐름으로 묶는다 — "수비수에서 미드필더로, 미드필더
 * 에서 공격수로 이어지게" (2026-09-07 요청). 패스는 선수에 부착되지 않는
 * 자유 좌표 화살표라(4단계 §5.1) 선수 ID로 연결을 판단할 수 없어, 대신
 * 한 패스의 끝점(to)이 다른 패스의 시작점(from)과 가까우면(3유닛 이내)
 * 이어진 것으로 본다. 사용자가 손으로 그리며 정확히 같은 픽셀에서 시작하기
 * 어려우니 완전 일치 대신 근접 판정을 쓴다.
 *
 * 반환값은 체인들의 배열이다 — 아무와도 안 이어진 패스는 길이 1짜리
 * 체인으로 그대로 돌아온다(기존 단일 공 애니메이션과 동일하게 동작).
 */
export function buildPassChains(passes: Annotation[]): Annotation[][] {
  const isNear = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) <= CHAIN_ENDPOINT_EPS
  const findNext = (current: Annotation, usedIds: Set<string>) =>
    passes.find((p) => !usedIds.has(p.id) && p.id !== current.id && isNear(current.to, p.from))
  const hasPredecessor = (ann: Annotation) => passes.some((p) => p.id !== ann.id && isNear(p.to, ann.from))

  const used = new Set<string>()
  const chains: Annotation[][] = []

  // 선행 패스가 없는(체인의 시작일 수 있는) 것부터 순서대로 이어간다.
  for (const start of passes.filter((p) => !hasPredecessor(p))) {
    if (used.has(start.id)) continue
    const chain: Annotation[] = [start]
    used.add(start.id)
    let current = start
    while (chain.length < passes.length) {
      const next = findNext(current, used)
      if (!next) break
      chain.push(next)
      used.add(next.id)
      current = next
    }
    chains.push(chain)
  }

  // 순환처럼 "시작"이 없는 패스가 남아 있으면 각자 단독 체인으로 처리한다
  // (사이클을 무한히 따라가지 않도록 하는 안전장치).
  for (const p of passes) {
    if (!used.has(p.id)) {
      chains.push([p])
      used.add(p.id)
    }
  }

  return chains
}

/** 체인(연결된 패스들)을 따라가는 점 목록 — 이음매의 중복점은 하나로 합친다. */
export function chainSamplePoints(chain: Annotation[]): Point[] {
  const points: Point[] = []
  for (const ann of chain) {
    const segment = annotationSamplePoints(ann)
    points.push(...(points.length > 0 ? segment.slice(1) : segment))
  }
  return points
}

export const ANNOTATION_MIN_LENGTH = 2.5 // 이보다 짧은 드래그는 실수로 간주해 버린다

export const ANNOTATION_STYLES: Record<AnnotationType, { stroke: string; dashed: boolean }> = {
  run: { stroke: '#F8FAFC', dashed: false }, // 실선 = 움직임(침투)
  pass: { stroke: '#FBBF24', dashed: true }, // 점선 = 패스
}
