import * as React from "react"

import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

/**
 * 전역 토스트 상태 관리(개선 로드맵 §6.3, 2026-09-20). shadcn/ui의 표준
 * use-toast 패턴을 따른다 — 이 저장소의 다른 ui/ 컴포넌트(button·select·
 * dialog)도 모두 shadcn CLI 산출물을 그대로 쓰는 관례라 맞췄다. React
 * 컴포넌트 밖(예: 훅의 onError 콜백)에서도 `toast()`를 직접 호출할 수 있게
 * 모듈 전역 리스너 배열 + 리듀서로 구현한다(React Context로는 컴포넌트
 * 트리 밖에서 호출이 안 된다).
 *
 * TOAST_REMOVE_DELAY는 공식 shadcn 템플릿의 기본값(1000000ms, 사실상
 * 수동 닫기 전까지 DOM에 남는 버그성 기본값)을 그대로 쓰지 않는다 — Radix
 * Toast.Root 자체가 기본 5초 뒤 자동으로 닫히므로(onOpenChange(false) 호출),
 * 이 지연은 "닫힘 애니메이션이 끝날 시간"만 벌어주면 된다.
 */

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 1000

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type Action =
  | { type: "ADD_TOAST"; toast: ToasterToast }
  | { type: "UPDATE_TOAST"; toast: Partial<ToasterToast> }
  | { type: "DISMISS_TOAST"; toastId?: ToasterToast["id"] }
  | { type: "REMOVE_TOAST"; toastId?: ToasterToast["id"] }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: "REMOVE_TOAST", toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_TOAST":
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }
    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }
    case "DISMISS_TOAST": {
      const { toastId } = action
      if (toastId) addToRemoveQueue(toastId)
      else state.toasts.forEach((t) => addToRemoveQueue(t.id))
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) return { ...state, toasts: [] }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()
  const update = (next: ToasterToast) => dispatch({ type: "UPDATE_TOAST", toast: { ...next, id } })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return { id, dismiss, update }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) listeners.splice(index, 1)
    }
  }, [])

  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }) }
}

// reducer/TOAST_LIMIT는 use-toast.test.ts 전용으로 내보낸다 — 렌더링 없이
// 리듀서 로직(개수 제한·dismiss/remove 구분)만 순수 함수로 검증하기 위해서다.
export { reducer, TOAST_LIMIT, toast, useToast }
