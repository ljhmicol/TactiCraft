import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Analysis } from '@/types/analysis'

/**
 * 저장된 분석의 읽기 전용 공유 링크 복사 버튼 (TO-DO 8번). 서버에 저장된
 * 분석(`analysis.id` 존재)만 공유할 수 있다 — 저장 전 임시 상태는 다른
 * 브라우저에서 열어봐야 아무 의미가 없기 때문. 별도 접근 제어는 없다 —
 * 로그인이 없는 지금 `/api/analyses/:id` 자체가 이미 누구나 읽을 수 있는
 * 엔드포인트라(TO-DO 11 이후 재검토), 이 버튼은 그 사실을 "보여주는 페이지
 * 링크"로 바꿔주는 UX일 뿐 새로운 공개 범위를 만들지 않는다.
 */
export function ShareLinkButton({ analysis }: { analysis: Analysis }) {
  const [copied, setCopied] = useState(false)

  if (!analysis.id) {
    return (
      <Button size="sm" variant="outline" disabled title="먼저 저장해야 공유 링크를 만들 수 있습니다">
        공유 링크
      </Button>
    )
  }

  const url = `${window.location.origin}/share/${analysis.id}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 클립보드 권한이 없는 환경(예: http, 일부 임베드) — 그래도 URL은 이미
      // 만들어졌으니 프롬프트로 최소한 복사할 수 있게 한다.
      window.prompt('아래 링크를 복사하세요', url)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? '복사됨!' : '공유 링크'}
    </Button>
  )
}
