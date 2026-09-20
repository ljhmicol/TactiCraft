import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { Analysis } from '@/types/analysis'

/**
 * 저장된 분석의 읽기 전용 공유 링크 복사 버튼 (TO-DO 8번). 서버에 저장된
 * 분석(`analysis.id` 존재)만 공유할 수 있다 — 저장 전 임시 상태는 다른
 * 브라우저에서 열어봐야 아무 의미가 없기 때문.
 *
 * 2026-09-18(개선 로드맵 §5.2)부터 링크 모양이 공개 범위에 따라 달라진다 —
 * 예전엔 `/api/analyses/:id`가 로그인 여부와 무관하게 항상 공개라 어떤
 * 분석이든(비공개라 표시돼 있어도) 이 버튼이 그대로 작동하는 게 실제
 * 취약점이었다. 지금은: "커뮤니티 공개"만 예전처럼 `/share/:id`(이미 완전
 * 공개라 숨길 이유가 없고, 기존에 공유된 링크도 그대로 살아있어야 한다),
 * "링크 공개"는 추측 불가능한 토큰으로 `/s/:token`, "비공개"는 공유 링크
 * 자체가 없다(먼저 공개 범위를 바꿔야 한다).
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

  const visibility = analysis.visibility ?? 'private'

  if (visibility === 'private') {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        title="비공개 상태입니다 — 링크 공개나 커뮤니티 공개로 바꾸면 공유 링크가 생깁니다"
      >
        공유 링크
      </Button>
    )
  }

  const url =
    visibility === 'community'
      ? `${window.location.origin}/share/${analysis.id}`
      : `${window.location.origin}/s/${analysis.shareToken}`

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
