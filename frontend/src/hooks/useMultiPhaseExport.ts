import { useRef, useState } from 'react'

import { toast } from '@/hooks/use-toast'
import { exportMultiPhaseCard } from '@/lib/exportImage'
import { MULTI_PHASE_CARD_HEIGHT, MULTI_PHASE_CARD_WIDTH } from '@/components/export/MultiPhaseShareCard'

/**
 * 기본·공격·수비 3국면을 한 장으로 내보내는 PNG 상태(useCardExport와 같은
 * 이유로 훅으로 분리) — 2026-09-23.
 */
export function useMultiPhaseExport() {
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleExport = async () => {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const blob = await exportMultiPhaseCard(cardRef.current, MULTI_PHASE_CARD_WIDTH, MULTI_PHASE_CARD_HEIGHT)
      toast({ description: `PNG 생성 완료 (${Math.round(blob.size / 1024)}KB)` })
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      toast({ variant: 'destructive', description: `PNG 내보내기에 실패했습니다. ${detail}` })
    } finally {
      setExporting(false)
    }
  }

  return { exporting, handleExport, cardRef }
}
