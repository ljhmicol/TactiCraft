import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 전역 에러 바운더리(개선 로드맵 §6.4) — 렌더링 중 던진 예외를 React가
 * 그대로 두면 트리 전체가 흰 화면으로 사라진다. 에러 리포팅 서버가 따로
 * 없어서 콘솔에만 남기고(`console.error`), 사용자에게는 새로고침 버튼을
 * 보여준다 — 이 앱 상태(스토어)는 새로고침하면 초기화되므로 "다시
 * 시도"보다 "새로고침"이 실제로 더 나은 복구 방법이다. 함수 컴포넌트에는
 * 에러 바운더리에 해당하는 훅이 없어(React 공식 제약) 클래스 컴포넌트로
 * 작성한다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-foreground">문제가 발생했습니다</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            화면을 표시하는 중 오류가 났습니다. 새로고침하면 대부분 해결됩니다.
          </p>
          <Button onClick={() => window.location.reload()}>새로고침</Button>
        </div>
      )
    }
    return this.props.children
  }
}
