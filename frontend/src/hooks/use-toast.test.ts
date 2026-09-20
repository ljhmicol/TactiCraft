import { describe, expect, it } from 'vitest'

import { reducer, TOAST_LIMIT } from './use-toast'

// 렌더링 없이 리듀서(개선 로드맵 §6.3)의 순수 상태 전이만 검증한다 —
// use-toast.ts의 toast()/useToast()는 모듈 전역 리스너를 쓰는 싱글턴이라
// 여러 테스트가 상태를 공유하게 돼 격리가 어렵다. reducer는 그 상태 전이
// 규칙 자체이므로 순수 함수로 따로 테스트할 수 있다.

type State = Parameters<typeof reducer>[0]

function makeToast(id: string): State['toasts'][number] {
  return { id, open: true }
}

describe('use-toast reducer', () => {
  it('ADD_TOAST는 새 토스트를 맨 앞에 추가하고 TOAST_LIMIT을 넘으면 오래된 것을 자른다', () => {
    let state: State = { toasts: [] }
    for (let i = 0; i < TOAST_LIMIT + 2; i++) {
      state = reducer(state, { type: 'ADD_TOAST', toast: makeToast(String(i)) })
    }
    expect(state.toasts).toHaveLength(TOAST_LIMIT)
    // 가장 최근 것(마지막으로 추가한 id)이 맨 앞에 있어야 한다.
    expect(state.toasts[0].id).toBe(String(TOAST_LIMIT + 1))
  })

  it('DISMISS_TOAST(id 지정)는 그 토스트만 open:false로 바꾸고 목록에서 지우지는 않는다', () => {
    const state = { toasts: [makeToast('a'), makeToast('b')] }
    const next = reducer(state, { type: 'DISMISS_TOAST', toastId: 'a' })
    expect(next.toasts).toHaveLength(2)
    expect(next.toasts.find((t) => t.id === 'a')?.open).toBe(false)
    expect(next.toasts.find((t) => t.id === 'b')?.open).toBe(true)
  })

  it('DISMISS_TOAST(id 없음)는 전체를 open:false로 바꾼다', () => {
    const state = { toasts: [makeToast('a'), makeToast('b')] }
    const next = reducer(state, { type: 'DISMISS_TOAST' })
    expect(next.toasts.every((t) => !t.open)).toBe(true)
  })

  it('REMOVE_TOAST(id 지정)는 그 토스트만 목록에서 제거한다', () => {
    const state = { toasts: [makeToast('a'), makeToast('b')] }
    const next = reducer(state, { type: 'REMOVE_TOAST', toastId: 'a' })
    expect(next.toasts.map((t) => t.id)).toEqual(['b'])
  })

  it('REMOVE_TOAST(id 없음)는 전체를 비운다', () => {
    const state = { toasts: [makeToast('a'), makeToast('b')] }
    const next = reducer(state, { type: 'REMOVE_TOAST' })
    expect(next.toasts).toHaveLength(0)
  })

  it('UPDATE_TOAST는 해당 id의 필드만 병합한다', () => {
    const state = { toasts: [{ ...makeToast('a'), title: '이전' }] }
    const next = reducer(state, { type: 'UPDATE_TOAST', toast: { id: 'a', title: '이후' } })
    expect(next.toasts[0]).toMatchObject({ id: 'a', title: '이후', open: true })
  })
})
