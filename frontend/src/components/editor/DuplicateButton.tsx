import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useDuplicateAnalysis } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
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
  const { recheck } = useServerHealth()
  const { isLoggedIn, isChecking: isCheckingAuth } = useCurrentUser()
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

  // 개선 로드맵 §5.6/§6.3(2026-09-20) — SaveButton과 같은 이유로 헬스체크
  // 실패만으로 영구 비활성화하지 않는다: Fly.io 콜드 스타트 중엔 곧 뜰
  // 서버인데도 이 버튼이 눌리지 않으면 사용자가 서버를 깨울 방법이 없다.
  const disabled = isCheckingAuth || !isLoggedIn || duplicateMutation.isPending

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleDuplicate}
        disabled={disabled}
        title={!isLoggedIn && !isCheckingAuth ? '로그인이 필요합니다' : '원본은 그대로 두고 새 분석으로 복제합니다'}
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
