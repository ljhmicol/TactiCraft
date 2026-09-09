import type { Analysis, AnalysisSummary } from '@/types/analysis'

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

export interface CurrentUser {
  id: number
  email: string
}

/** 로그인(TO-DO 11번). 실패 시 ApiError(401/400)를 던진다. */
export function registerUser(email: string, password: string): Promise<CurrentUser> {
  return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
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

/** 앱 진입 시 1회, 저장 실패 시 재확인한다 (3단계 §2.1). 타임아웃 2초. */
export async function fetchHealth(): Promise<{ status: string; version: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2000)
  try {
    const res = await fetch(`${BASE}/health`, { signal: controller.signal })
    if (!res.ok) throw new Error(`health check failed (${res.status})`)
    return (await res.json()) as { status: string; version: string }
  } finally {
    clearTimeout(timer)
  }
}
