import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { positionInfoAt } from '@/lib/positions'
import { POSITION_GROUP_KOREAN, positionGroupFromLabel, roleOptionsFor } from '@/lib/tacticalRoles'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Player } from '@/types/analysis'

const NONE_VALUE = '__none__'

/**
 * FR-06 — 선수 이름·등번호·메모·전술 역할 입력/수정. 등번호는 1~99만 허용한다.
 * 선발/벤치 구분은 저장된 필드가 아니라 base 국면 positions에 이 선수가
 * 있는지로 판단한다(TO-DO 14) — 벤치만 삭제 버튼을 보여준다.
 *
 * 전술 역할(TO-DO 20)은 선발이면 포메이션 슬롯(index)에서 도출한 포지션
 * 그룹에 맞는 목록만 보여준다 — 센터백 자리인데 스트라이커 역할을 고를 수
 * 있으면 의미가 없다. 벤치는 어느 자리에 들어갈지 정해지지 않았으므로 전체
 * 목록을 펼친다.
 */
export function PlayerForm({ player, index }: { player: Player; index: number }) {
  const updatePlayer = useAnalysisStore((s) => s.updatePlayer)
  const removePlayer = useAnalysisStore((s) => s.removePlayer)
  const formation = useAnalysisStore((s) => s.analysis?.formation)
  const isStarter = useAnalysisStore((s) =>
    Boolean(s.analysis?.phases.base.positions.some((p) => p.playerId === player.id)),
  )

  // 등번호는 타이핑 중간값(빈 문자열 등)을 그대로 반영하지 않고, 확정
  // 시점(Enter·blur)에만 store에 쓴다(2026-09-23, "9에서 안 지워지고 19를
  // 치니까 99가 됐어") — 이전엔 매 keystroke마다 즉시 clamp해서 store에
  // 썼는데, 지우면(raw==='') clamp 전에 바로 되돌아가 버려 "지워지지 않는"
  // 것처럼 보였고, 그 상태에서 계속 타이핑하니 값이 꼬였다. 로컬 문자열
  // state로 자유롭게 편집하게 하고, 확정될 때만 유효성 검사·clamp한다.
  const [numberInput, setNumberInput] = useState(String(player.number))
  useEffect(() => setNumberInput(String(player.number)), [player.number])

  const commitNumber = () => {
    const n = Number(numberInput)
    if (numberInput.trim() === '' || Number.isNaN(n)) {
      setNumberInput(String(player.number)) // 유효하지 않으면 원래 값으로 되돌린다
      return
    }
    const clamped = Math.min(99, Math.max(1, Math.trunc(n)))
    updatePlayer(player.id, { number: clamped })
    setNumberInput(String(clamped))
  }

  const info = isStarter && formation ? positionInfoAt(formation, index) : null
  const roleOptions = roleOptionsFor(info)

  return (
    <div className="space-y-1 rounded-md border border-transparent p-1 hover:border-border">
      <div className="grid grid-cols-[3.5rem_1fr_auto] items-end gap-2">
        <div>
          <Label htmlFor={`number-${player.id}`} className="text-xs text-muted-foreground">
            #{index + 1}
          </Label>
          {/* 두 자릿수 등번호(20, 22 등)가 잘려 "2"로만 보이던 문제(2026-09-23)
              — 3rem 칸에 기본 px-3 패딩 + 네이티브 number 스피너까지 들어가니
              실제 숫자가 앉을 자리가 한 글자도 안 남았다. 패딩을 줄이고
              스피너를 없애 그 공간을 숫자에 돌려준다(min/max로 이미 범위를
              막고 있어 스피너 없이 타이핑만으로도 충분하다). 칸 자체도
              3rem→3.5rem으로 살짝 넓혔다. */}
          <Input
            id={`number-${player.id}`}
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
            className="px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
        <div>
          <Label htmlFor={`name-${player.id}`} className="text-xs text-muted-foreground">
            이름
          </Label>
          <Input
            id={`name-${player.id}`}
            value={player.name}
            onChange={(e) => updatePlayer(player.id, { name: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <span
            className={
              isStarter
                ? 'whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-muted-foreground'
                : 'whitespace-nowrap rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground'
            }
          >
            {isStarter ? '선발' : '벤치'}
          </span>
          {!isStarter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => removePlayer(player.id)}
            >
              삭제
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`role-${player.id}`} className="text-xs text-muted-foreground">
            메모
          </Label>
          <Input
            id={`role-${player.id}`}
            value={player.role ?? ''}
            onChange={(e) => updatePlayer(player.id, { role: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor={`tactical-role-${player.id}`} className="text-xs text-muted-foreground">
            전술 역할{info ? ` (${POSITION_GROUP_KOREAN[positionGroupFromLabel(info.label, info.line)]})` : ''}
          </Label>
          <Select
            value={player.tacticalRole ?? NONE_VALUE}
            onValueChange={(v) => updatePlayer(player.id, { tacticalRole: v === NONE_VALUE ? undefined : v })}
          >
            <SelectTrigger id={`tactical-role-${player.id}`}>
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
  )
}
