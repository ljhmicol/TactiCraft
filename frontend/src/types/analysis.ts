export type PhaseType = 'base' | 'attack' | 'defense'
export type TeamSide = 'home' | 'away'

/** 0~100 백분율 좌표. x=좌우 터치라인, y=0이 상대 골라인 */
export interface Point {
  x: number
  y: number
}

export interface MatchInfo {
  matchName: string
  homeTeam: string
  awayTeam: string
  matchDate: string // YYYY-MM-DD
  competition?: string
  analyzedTeam: TeamSide
}

export interface Player {
  id: string // 프론트가 생성 (nanoid). 저장·재로드해도 불변
  name: string
  number: number // 1~99
  role?: string // 자유 메모
  tacticalRole?: string // lib/tacticalRoles.ts의 role id — TO-DO 20
}

export interface PlayerPosition extends Point {
  playerId: string
}

/** 화살표 종류 — 실선=움직임(침투), 점선=패스 (코칭 표기 관례). */
export type AnnotationType = 'run' | 'pass'

/** 국면별 자유 좌표 화살표(전술 그리기). 선수에게 부착되지 않는 화이트보드 방식. */
export interface Annotation {
  id: string // 프론트가 생성 (nanoid)
  type: AnnotationType
  from: Point
  to: Point
  curved?: boolean // 곡선 화살표(오버랩 런 등) — 없으면 직선(TO-DO, 2026-09-07)
  /**
   * 드리블/운반 구간 표시(2026-09-10). pass는 "공만 A에서 B로 간다"라서 공이
   * 받는 선수의 국면 전환 모프(PHASE_TRANSITION_MS)를 기다렸다가 출발하는데,
   * 드리블은 공을 몰고 가는 선수 자신이 함께 이동하므로 그 대기가 있으면
   * "선수가 먼저 도착한 뒤 자기한테 패스하는" 모양이 된다. 이 플래그가 켜진
   * 화살표로 시작하는 체인은 공이 기다리지 않고 선수와 같이 출발한다.
   * run과는 다르다 — run은 공 없이 선수만 반복해서 움직이는 오프더볼 패턴이다.
   */
  carry?: boolean
}

export interface PhaseData {
  positions: PlayerPosition[] // 자팀 11명
  opponentPositions?: Point[] // 있으면 11개 전부
  pressingLineY?: number // 없으면 자동 산출
  comment: string
  annotations: Annotation[] // 없던 구버전 데이터는 빈 배열로 취급
}

/**
 * 타임라인(매치 체인징 포인트, TO-DO 5번). 기본/공격/수비 3국면과는 별개의
 * 선택적 확장이다 — "전반 23분 추격 상황"처럼 경기 시간 축의 임의 시점을
 * 자유 라벨과 함께 저장한다. PhaseData와 같은 모양(positions/annotations/
 * comment 등)이라 Pitch·PlayerNode·AnnotationLayer·OverloadLayer를 그대로
 * 재사용할 수 있다.
 */
export interface ChangingPoint extends PhaseData {
  id: string // 프론트가 생성 (nanoid)
  label: string // 자유 텍스트, 예: "전반 23분 추격 상황"
  minute?: number // 경기 시간(분), 0~120 — 없으면 시간축에 못 놓고 "시간 미정"으로 취급(2026-09-09)
  // 여러 시점을 병합해 만든 경우에만 있다 — 병합 전 각 시점의 원본 스냅샷을
  // 순서대로 보관한다(2026-09-09, "병합하면 시간순으로 자연스럽게 이어지게").
  // 이 필드가 있으면 이 시점을 고를 때 steps를 순서대로 자동 재생하고, 끝나면
  // 이 객체 최상위의 positions/annotations(=마지막 스텝 좌표 + 전체 화살표
  // 모음)로 정착한다 — 같은 선수가 화면 안에서 여러 번 볼을 만지는 경우에도
  // 각 스텝이 독립된 스냅샷이라 "패스가 도착하는 자리에 선수가 없는" 문제가
  // 생기지 않는다(스텝 하나하나가 이미 검증된 낱개 시점 렌더링을 그대로 씀).
  steps?: PhaseData[]
}

export interface Analysis {
  id?: number // 서버 저장 후에만 존재
  schemaVersion: 1
  match: MatchInfo
  formation: string // '4-3-3'
  players: Player[] // 선발 11 + 벤치 최대 12(선택). 벤치는 앞 11명(선발) 뒤에만 붙는다 — TO-DO 14
  phases: Record<PhaseType, PhaseData>
  changingPoints?: ChangingPoint[] // 없으면 타임라인 미사용 — 구버전 데이터도 그대로 유효
  summary: string
  tags: string[] // 목록 검색·필터용 자유 태그 (TO-DO 7번)
  thumbnail?: string // 목록 미리보기용 base64 PNG data URL — 저장 시점에 프론트가 캡처해 채운다 (TO-DO 7번)
  createdAt?: string
  updatedAt?: string
}

/** 목록 조회 전용 (좌표 없음) */
export interface AnalysisSummary {
  id: number
  matchName: string
  homeTeam: string
  awayTeam: string
  matchDate: string
  competition?: string
  updatedAt: string
  tags: string[]
  thumbnail?: string
}

// 시각화 계산용 타입

export type Channel = 'leftWing' | 'leftHalf' | 'center' | 'rightHalf' | 'rightWing'
export type Third = 'attacking' | 'middle' | 'defensive'
export type OverloadLevel = 'none' | 'weak' | 'strong'

export interface ZoneOverload {
  channel: Channel
  third: Third
  own: number
  opp: number
  diff: number
  level: OverloadLevel
}

export interface LayerToggles {
  // 화면 설정. 저장 대상 아님
  channelGrid: boolean
  halfSpaces: boolean
  pressingLine: boolean
  compactness: boolean
  overload: boolean
  ghostView: boolean
}

/** 편집기 도구 — select=선수 이동, run/pass=화살표 그리기 (화면 설정) */
export type DrawTool = 'select' | AnnotationType
