import type { Analysis, AnalysisSummary, CommunityAnalysis, Visibility } from '@/types/analysis'

const BASE = import.meta.env.VITE_API_BASE_URL as string

export const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
export const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

/**
 * 재귀적으로 객체 키를 변환한다. `phases`처럼 "키가 데이터인" 맵을 만나면 그
 * 직계 자식 키(base/attack/defense)는 건드리지 않고 값만 재귀 변환한다
 * (4단계 §3.1) — 지금은 phase 이름이 단어 하나라 변환해도 그대로지만, 2차
 * 타임라인 확장에서 키가 복잡해지면 이 보호가 없으면 깨진다.
 */
export function convertKeys(value: unknown, fn: (s: string) => string, keysProtected = false): unknown {
  if (Array.isArray(value)) return value.map((v) => convertKeys(v, fn, false))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => {
        const outKey = keysProtected ? k : fn(k)
        return [outKey, convertKeys(v, fn, k === 'phases')]
      }),
    )
  }
  return value
}

interface ApiIssue {
  path: string
  message: string
}

export class ApiError extends Error {
  status: number
  issues: ApiIssue[]

  constructor(status: number, message: string, issues: ApiIssue[] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }
}

/** `["body","phases","attack","positions",3,"x"]` -> `"phases.attack.positions[3].x"` */
function formatLoc(loc: (string | number)[]): string {
  let out = ''
  for (const part of loc) {
    if (part === 'body') continue
    out += typeof part === 'number' ? `[${part}]` : out ? `.${part}` : String(part)
  }
  return out || '(root)'
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // 본문이 JSON이 아닐 수 있다 (예: 502)
  }
  const detail = (body as { detail?: unknown } | null)?.detail

  if (Array.isArray(detail)) {
    // FastAPI 422 형식 (3단계 §2.7)
    const issues: ApiIssue[] = detail.map((d) => ({
      path: formatLoc((d as { loc: (string | number)[] }).loc),
      message: (d as { msg: string }).msg,
    }))
    return new ApiError(
      res.status,
      issues.map((i) => `${i.path}: ${i.message}`).join('\n'),
      issues,
    )
  }
  const message = typeof detail === 'string' ? detail : `요청에 실패했습니다 (${res.status})`
  return new ApiError(res.status, message)
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    // 로그인(TO-DO 11번) 세션은 httpOnly 쿠키다 — 이게 없으면 브라우저가
    // 쿠키를 안 보내 로그인해도 매 요청이 401로 취급된다.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: init?.body ? JSON.stringify(convertKeys(JSON.parse(init.body as string), toSnake)) : undefined,
  })
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return convertKeys(await res.json(), toCamel) as T
}

export function fetchAnalyses(): Promise<AnalysisSummary[]> {
  return apiFetch('/analyses')
}

export function fetchAnalysis(id: number): Promise<Analysis> {
  return apiFetch(`/analyses/${id}`)
}

/** 공유 토큰으로 분석을 읽는다(개선 로드맵 §5.2, "링크 공개" 전용 경로) —
 * id 기반 fetchAnalysis와 달리 이 엔드포인트는 visibility가 'link' 또는
 * 'community'인 분석만 반환한다. */
export function fetchSharedAnalysis(token: string): Promise<Analysis> {
  return apiFetch(`/share/${token}`)
}

type AnalysisPayload = Omit<Analysis, 'id' | 'createdAt' | 'updatedAt'>

export function createAnalysis(data: AnalysisPayload): Promise<Analysis> {
  return apiFetch('/analyses', { method: 'POST', body: JSON.stringify(data) })
}

export function updateAnalysis(id: number, data: AnalysisPayload): Promise<Analysis> {
  return apiFetch(`/analyses/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteAnalysis(id: number): Promise<void> {
  return apiFetch(`/analyses/${id}`, { method: 'DELETE' })
}

/** 공개 범위 변경(개선 로드맵 §5.2, 기존 setAnalysisPublic 대체) — 전용 PATCH,
 * 전체 저장(PUT)과 분리된 이유는 백엔드 schemas.AnalysisVisibilityIn의
 * docstring 참조. */
export function setAnalysisVisibility(id: number, visibility: Visibility): Promise<AnalysisSummary> {
  return apiFetch(`/analyses/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ visibility }) })
}

/** 커뮤니티 목록(TO-DO 12번 후속) — 공개(visibility='community')로 설정된 분석만.
 * 댓글 읽기와 같은 이유로 로그인 여부와 무관하게 공개다. sort(TO-DO 41
 * 후속) — 'recent'(기본, 최신순) | 'popular'(좋아요 많은 순). */
export function fetchCommunityAnalyses(sort: 'recent' | 'popular' = 'recent'): Promise<CommunityAnalysis[]> {
  return apiFetch(`/community/analyses?sort=${sort}`)
}

/** 좋아요 토글(TO-DO 41 후속) — 로그인 필수. 누른 뒤 상태와 최신 총 개수를
 * 같이 받아서 프론트가 별도 재조회 없이 버튼·카운트를 즉시 반영한다. */
export function toggleLike(analysisId: number): Promise<{ liked: boolean; likeCount: number }> {
  return apiFetch(`/community/analyses/${analysisId}/like`, { method: 'POST' })
}

export interface CurrentUser {
  id: number
  email: string
  // 백필 전 구버전 계정엔 없을 수 있다(TO-DO 12번 도입 이전 가입) — 실질적으론
  // main.py 마이그레이션이 이메일 앞부분으로 채워 넣어서 항상 값이 있다.
  username?: string
  // 운영자 여부(개선 로드맵 §5.5) — 서버가 config.py의 admin_emails로 판정해
  // 내려준다. "신고함" 메뉴 노출 여부에만 쓴다 — 실제 권한 검사는 서버가
  // 매번 다시 한다(AdminReportsPage 참조).
  isAdmin?: boolean
}

/** 로그인(TO-DO 11번). 실패 시 ApiError(401/400)를 던진다. */
export function registerUser(email: string, username: string, password: string): Promise<CurrentUser> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, username, password }) })
}

export function loginUser(email: string, password: string): Promise<CurrentUser> {
  return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function logoutUser(): Promise<void> {
  return apiFetch('/auth/logout', { method: 'POST' })
}

/** 회원 탈퇴 — 본인 소유 분석까지 서버에서 함께 삭제된다. */
export function withdrawUser(): Promise<void> {
  return apiFetch('/auth/me', { method: 'DELETE' })
}

/** 비로그인 상태면 401 ApiError를 던진다 — useCurrentUser가 로그아웃 상태로 취급한다. */
export function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch('/auth/me')
}

/** 내 정보 페이지의 닉네임 변경. 이미 쓰는 사용자명이면 400 ApiError. */
export function changeUsername(username: string): Promise<CurrentUser> {
  return apiFetch('/auth/me/username', { method: 'PATCH', body: JSON.stringify({ username }) })
}

/** 내 정보 페이지의 비밀번호 변경. 현재 비밀번호가 틀리면 400 ApiError. 성공하면
 * 서버가 이 브라우저를 뺀 다른 모든 세션을 끊는다(백엔드 change_password 참조). */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// 댓글(TO-DO 12번) + 대댓글·좋아요/싫어요(TO-DO 54, 2026-09-16). 읽기는
// 공유 링크 방문자 누구나(비로그인 포함), 작성·반응은 로그인 필수(백엔드가
// 401로 막는다). parentId가 있으면 대댓글 — 최상위 댓글이면 undefined.
export interface Comment {
  id: number
  analysisId: number
  userId: number
  parentId?: number
  username: string
  body: string
  createdAt: string
  likeCount: number
  dislikeCount: number
  myReaction: 'like' | 'dislike' | null
}

export function fetchComments(analysisId: number): Promise<Comment[]> {
  return apiFetch(`/analyses/${analysisId}/comments`)
}

/** parentId를 주면 대댓글로 등록된다 — 대댓글에 또 답글을 달아도(대댓글의
 * id를 parentId로 넘겨도) 백엔드가 최상위 댓글로 평탄화한다(1단계 깊이만). */
export function createComment(analysisId: number, body: string, parentId?: number): Promise<Comment> {
  return apiFetch(`/analyses/${analysisId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body, parentId }),
  })
}

export function deleteComment(commentId: number): Promise<void> {
  return apiFetch(`/comments/${commentId}`, { method: 'DELETE' })
}

/** 댓글 좋아요/싫어요 토글(TO-DO 54) — 로그인 필수. 같은 값을 다시 누르면
 * 취소, 반대 값을 누르면 전환된다. 프론트가 재조회 없이 즉시 반영하도록
 * 최신 my_reaction/카운트를 한 번에 돌려준다. */
export function toggleCommentReaction(
  commentId: number,
  value: 'like' | 'dislike',
): Promise<{ myReaction: 'like' | 'dislike' | null; likeCount: number; dislikeCount: number }> {
  return apiFetch(`/comments/${commentId}/reaction`, { method: 'POST', body: JSON.stringify({ value }) })
}

// 신고 + 운영자 처리(개선 로드맵 §5.5, 2026-09-20 "신고/차단도 이번에
// 같이"). "차단"은 별도 사용자 차단 기능이 아니라 운영자가 신고된 콘텐츠를
// 숨기거나(setAnalysisVisibility 재사용) 지우는(deleteComment 재사용) 조치를
// 가리킨다 — routers/moderation.py 상단 docstring 참조.
export interface Report {
  id: number
  targetType: 'analysis' | 'comment'
  targetId: number
  reporterUsername: string
  reason: string | null
  createdAt: string
  status: 'open' | 'resolved'
  /** 신고 목록에서 대상을 다시 열어보지 않아도 되게 붙는 짧은 미리보기 —
   * 대상이 이미 지워졌으면 null. */
  targetPreview: string | null
}

export function reportAnalysis(analysisId: number, reason?: string): Promise<Report> {
  return apiFetch(`/analyses/${analysisId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) })
}

export function reportComment(commentId: number, reason?: string): Promise<Report> {
  return apiFetch(`/comments/${commentId}/report`, { method: 'POST', body: JSON.stringify({ reason: reason || undefined }) })
}

/** 운영자 전용(서버가 403으로 강제) — 미해결 신고 목록. */
export function fetchOpenReports(): Promise<Report[]> {
  return apiFetch('/moderation/reports?status_filter=open')
}

export function resolveReport(reportId: number): Promise<Report> {
  return apiFetch(`/moderation/reports/${reportId}/resolve`, { method: 'POST' })
}

/**
 * 앱 진입 시 1회, 저장 실패 시 재확인한다 (3단계 §2.1). 타임아웃 8초(개선
 * 로드맵 §5.6, 2026-09-20 정정) — 원래 2초였는데, Fly.io는
 * `min_machines_running = 0`이라 트래픽이 없으면 머신이 꺼지고 요청이 오면
 * 다시 켜지는 구조다(TO-DO 59). 이 콜드 스타트 동안은 Fly 프록시가 연결을
 * 계속 물고 있다가 머신이 뜨면 응답하므로 "서버가 느린 것"과 "서버가 아예
 * 없는 것"을 구분할 수 없는데, 2초는 콜드 스타트가 끝나기도 전에 매번
 * 타임아웃나기 충분히 짧은 값이었다 — 실제로 백엔드가 꺼져 있는 경우(로컬
 * 개발에서 의도적으로 안 띄운 경우)는 연결 자체가 즉시 거부되므로(TCP
 * connection refused) 이 타임아웃과 무관하게 곧바로 실패한다. 재시도
 * 백오프는 이 함수가 아니라 호출부(useServerHealth)의 react-query
 * retry/retryDelay가 맡는다 — 이 함수는 "한 번 시도"만 책임진다.
 */
export async function fetchHealth(): Promise<{ status: string; version: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${BASE}/health`, { signal: controller.signal })
    if (!res.ok) throw new Error(`health check failed (${res.status})`)
    return (await res.json()) as { status: string; version: string }
  } finally {
    clearTimeout(timer)
  }
}
