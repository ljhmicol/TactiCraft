/**
 * 최초 사용자 가이드 + 고급 기능 첫 펼침 안내(개선 로드맵 §6.1, 2026-09-20).
 * draftStorage.ts와 같은 이유로 모든 호출을 try/catch로 감싼다(프라이빗
 * 브라우징 등으로 localStorage가 막혀 있어도 가이드 자체가 편집을 막으면
 * 안 된다) — 실패하면 "아직 안 봤다"로 취급해 매번 다시 보여주는 쪽이,
 * 아예 못 끄는 쪽보다 낫다.
 */

const ONBOARDING_DISMISSED_KEY = 'tacticraft:onboarding-dismissed'
const ADVANCED_INTRO_SEEN_KEY = 'tacticraft:advanced-intro-seen'

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1')
  } catch {
    // no-op
  }
}

export function hasSeenAdvancedIntro(): boolean {
  try {
    return localStorage.getItem(ADVANCED_INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markAdvancedIntroSeen(): void {
  try {
    localStorage.setItem(ADVANCED_INTRO_SEEN_KEY, '1')
  } catch {
    // no-op
  }
}
