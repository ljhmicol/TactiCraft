import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateRosterTemplate } from '@/hooks/useRosterTemplates'
import { useCurrentUser } from '@/hooks/useAuth'
import type { Analysis } from '@/types/analysis'

/**
 * 내 팀·선수단 템플릿 저장(개선 로드맵 §7.2). 지금 분석의 `players`(선발+
 * 벤치, 좌표 없음)를 이름으로만 저장해 두고, 나중에 `/new`에서 새 분석을
 * 만들 때 그대로 불러 쓸 수 있게 한다 — `id`는 뺀다(적용 시점에 새 nanoid를
 * 새로 발급하므로 저장된 id를 재사용할 이유가 없다, RosterTemplatePlayer
 * 참조). 템플릿은 이 시점 값의 스냅샷일 뿐이라 나중에 템플릿을 고쳐도 이미
 * 만들어둔 분석에는 영향이 없다(로드맵 요구사항 — 저장이 분석의 players를
 * 그대로 복사해 넣지, 템플릿을 참조하지 않기 때문에 자연히 성립한다).
 */
export function SaveRosterTemplateButton({ analysis }: { analysis: Analysis }) {
  const { isLoggedIn, isChecking } = useCurrentUser()
  const createTemplate = useCreateRosterTemplate()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const defaultName = analysis.match.homeTeam || analysis.match.matchName || '내 선수단'

  const handleOpenChange = (next: boolean) => {
    if (next) setName(defaultName)
    setOpen(next)
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await createTemplate.mutateAsync({
      name: trimmed,
      players: analysis.players.map((p) => ({
        name: p.name,
        number: p.number,
        role: p.role,
        tacticalRole: p.tacticalRole,
      })),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={isChecking || !isLoggedIn}
          title={!isLoggedIn && !isChecking ? '로그인이 필요합니다' : '지금 선수단을 템플릿으로 저장해 다음 분석에서 불러올 수 있습니다'}
        >
          내 팀 저장
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>선수단 템플릿으로 저장</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="roster-template-name">템플릿 이름</Label>
          <Input
            id="roster-template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 우리 팀 U-18"
          />
          <p className="text-xs text-muted-foreground">
            선수 {analysis.players.length}명(이름·등번호·포지션·역할)이 저장됩니다. 좌표·국면·코멘트는 저장되지
            않습니다.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!name.trim() || createTemplate.isPending}>
            {createTemplate.isPending ? '저장 중…' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
