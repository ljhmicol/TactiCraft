import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDuplicateAnalysis } from '@/hooks/useAnalyses'
import { useServerHealth } from '@/hooks/useServerHealth'
import { ApiError } from '@/lib/api'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

/**
 * "다른 이름으로 저장"(TO-DO 25번) — 저장된 분석을 원본은 그대로 두고 새
 * id로 복제한다. 저장 전(analysis.id 없음)에는 그냥 "저장"과 동작이
 * 같아지므로 비활성화한다. 복제가 끝나면 에디터가 그 새 사본을 계속
 * 편집하도록 전환한다 — 원본을 계속 보여주면 "복제했는데 화면은 그대로"라
 * 헷갈린다.
 */
export function DuplicateButton({ analysis }: { analysis: Analysis }) {
  const { isServerUp, isChecking, recheck } = useServerHealth()
  const duplicateMutation = useDuplicateAnalysis()
  const loadAnalysis = useAnalysisStore((s) => s.loadAnalysis)
  const [errors, setErrors] = useState<string[] | null>(null)

  if (!analysis.id) {
    return (
      <Button size="sm" variant="outline" disabled title="먼저 저장해야 복제할 수 있습니다">
        복제 저장
      </Button>
    )
  }

  const handleDuplicate = async () => {
    setErrors(null)
    try {
      const duplicated = await duplicateMutation.mutateAsync(analysis)
      loadAnalysis(duplicated)
    } catch (e) {
      if (e instanceof ApiError && e.issues.length > 0) {
        setErrors(e.issues.map((i) => `${i.path}: ${i.message}`))
      } else {
        setErrors([e instanceof Error ? e.message : '복제에 실패했습니다.'])
      }
      recheck()
    }
  }

  const disabled = !isServerUp || isChecking || duplicateMutation.isPending

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDuplicate}
        disabled={disabled}
        title={!isServerUp ? '백엔드 서버가 꺼져 있어 복제할 수 없습니다' : '원본은 그대로 두고 새 분석으로 복제합니다'}
      >
        {duplicateMutation.isPending ? '복제 중…' : '복제 저장'}
      </Button>
      {errors && (
        <ul className="max-w-xs list-inside list-disc rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
