import { useRef, useState } from 'react'

import { ThumbnailCard, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/components/export/ThumbnailCard'
import { Button } from '@/components/ui/button'
import { useSaveAnalysis } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { useServerHealth } from '@/hooks/useServerHealth'
import { ApiError } from '@/lib/api'
import { captureThumbnail } from '@/lib/exportImage'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

/**
 * 저장 버튼. 서버 미기동 또는 비로그인 시 비활성화 + 안내 문구를 보여준다
 * (FR-08 폴백, 5단계 5-2-2; 로그인은 TO-DO 11번). 저장 실패 시 서버 헬스를
 * 재확인한다 (3단계 §2.1).
 *
 * 저장할 때마다 목록 미리보기용 썸네일(TO-DO 7번)도 같이 캡처해 페이로드에
 * 싣는다 — 캡처가 실패해도(예: 폰트 로딩 문제) 저장 자체는 막지 않고 기존
 * 썸네일을 그대로 둔다.
 */
export function SaveButton({ analysis }: { analysis: Analysis }) {
  const { isServerUp, isChecking, recheck } = useServerHealth()
  const { isLoggedIn, isChecking: isCheckingAuth } = useCurrentUser()
  const saveMutation = useSaveAnalysis()
  const applySavedMeta = useAnalysisStore((s) => s.applySavedMeta)
  const isDirty = useAnalysisStore((s) => s.isDirty)
  const [errors, setErrors] = useState<string[] | null>(null)
  const thumbnailRef = useRef<HTMLDivElement>(null)

  const handleSave = async () => {
    setErrors(null)
    let thumbnail = analysis.thumbnail
    try {
      if (thumbnailRef.current) thumbnail = await captureThumbnail(thumbnailRef.current, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    } catch {
      // 썸네일 캡처 실패는 저장을 막을 이유가 아니다 — 기존 썸네일(또는 없음) 그대로 진행
    }
    try {
      const saved = await saveMutation.mutateAsync({ ...analysis, thumbnail })
      if (saved.id && saved.createdAt && saved.updatedAt) {
        applySavedMeta({
          id: saved.id,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          visibility: saved.visibility,
          shareToken: saved.shareToken,
        })
      }
    } catch (e) {
      if (e instanceof ApiError && e.issues.length > 0) {
        setErrors(e.issues.map((i) => `${i.path}: ${i.message}`))
      } else {
        setErrors([e instanceof Error ? e.message : '저장에 실패했습니다.'])
      }
      recheck()
    }
  }

  const disabled = !isServerUp || isChecking || isCheckingAuth || !isLoggedIn || saveMutation.isPending

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={handleSave}
        disabled={disabled}
        title={
          !isServerUp
            ? '백엔드 서버가 꺼져 있어 저장할 수 없습니다'
            : !isLoggedIn && !isCheckingAuth
              ? '로그인이 필요합니다'
              : undefined
        }
      >
        {saveMutation.isPending ? '저장 중…' : isDirty ? '저장 *' : '저장'}
      </Button>
      {/* 개선 로드맵 §5.1 — 서버 저장(이 버튼)과 로컬 자동 백업(useDraftAutosave,
       * localStorage)은 별개다. "저장 *"만 보면 지금 편집이 안전한지 알기
       * 어려워서, 서버에 아직 안 올렸어도 이 브라우저엔 남는다는 걸
       * 명시한다 — disabled-button-visible-hint 패턴과 같은 이유로 hover
       * 툴팁이 아니라 항상 보이는 텍스트로 둔다. */}
      {isDirty && !saveMutation.isPending && (
        <span className="text-xs text-slate-300">변경사항은 이 브라우저에 자동 백업됩니다</span>
      )}
      {!isServerUp && !isChecking && (
        <span className="text-xs text-slate-300">서버 미기동 — 편집·PNG 내보내기는 계속 사용 가능합니다</span>
      )}
      {isServerUp && !isLoggedIn && !isCheckingAuth && (
        <span className="text-xs text-slate-300">로그인이 필요합니다 — 편집·PNG 내보내기는 계속 사용 가능합니다</span>
      )}
      {errors && (
        <ul className="max-w-xs list-inside list-disc rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <ThumbnailCard ref={thumbnailRef} analysis={analysis} />
    </div>
  )
}
