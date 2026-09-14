/**
 * 2단계 §12 색 및 시각 규정을 상수로 고정한다.
 * 이 프로젝트에서 색은 장식이 아니라 데이터다 — 즉흥적으로 바꾸지 않는다.
 */

export const PITCH_COLORS = {
  background: '#1B5E3F',
  line: '#FFFFFF',
  lineOpacity: 0.55,
  lineWidth: 0.3,
} as const

/**
 * 피치 위 선수 라벨(이름·등번호·포지션)이 쓰는 폰트 — `tailwind.config.js`의
 * `fontFamily.sans`(IBM Plex Sans KR)와 정확히 같은 값이다. SVG `<text>`는
 * 보통 문서 `<body>`의 font-family를 상속해 별도 지정 없이도 같은 폰트로
 * 보이지만, HTML→SVG 경계를 넘는 상속은 브라우저마다(특히 Safari) 다르게
 * 동작할 위험이 있어(2026-09-11, 이번 세션에서 반복된 "헤드리스에선 되는데
 * 실기기 Safari에서만 깨지는" 패턴과 같은 종류) 이 세션에서 명시적으로
 * 지정하기로 했다 — PlayerNode/PrintPlayerNode/SharePlayerNode/
 * StaticPlayerNode 네 곳이 전부 이 상수를 쓴다.
 */
export const PITCH_TEXT_FONT_FAMILY = '"IBM Plex Sans KR", ui-sans-serif, system-ui, sans-serif'

export const PLAYER_COLORS = {
  own: {
    fill: '#F8FAFC',
    stroke: '#0F172A',
    strokeOpacity: 0.4,
    text: '#0F172A',
    radius: 2.6,
  },
  opponent: {
    fill: '#94A3B8',
    fillOpacity: 0.55,
    radius: 2.2,
  },
  ghost: {
    fillOpacity: 0.25,
    pathStroke: '#F8FAFC',
    pathStrokeOpacity: 0.35,
    pathDasharray: '1 1.5',
  },
} as const

/**
 * 포지션 라인별 노드 색 (2026-09-01 사용자 요청 — 가시성):
 * 골키퍼=노랑, 수비=파랑, 미드필더=초록, 공격=빨강.
 * 초록은 피치 배경(#1B5E3F) 위에서 구분되도록 밝은 톤. text는 원 안
 * 등번호 색 — 채도가 낮은 노랑·초록 위에는 어두운 글자로 대비를 맞춘다.
 * 도출 규칙(lib/positions.ts)과 함께 쓴다.
 */
export const POSITION_LINE_COLORS = {
  GK: { fill: '#FACC15', text: '#0F172A' },
  DF: { fill: '#3B82F6', text: '#F8FAFC' },
  MF: { fill: '#4ADE80', text: '#0F172A' },
  FW: { fill: '#EF4444', text: '#F8FAFC' },
} as const

/**
 * 전술 대결 뷰(TO-DO 16/22) 전용 팀 색 — 포지션 라인 색(POSITION_LINE_COLORS)을
 * 두 팀 다 똑같이 쓰면 "같은 팀 선수들 같다"는 문제가 생긴다(2026-09-07 사용자
 * 피드백). 그래서 대결 뷰에서는 포지션이 아니라 팀 단위로 유니폼처럼 고정
 * 색을 칠한다 — A=홈(파랑), B=원정(빨강). 기존 오버로드(amber)·압박
 * 라인(orange) 레이어 색과 겹치지 않게 골랐다. AdvantageBadge·구역 강조·
 * StaticPlayerNode가 모두 이 상수 하나를 공유해야 배지 색과 피치 위 색이
 * 어긋나지 않는다.
 *
 * B는 원래 마젠타(#EC4899)였는데 "빨강인데 좀 핑크색이다"는 피드백
 * (TO-DO 36 후속)으로 더 채도 높은 순수 빨강(#DC2626)으로 바꿨다 —
 * POSITION_LINE_COLORS.FW(#EF4444)보다 살짝 더 진해서, FW 포지션 코드
 * 라벨과 나란히 있어도 톤이 구분된다.
 */
export const VERSUS_TEAM_COLORS = {
  A: { fill: '#3B82F6', text: '#F8FAFC', label: '파랑' },
  B: { fill: '#DC2626', text: '#F8FAFC', label: '빨강' },
} as const

export const LAYER_COLORS = {
  channelGrid: { color: '#FFFFFF', opacity: 0.2 },
  halfSpaces: { color: '#FFFFFF', opacity: 0.08 },
  pressingLine: { color: '#FB923C', width: 0.5 },
  compactness: { color: '#38BDF8' },
  overload: {
    strong: { color: '#FACC15', opacity: 0.35 },
    weak: { color: '#FACC15', opacity: 0.15 },
  },
} as const

export const SHARE_CARD_COLORS = {
  background: '#0F172A',
  title: '#F8FAFC',
  subtitle: '#94A3B8',
  phaseLabel: '#34D399',
  body: '#E2E8F0',
} as const
