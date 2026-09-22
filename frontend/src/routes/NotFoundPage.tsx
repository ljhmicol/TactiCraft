import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

/** 라우트에 안 걸리는 URL로 들어왔을 때(개선 로드맵 §6.4) — 예전엔 헤더 밑이
 * 그냥 빈 화면이었다(`<Routes>`가 일치하는 `<Route>`를 못 찾으면 아무것도
 * 안 그린다). */
export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center">
      <h1 className="mb-2 text-2xl font-semibold text-foreground">페이지를 찾을 수 없습니다</h1>
      <p className="mb-6 text-sm text-muted-foreground">주소가 잘못됐거나, 삭제됐거나, 비공개로 전환된 분석일 수 있습니다.</p>
      <Button asChild>
        <Link to="/">홈으로</Link>
      </Button>
    </div>
  )
}
