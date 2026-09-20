import { useRef, useState } from 'react'

import { ThumbnailCard, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '@/components/export/ThumbnailCard'
import { Button } from '@/components/ui/button'
import { useSaveAnalysis } from '@/hooks/useAnalyses'
import { useCurrentUser } from '@/hooks/useAuth'
import { useServerHealth } from '@/hooks/useServerHealth'
import { toast } from '@/hooks/use-toast'
import { ApiError } from '@/lib/api'
import { captureThumbnail } from '@/lib/exportImage'
import { useAnalysisStore } from '@/store/analysisStore'
import type { Analysis } from '@/types/analysis'

type SaveState = 'idle' | 'waking' | 'saving' | 'retrying' | 'done'

// 개선 로드맵 §5.6(2026-09-20) — 콜드 스타트 중 저장이 실패해도 최대 2번
// 더 시도한다("제한된" 재시도 — 무한 재시도가 아니다). 재시도는 fetch
// 자체가 응답 없이 실패한 경우(ApiError가 아닌 경우 — 서버가 실제로 응답을
// 준 4xx/5xx는 ApiError로 온다)에만 한다. 이게 안전한 건 `apiFetch`(lib/api.ts)가
// AbortController/타임아웃을 전혀 걸지 않기 때문이다 — 그래서 ApiError가
// 아닌 실패는 사실상 "요청이 서버에 닿기도 전에 끊겼다"는 뜻이라 재시도해도
// 이중 처리 위험이 낮다. **이 저장 요청이 새 분석 생성(POST)일 때는** 그래도
// 이론적으로 재시도가 중복 생성으로 이어질 여지가 남는다 — 이 앱 규모(1인
// 개발, 낮은 동시 사용자 수)에서는 멱등성 키까지 도입할 정도는 아니라고
// 판단해 받아들인 트레이드오프다. **`apiFetch`에 나중에 클라이언트 타임아웃을
// 추가한다면 이 가정이 깨진다** — 그때는 "요청이 안 닿았다"를 더 이상
// 보장할 수 없으므로 이 재시도 로직도 같이 재검토해야 한다.
const MAX_SAVE_RETRIES = 2
const RETRY_DELAYS_MS = [3000, 6000]

/**
 * 저장 버튼. 비로그인 시에만 비활성화한다(FR-08 폴백, 5단계 5-2-2; 로그인은
 * TO-DO 11번). **서버 헬스체크 실패만으로는 더 이상 비활성화하지 않는다**
 * (개선 로드맵 §5.6, 2026-09-20 정정) — Fly.io는 트래픽이 없으면 머신이
 * 꺼지므로(TO-DO 59) 헬스체크가 실패한 순간에도 실제로는 곧 뜰 서버일 수
 * 있다. 예전엔 이 상태에서 버튼 자체가 눌리지 않아 사용자가 "서버를 깨울"
 * 방법이 없었다 — 이제는 클릭하면 실제 저장 요청이 그대로 나가고, 그
 * 요청이 Fly 프록시를 거치며 서버를 깨운다. `saveState`로 진행 상황을
 * "서버 깨우는 중… → 재시도 중… → 저장 완료"로 보여준다.
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
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const thumbnailRef = useRef<HTMLDivElement>(null)

  const handleSave = async () => {
    setErrors(null)
    let thumbnail = analysis.thumbnail
    try {
      if (thumbnailRef.current) thumbnail = await captureThumbnail(thumbnailRef.current, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT)
    } catch {
      // 썸네일 캡처 실패는 저장을 막을 이유가 아니다 — 기존 썸네일(또는 없음) 그대로 진행
    }

    const attempt = async (retriesLeft: number): Promise<void> => {
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
        setSaveState('done')
        toast({ description: '저장되었습니다.' })
        setTimeout(() => setSaveState('idle'), 1500)
      } catch (e) {
        // ApiError = 서버가 실제로 응답을 줬다(4xx/5xx) — 재시도해도 같은
        // 결과라 바로 실패로 확정한다. 그 외(TypeError 등)는 응답을 아예
        // 못 받은 경우라 콜드 스타트일 가능성이 있어 재시도한다.
        const isDefiniteFailure = e instanceof ApiError
        if (!isDefiniteFailure && retriesLeft > 0) {
          setSaveState('retrying')
          // 개선 로드맵 §6.3 "서버 재시도" — 버튼 라벨만으로는 버튼을 보고
          // 있지 않은 사용자가 놓친다. 재시도로 들어가는 이 순간에만
          // 토스트를 띄운다(waking/saving은 버튼 자체로 충분히 보여서
          // 매번 띄우면 성공 경로에서도 잡음이 된다).
          toast({ description: '서버를 깨우는 중입니다. 잠시 후 다시 시도합니다…' })
          recheck()
          const delay = RETRY_DELAYS_MS[MAX_SAVE_RETRIES - retriesLeft] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
          await new Promise((r) => setTimeout(r, delay))
          return attempt(retriesLeft - 1)
        }
        setSaveState('idle')
        const messages =
          e instanceof ApiError && e.issues.length > 0
            ? e.issues.map((i) => `${i.path}: ${i.message}`)
            : [e instanceof Error ? e.message : '저장에 실패했습니다.']
        setErrors(messages)
        toast({
          variant: 'destructive',
          title: '저장 실패',
          description: messages.length > 1 ? `${messages[0]} 외 ${messages.length - 1}건` : messages[0],
        })
        recheck()
      }
    }

    setSaveState(isServerUp ? 'saving' : 'waking')
    await attempt(MAX_SAVE_RETRIES)
  }

  const busy = saveState === 'waking' || saveState === 'saving' || saveState === 'retrying'
  const disabled = isCheckingAuth || !isLoggedIn || busy

  const label =
    saveState === 'waking'
      ? '서버 깨우는 중…'
      : saveState === 'saving'
        ? '저장 중…'
        : saveState === 'retrying'
          ? '재시도 중…'
          : saveState === 'done'
            ? '저장 완료'
            : isDirty
              ? '저장 *'
              : '저장'

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={handleSave}
        disabled={disabled}
        title={!isLoggedIn && !isCheckingAuth ? '로그인이 필요합니다' : undefined}
      >
        {label}
      </Button>
      {/* 개선 로드맵 §5.1 — 서버 저장(이 버튼)과 로컬 자동 백업(useDraftAutosave,
       * localStorage)은 별개다. "저장 *"만 보면 지금 편집이 안전한지 알기
       * 어려워서, 서버에 아직 안 올렸어도 이 브라우저엔 남는다는 걸
       * 명시한다 — disabled-button-visible-hint 패턴과 같은 이유로 hover
       * 툴팁이 아니라 항상 보이는 텍스트로 둔다. */}
      {isDirty && !busy && (
        <span className="text-xs text-slate-300">변경사항은 이 브라우저에 자동 백업됩니다</span>
      )}
      {/* isChecking도 같이 확인한다 — 안 그러면 마운트 직후 첫 헬스체크가
       * 아직 끝나기 전(보통 수십ms, 콜드 스타트면 더 김) 이 문구가 잠깐
       * 잘못 깜빡인다. */}
      {!isServerUp && !isChecking && !busy && (
        <span className="text-xs text-slate-300">서버가 잠들어 있을 수 있습니다 — 저장을 누르면 깨웁니다(시간이 걸릴 수 있어요)</span>
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
