import { autoPressingLine } from '@/lib/compactness'
import type { PlayerPosition } from '@/types/analysis'

/**
 * SVG viewBox="0 0 100 100" + preserveAspectRatio를 쓰면 화면 비율에 따라
 * 좌우 또는 상하 여백이 생긴다. getScreenCTM().inverse()로 이 여백을 뺀
 * 실제 피치 좌표를 구한다 (4단계 §3.4).
 */
export function clientToPitch(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const { x, y } = pt.matrixTransform(svg.getScreenCTM()!.inverse())
  return { x, y }
}

/**
 * Framer Motion의 `PanInfo.point`는 clientX/clientY가 아니라 pageX/pageY다
 * (스크롤 오프셋 포함) — `clientToPitch`에 그대로 넘기면 페이지가 스크롤된
 * 만큼 좌표가 어긋난다. 모바일 레이아웃(에디터 페이지가 1열로 쌓여 피치까지
 * 꽤 스크롤해야 하는)에서 선수를 드래그하면 y가 맨 아래로 튀는 버그로
 * 발견됐다(2026-09-11 실기기 리포트) — 데스크톱은 피치가 스크롤 없이
 * 바로 보여서 지금까지 드러나지 않았다. `window.scrollX/Y`를 빼서
 * client 좌표로 되돌린 뒤 넘긴다.
 */
export function pagePointToPitch(svg: SVGSVGElement, pageX: number, pageY: number): { x: number; y: number } {
  return clientToPitch(svg, pageX - window.scrollX, pageY - window.scrollY)
}

/** 0~99.9로 클램프한다. 100을 배제해 오버로드 경계 계산이 항상 어떤 구역에 속하도록 한다. */
export function clampCoord(v: number): number {
  return Math.min(99.9, Math.max(0, v))
}

/**
 * 저장된 분석은 항상 "자팀 골 = y=100" 기준이다(2단계 §3). 전술 대결 뷰에서
 * 두 팀을 한 피치에 겹칠 때, 상대로 지정된 쪽은 이 180도 회전을 거쳐야
 * 자기 골문이 상대가 공격하는 방향(y=0)에 놓인다. y만 뒤집으면 좌우 플랭크가
 * 실제와 반대로 그려지므로 x도 함께 뒤집는다 — 16번 항목, TO-DO-LIST.md 참조.
 */
export function mirrorPoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: 100 - p.x, y: 100 - p.y }
}

/**
 * 데이터 좌표(x=터치라인, y=공격 방향)를 가로 방향 화면 좌표로 옮긴다 —
 * 전술 대결 뷰(TO-DO 21)를 세로 피치보다 크게 보여주기 위함이다. y=0
 * (공격 방향 골문)을 화면 오른쪽(x=100)에 두어 "공격은 오른쪽으로" 라는
 * 익숙한 방향으로 읽히게 한다. 이 자체는 회전이 아니라 좌표 두 축을
 * 치환하는 것이라 텍스트가 기울어지지 않는다 — SVG transform으로 그룹을
 * 통째로 돌리면 글자도 같이 돌아가 버리는 문제를 피한다.
 */
export function transposePoint(p: { x: number; y: number }): { x: number; y: number } {
  return { x: 100 - p.y, y: p.x }
}

/**
 * 데이터 좌표계의 사각형(x0~x1, y0~y1)을 transposePoint와 같은 규칙으로
 * 옮긴 화면 사각형을 돌려준다. ChannelGrid·OverloadLayer처럼 "구역"을
 * 그리는 컴포넌트가 가로 모드에서 재사용한다.
 */
export function transposeRect(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): { x: number; y: number; width: number; height: number } {
  return { x: 100 - y1, y: x0, width: y1 - y0, height: x1 - x0 }
}

/**
 * 전술 대결 뷰(MatchupView)에서 "수비하는 쪽"의 압박 라인 y값을 정한다.
 * A가 수비면 그대로, B가 수비면 미러링(100-y)해서 넘긴다.
 *
 * 백엔드에서 불러온 분석은 pressingLineY 미설정 시 undefined가 아니라
 * null로 온다(Python None → JSON null) — `!== undefined`만 검사하면 null을
 * "수동 지정값 0"으로 오인해 `100 - null`(JS가 null을 0으로 강제 변환해
 * 100)이라는 잘못된 라인을 계산해버린다(2026-09-07 실제 버그 — 전술
 * 대결에서 공수를 교대해도 한쪽 방향은 압박 라인이 항상 "매우 낮음"에
 * 고정됐었다). `== null`로 null·undefined 둘 다 "미설정"으로 취급해야 한다.
 *
 * pressingLineY가 미설정이면 자동 산출(`autoPressingLine`)하는데, 반드시
 * **미러링하기 전(각 팀 고유 좌표계)** 포지션으로 계산해야 한다(2026-09-08
 * 실제 버그 — "A공격이면 B팀 수비라인이 압박라인이어야 하는데 이상하게
 * 돼있어"). `autoPressingLine`은 "y가 가장 큰 선수 = GK"로 가정하는데
 * (자기 골문이 y=100인 고유 좌표계에서만 성립), 이미 미러링된(y'=100-y)
 * 좌표 배열에 그대로 적용하면 GK는 y'가 가장 작은 선수가 돼버려서 대신
 * 가장 전진한 공격수가 "GK로 오인돼 제외"되고 두 번째로 전진한 선수(대개
 * 윙어)의 y가 압박 라인으로 잘못 뽑힌다 — 실제 백라인보다 훨씬 낮은
 * (전진한) 라인으로 보이는 원인이었다. 자동 산출은 항상 각 팀의 원본
 * 좌표(dataAPositions/dataBPositions)로 계산하고, B가 수비인 경우에만
 * 그 결과값(스칼라)을 마지막에 미러링한다.
 */
export function resolveDefendingPressingLineY(
  aIsDefending: boolean,
  dataAPressingLineY: number | null | undefined,
  dataBPressingLineY: number | null | undefined,
  dataAPositions: PlayerPosition[],
  dataBPositions: PlayerPosition[],
): number {
  if (aIsDefending) return dataAPressingLineY ?? autoPressingLine(dataAPositions)
  const y = dataBPressingLineY ?? autoPressingLine(dataBPositions)
  return 100 - y
}

/**
 * 압박 라인의 "매우 높음/낮음" 라벨을 판정할 값 — resolveDefendingPressingLineY와
 * 짝을 이루지만 **절대 미러링하지 않는다**(2026-09-08 실제 버그: "전술
 * 대결에서 교대할 때 압박라인이 좀 이상하다"). 미러링은 화면 어디에 선을
 * 그릴지만 바꾸는 것이지, B팀 자신의 관점에서 그 라인이 높은지 낮은지는
 * 바꾸지 않는다 — B팀의 평범한(깊은) 백라인이 미러링을 거치면 y가 작아져서
 * `pressingLineLevel`이 "매우 높음"으로 잘못 읽었다. 두 팀 다 항상 자기
 * 고유 좌표계 값(수동 지정 또는 그 팀 포지션으로 자동 산출)을 그대로
 * 반환한다 — PressingLine의 `labelY` prop으로 넘겨 그리기 위치(y, 미러링
 * 될 수 있음)와 분리해서 쓴다.
 */
export function resolveDefendingPressingLineLevel(
  aIsDefending: boolean,
  dataAPressingLineY: number | null | undefined,
  dataBPressingLineY: number | null | undefined,
  dataAPositions: PlayerPosition[],
  dataBPositions: PlayerPosition[],
): number {
  return aIsDefending
    ? (dataAPressingLineY ?? autoPressingLine(dataAPositions))
    : (dataBPressingLineY ?? autoPressingLine(dataBPositions))
}
