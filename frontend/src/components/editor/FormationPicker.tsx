import { FORMATION_NAMES } from '@/lib/formations'
import { cn } from '@/lib/utils'

interface FormationPickerProps {
  onSelect: (formation: string) => void
}

/** FR-06 — 포메이션 프리셋 선택 카드 (TO-DO 15번으로 18종). */
export function FormationPicker({ onSelect }: FormationPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {FORMATION_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4',
            'whitespace-nowrap text-base font-semibold text-foreground transition-colors hover:border-primary hover:bg-accent',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          {name}
        </button>
      ))}
    </div>
  )
}
