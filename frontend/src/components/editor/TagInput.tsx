import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAnalysisStore } from '@/store/analysisStore'

/**
 * 목록 검색·필터용 자유 태그(TO-DO 7번). 사전 정의 목록 없음 — Enter로
 * 하나씩 추가하고 칩의 ×로 지운다. 매 글자마다 store에 커밋하지 않고
 * Enter 시점에만 커밋한다 — annotations/players 등 다른 목록 편집과
 * 같은 패턴("타이핑 도중"이 아니라 "확정된 항목"만 히스토리에 남음).
 */
export function TagInput({ tags }: { tags: string[] }) {
  const setTags = useAnalysisStore((s) => s.setTags)
  const [draft, setDraft] = useState('')

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitDraft()
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  return (
    <div>
      <Label htmlFor="tagInput">태그</Label>
      <Input
        id="tagInput"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="입력 후 Enter"
      />
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={`${tag} 태그 삭제`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
