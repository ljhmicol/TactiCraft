import type { Analysis } from '@/types/analysis'

/**
 * 편집 중인 분석의 로컬 임시 저장(개선 로드맵 §5.1, "초안 자동복구"). 서버
 * 저장(SaveButton)과 별개로, 새로고침·탭 종료·서버 중단으로 브라우저 메모리
 * (zustand 스토어)만 날아가도 방금까지 그리던 전술을 복구할 수 있게 한다.
 *
 * 한 번에 하나만 편집하는 앱 구조라(에디터가 한 분석만 들고 있음) 슬롯을
 * 하나만 둔다 — 여러 초안을 동시에 관리할 이유가 없다. localStorage는
 * 프라이빗 브라우징·저장공간 차단 등으로 던질 수 있어 모든 호출을
 * try/catch로 감싼다(실패해도 편집 자체는 계속돼야 한다 — 초안 저장은
 * 있으면 좋은 안전망이지 편집을 막는 요건이 아니다).
 */

const DRAFT_KEY = 'tacticraft:draft:v1'

export interface Draft {
  analysis: Analysis
  savedAt: string
}

export function saveDraft(analysis: Analysis): void {
  try {
    // thumbnail은 base64 PNG data URL이라 다른 필드를 전부 합친 것보다도
    // 크다 — 저장할 때(SaveButton)마다 화면에서 다시 캡처해 채우는
    // 파생값이라 초안에는 필요 없다. 큰 값을 계속 쓰면 localStorage 용량
    // 제한(도메인당 보통 5~10MB)에 걸려 저장이 조용히 실패할 위험만
    // 커진다(2026-09-18 advisor 리뷰).
    const { thumbnail: _thumbnail, ...withoutThumbnail } = analysis
    void _thumbnail
    const draft: Draft = { analysis: withoutThumbnail, savedAt: new Date().toISOString() }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // 저장 공간이 없거나 차단된 환경 — 조용히 무시(편집은 계속 가능해야 함)
  }
}

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Draft
    if (!parsed.analysis || !parsed.savedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // no-op
  }
}
