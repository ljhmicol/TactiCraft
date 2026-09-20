import { useToast } from "@/hooks/use-toast"

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast"

/**
 * App.tsx에 한 번만 마운트한다(개선 로드맵 §6.3). Radix `Toast.Provider`가
 * `aria-live` 리전을 자동으로 관리해준다 — 이 프로젝트가 직접 `aria-live`를
 * 손으로 얹지 않아도 되는 이유이자, 토스트를 "통일된 성공/실패 피드백
 * 채널"로 쓰는 근거다(개별 컴포넌트가 각자 접근성을 신경 쓰지 않아도 된다).
 */
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}
