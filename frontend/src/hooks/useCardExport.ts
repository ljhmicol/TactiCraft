import { useRef, useState } from 'react'

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
      await exportCard(cardRef.current, ratio)
    } finally {
      setExporting(false)
    }
  }

  return { ratio, setRatio, exporting, handleExport, cardRef }
}
