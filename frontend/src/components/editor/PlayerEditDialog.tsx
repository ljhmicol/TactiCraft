import { useEffect, useState } from 'react'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { POSITION_LINE_KOREAN, positionInfoAt } from '@/lib/positions'
import { roleOptionsFor } from '@/lib/tacticalRoles'
import { POSITION_LINE_COLORS } from '@/lib/theme'
import { useAnalysisStore } from '@/store/analysisStore'

const NONE_VALUE = '__none__'

/**
 * TO-DO 13번 — 피치의 선수 클릭(탭)으로 여는 인라인 편집. '선수' 목록
 * (PlayerForm)과 같은 updatePlayer 액션을 공유해 어느 쪽에서 고쳐도 동일하다.
 * 등번호 검증 규칙(1~99)·전술 역할 드롭다운(TO-DO 20)도 PlayerForm과 동일하게
 * 유지한다 — 여기서 열리는 선수는 항상 피치 위(=선발)이므로 포지션 그룹
 * 필터링이 항상 적용된다.
 *
 * 포지션 코드·라인 색 칩은 편집 대상이 아니라 포메이션 슬롯에서 자동 도출한
 * 정보다(lib/positions.ts) — 피치 노드의 색·라벨과 동일 규칙으로 표시한다.
 * 확인 버튼은 입력 즉시 반영(store)되는 기존 방식을 유지하면서 닫기 동작만
 * 명시적으로 제공한다 (2026-09-01 사용자 요청).
 */
export function PlayerEditDialog() {
  const analysis = useAnalysisStore((s) => s.analysis)
  const editingPlayerId = useAnalysisStore((s) => s.editingPlayerId)
  const setEditingPlayer = useAnalysisStore((s) => s.setEditingPlayer)
  const updatePlayer = useAnalysisStore((s) => s.updatePlayer)

  const player = analysis?.players.find((p) => p.id === editingPlayerId) ?? null
  const index = analysis?.players.findIndex((p) => p.id === editingPlayerId) ?? -1
  const info = analysis && index >= 0 ? positionInfoAt(analysis.formation, index) : null

  // 등번호는 확정 시점(Enter·blur)에만 store에 쓴다(2026-09-23, PlayerForm.tsx와
  // 같은 이유 — "9에서 안 지워지고 19를 치니까 99가 됐어"). 훅은 아래
  // `if (!player) return null`보다 먼저 와야 한다(조기 반환이 있어도 매
  // 렌더마다 훅 호출 순서가 같아야 하는 규칙).
  const [numberInput, setNumberInput] = useState(String(player?.number ?? 1))
  useEffect(() => {
    // player.number 값이 바뀔 때만 동기화한다 — player 객체는 다른 필드
    // (이름·메모 등) 변경만으로도 analysis가 통째로 새로 만들어지며 매번
    // 새 참조가 되므로, player 자체를 deps에 넣으면 다른 필드를 고칠 때마다
    // 지금 타이핑 중인 등번호 입력이 저장된 값으로 덮어써진다.
    if (player) setNumberInput(String(player.number))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.number])

  if (!player) return null

  const roleOptions = roleOptionsFor(info)

  const commitNumber = () => {
    const n = Number(numberInput)
    if (numberInput.trim() === '' || Number.isNaN(n)) {
      setNumberInput(String(player.number))
      return
    }
    const clamped = Math.min(99, Math.max(1, Math.trunc(n)))
    updatePlayer(player.id, { number: clamped })
    setNumberInput(String(clamped))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && setEditingPlayer(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            선수 수정
            {info && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: POSITION_LINE_COLORS[info.line].fill, color: POSITION_LINE_COLORS[info.line].text }}
              >
                {info.label} · {POSITION_LINE_KOREAN[info.line]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[4rem_1fr] gap-3">
            <div>
              <Label htmlFor={`edit-number-${player.id}`} className="text-xs text-muted-foreground">
                등번호
              </Label>
              {/* 스피너 제거(2026-09-23, PlayerForm.tsx와 같은 이유) — 이 칸은
                  4rem으로 넉넉해 실제로 잘린 적은 없지만, 두 자릿수+스피너
                  조합의 여유가 크지 않아 예방적으로 맞춘다. */}
              <Input
                id={`edit-number-${player.id}`}
                type="number"
                min={1}
                max={99}
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                onBlur={commitNumber}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  commitNumber()
                  e.currentTarget.blur()
                }}
                className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <div>
              <Label htmlFor={`edit-name-${player.id}`} className="text-xs text-muted-foreground">
                이름
              </Label>
              <Input
                id={`edit-name-${player.id}`}
                value={player.name}
                onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`edit-role-${player.id}`} className="text-xs text-muted-foreground">
                메모
              </Label>
              <Input
                id={`edit-role-${player.id}`}
                value={player.role ?? ''}
                onChange={(e) => updatePlayer(player.id, { role: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`edit-tactical-role-${player.id}`} className="text-xs text-muted-foreground">
                전술 역할
              </Label>
              <Select
                value={player.tacticalRole ?? NONE_VALUE}
                onValueChange={(v) => updatePlayer(player.id, { tacticalRole: v === NONE_VALUE ? undefined : v })}
              >
                <SelectTrigger id={`edit-tactical-role-${player.id}`}>
                  <SelectValue placeholder="선택 안 함" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>선택 안 함</SelectItem>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id} title={r.blurb}>
                      {r.groupLabel ? `${r.label} · ${r.groupLabel}` : r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => setEditingPlayer(null)}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
