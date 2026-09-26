import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { FormationPicker } from '@/components/editor/FormationPicker'
import { useCurrentUser } from '@/hooks/useAuth'
import { useDeleteRosterTemplate, useRosterTemplate, useRosterTemplates } from '@/hooks/useRosterTemplates'
import type { RosterTemplatePlayer } from '@/lib/api'
import { cn } from '@/lib/utils'

interface RosterTemplatePickerProps {
  onSelect: (formation: string, players: RosterTemplatePlayer[]) => void
}

/**
 * 내 팀·선수단 템플릿으로 시작하기(개선 로드맵 §7.2). 템플릿에는 좌표가
 * 없으므로(선수 명단뿐) 포메이션은 이 자리에서 별도로 고른다 — 템플릿을
 * 하나 고르면 그 아래에 기존 `FormationPicker`가 펼쳐지고, 포메이션까지
 * 고르면 그때 `onSelect(formation, players)`를 호출한다.
 */
export function RosterTemplatePicker({ onSelect }: RosterTemplatePickerProps) {
  const { isLoggedIn, isChecking } = useCurrentUser()
  const { data: templates, isLoading } = useRosterTemplates()
  const deleteTemplate = useDeleteRosterTemplate()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const { data: selected } = useRosterTemplate(selectedId ?? undefined)

  const handleDelete = (id: number, name: string) => {
    if (!window.confirm(`"${name}" 선수단을 삭제할까요? 되돌릴 수 없습니다.`)) return
    if (selectedId === id) setSelectedId(null)
    deleteTemplate.mutate(id)
  }

  if (isChecking || isLoading) return <p className="text-sm text-muted-foreground">불러오는 중…</p>
  if (!isLoggedIn) return <p className="text-sm text-muted-foreground">로그인하면 저장해 둔 선수단을 불러올 수 있습니다.</p>
  if (!templates || templates.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        아직 저장된 선수단이 없습니다. 에디터 상단의 &quot;내 팀 저장&quot; 버튼으로 만들어 보세요.
      </p>
    )

  return (
    <div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {templates.map((t) => (
          <div key={t.id} className="flex items-center gap-2 px-2">
            <button
              type="button"
              onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
              className={cn(
                'min-w-0 flex-1 rounded-md px-2 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                selectedId === t.id && 'bg-accent',
              )}
            >
              <span className="font-semibold text-foreground">{t.name}</span>
              <span className="block text-xs text-muted-foreground">
                선수 {t.playerCount}명 · {t.updatedAt.slice(0, 10)} 저장
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(t.id, t.name)}
              aria-label={`${t.name} 선수단 삭제`}
              className="shrink-0 rounded-md p-2 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {selectedId && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-muted-foreground">포메이션을 고르면 이 선수단으로 시작합니다.</p>
          {selected ? (
            <FormationPicker onSelect={(formation) => onSelect(formation, selected.players)} />
          ) : (
            <p className="text-sm text-muted-foreground">불러오는 중…</p>
          )}
        </div>
      )}
    </div>
  )
}
