import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { MANAGER_PRESETS } from '@/components/editor/ManagerPresetPicker'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { Pitch } from '@/components/pitch/Pitch'
import { PrintPlayerNode } from '@/components/pitch/PrintPlayerNode'
import { loadSampleAnalysis } from '@/lib/loadSample'
import { cn } from '@/lib/utils'
import type { Analysis } from '@/types/analysis'

// 10개 감독 프리셋(ManagerPresetPicker.tsx) 중 전술 모양이 뚜렷하게 다른
// 다섯 개만 골랐다 — 시작 화면은 "이런 것도 만들 수 있다"를 훑어보는
// 용도라 다 보여줄 필요는 없고, 서로 비슷한 4-3-3류가 연달아 나오면 변화가
// 안 느껴진다(과르디올라=인버티드 풀백, 아르테타=빌드업 백3, 클롭=게겐프레싱,
// 사비 알론소=백3+윙백, 이정효=하프스페이스 침투로 형태가 겹치지 않는다).
const SHOWCASE_URLS = [
  '/samples/managers/guardiola.json',
  '/samples/managers/arteta.json',
  '/samples/managers/klopp.json',
  '/samples/managers/xabi_alonso.json',
  '/samples/managers/lee_jeonghyo_gwangju.json',
]

const CYCLE_MS = 5000

/**
 * 시작 화면(EditorPage 빈 상태) 전용 예시 전술판 캐러셀 (TO-DO 37,
 * "formationbuilder.com/ko 시작화면처럼 예시 전술판이 애니메이션으로
 * 바뀌어가면서 몇 개씩 보여주는 예시" 요청). 감독 프리셋 다섯 개의 공격
 * 국면 스냅샷을 5초마다 하나씩 순환하며 크로스페이드로 보여준다 — 로그인
 * 여부와 무관하게 "이 앱으로 뭘 만들 수 있는지" 첫 화면에서 바로 보여주는
 * 용도라 항상 보인다.
 *
 * 마커는 `PrintPlayerNode`(GIF 내보내기 전용으로 만든 정지 노드)를 그대로
 * 재사용한다 — useAnalysisStore의 "현재 활성 분석"에 의존하지 않는 순수
 * 정적 렌더러라, 캐러셀처럼 활성 분석이 아닌 임의 데이터를 그리는 용도에
 * 정확히 들어맞는다. Pitch(잔디·라인)는 계속 마운트해두고 마커 그룹만
 * `motion.g`로 크로스페이드한다 — 매번 Pitch 전체를 다시 그리면 로딩 중
 * 빈 화면이 잠깐씩 깜빡인다.
 */
export function StartScreenPitchShowcase() {
  const [analyses, setAnalyses] = useState<(Analysis | null)[]>(() => SHOWCASE_URLS.map(() => null))
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    SHOWCASE_URLS.forEach((url, i) => {
      loadSampleAnalysis(url)
        .then((a) => {
          if (!cancelled) setAnalyses((prev) => prev.map((p, j) => (j === i ? a : p)))
        })
        .catch(() => {}) // 번들에 포함된 정적 파일이라 사실상 실패하지 않는다 — 실패해도 그 자리만 조용히 건너뛴다
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SHOWCASE_URLS.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [])

  const current = analyses[index]
  const preset = MANAGER_PRESETS.find((p) => p.url === SHOWCASE_URLS[index])

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="h-[38vh] w-full max-w-xs supports-[height:100dvh]:h-[38dvh]">
        <Pitch>
          <AnimatePresence mode="wait">
            {current && (
              <motion.g
                key={SHOWCASE_URLS[index]}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <AnnotationLayer annotations={current.phases.attack.annotations} animated={false} />
                {current.players.map((player, i) => {
                  const pos = current.phases.attack.positions.find((p) => p.playerId === player.id)
                  if (!pos) return null
                  return (
                    <PrintPlayerNode
                      key={player.id}
                      player={player}
                      position={pos}
                      formation={current.formation}
                      index={i}
                    />
                  )
                })}
              </motion.g>
            )}
          </AnimatePresence>
        </Pitch>
      </div>
      {preset && (
        <p className="text-sm font-medium text-foreground">
          {preset.manager} <span className="text-muted-foreground">· {preset.club}</span>
        </p>
      )}
      <div className="flex items-center gap-1.5">
        {SHOWCASE_URLS.map((url, i) => (
          <button
            key={url}
            type="button"
            aria-label={`${i + 1}번째 예시 보기`}
            onClick={() => setIndex(i)}
            className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === index ? 'bg-foreground' : 'bg-border')}
          />
        ))}
      </div>
    </div>
  )
}
