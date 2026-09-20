import { useRef, useState } from 'react'

import { toast } from '@/hooks/use-toast'
import { exportCard } from '@/lib/exportImage'

export type CardRatio = '1:1' | '4:5'

/**
 * PNG 카드 내보내기 상태 한 벌(비율·캡처 대상 ref·진행 상태) — 개선
 * 로드맵 §6.2(2026-09-20)로 모바일 하단 액션 바(BottomActionBar)도 실제로
 * PNG를 생성해야 하게 되면서 `EditorPage`가 이 훅을 한 번만 호출해 데스크톱
 * 툴바(ExportControls)와 모바일 시트 양쪽에 내려준다.
 *
 * ExportControls의 기존 주석대로, 캡처 대상 `ShareCard`(off-screen 카드)는
 * 한 번만 마운트돼야 한다 — 상태를 여기로 끌어올리기 전엔 ExportControls가
 * 혼자 갖고 있어서 모바일 쪽은 버튼을 눌러도 같은 카드를 캡처할 방법이
 * 없었고(그래서 예전엔 툴바로 스크롤만 시켰다), 이제는 `cardRef`까지 같이
 * 내려주므로 `ShareCard`는 여전히 ExportControls 한 곳에만 마운트하면서도
 * 모바일 시트가 같은 캡처를 트리거할 수 있다.
 */
export function useCardExport() {
  const [ratio, setRatio] = useState<CardRatio>('1:1')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleExport = async () => {
    if (!cardRef.current) return
    setExporting(true)
    try {
      // 실패를 여기서 삼키고 토스트로 원인을 보여준다(2026-09-20, "다운로드
      // 자체가 안 된다" 재발 대응) — 예전엔 그대로 던져서 ExportControls
      // (데스크톱 툴바)의 onClick={onExport}가 catch 없이 그냥 실패하면
      // unhandled rejection만 남고 화면엔 아무 표시도 없었다. 실기기
      // Safari는 콘솔을 볼 수 없으니 에러 메시지 자체가 유일한 진단 수단이다.
      const blob = await exportCard(cardRef.current, ratio)
      toast({ description: `PNG 생성 완료 (${Math.round(blob.size / 1024)}KB)` })
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      toast({ variant: 'destructive', description: `PNG 내보내기에 실패했습니다. ${detail}` })
    } finally {
      setExporting(false)
    }
  }

  return { ratio, setRatio, exporting, handleExport, cardRef }
}
