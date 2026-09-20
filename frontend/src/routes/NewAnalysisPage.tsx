import { useNavigate } from 'react-router-dom'

import { PitchFieldBackdrop } from '@/components/decor/PitchFieldBackdrop'
import { FormationPicker } from '@/components/editor/FormationPicker'
import { ManagerPresetPicker } from '@/components/editor/ManagerPresetPicker'
import { MatchPresetPicker } from '@/components/editor/MatchPresetPicker'
import { loadSampleAnalysis } from '@/lib/loadSample'
import { createEmptyAnalysis, useAnalysisStore } from '@/store/analysisStore'

/** /new — 포메이션 프리셋·감독 스타일 프리셋·실제 경기 명장면(TO-DO 9번) 선택 → / 로 이동 (2단계 §11.3). */
export function NewAnalysisPage() {
  const navigate = useNavigate()
  const loadAnalysis = useAnalysisStore((s) => s.loadAnalysis)
  const isDirty = useAnalysisStore((s) => s.isDirty)

  // 개선 로드맵 §5.1 — "/new" 자체를 둘러보는 건 안전하지만(스토어를 아직
  // 안 건드림), 여기서 실제로 프리셋을 골라 loadAnalysis를 호출하는 순간
  // 지금 에디터에 있던 미저장 변경이 조용히 덮어써진다. GuardedLink처럼
  // 목적지 링크가 아니라 "선택" 동작 자체를 확인 시점으로 삼는다.
  const confirmDiscardIfDirty = () =>
    !isDirty || window.confirm('저장하지 않은 변경사항이 있습니다. 새 분석을 시작하면 사라집니다. 계속할까요?')

  const handleSelectFormation = (formation: string) => {
    if (!confirmDiscardIfDirty()) return
    const analysis = createEmptyAnalysis(formation, {
      matchName: '',
      homeTeam: '',
      awayTeam: '',
      matchDate: new Date().toISOString().slice(0, 10),
      analyzedTeam: 'home',
    })
    loadAnalysis(analysis)
    navigate('/')
  }

  // 감독 프리셋과 실제 경기 프리셋 둘 다 형태(analysisSchema 통과하는 JSON URL)가
  // 같아서 로더 함수를 그대로 공유한다.
  const handleSelectPreset = async (url: string) => {
    if (!confirmDiscardIfDirty()) return
    const analysis = await loadSampleAnalysis(url)
    loadAnalysis(analysis)
    navigate('/')
  }

  return (
    <div className="relative">
      <PitchFieldBackdrop />
      <div className="relative mx-auto max-w-3xl px-6 py-16">
        <section className="mb-12">
          <h1 className="mb-2 text-2xl font-semibold text-foreground">감독 스타일로 시작하기</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            실제 감독들의 대표 전술을 국면(기본/공격/수비)별로 재현한 예시입니다. 그대로 둘러보거나 드래그해서 직접
            바꿔볼 수 있습니다.
          </p>
          <ManagerPresetPicker onSelect={handleSelectPreset} />
        </section>

        <section className="mb-12">
          <h2 className="mb-2 text-lg font-semibold text-foreground">실제 경기 명장면으로 시작하기</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            StatsBomb 오픈 데이터(무료 공개)의 실제 선수 추적 좌표를 바탕으로 재현한 장면입니다. 슛에 관여된 선수는
            그 순간의 실제 위치, 나머지는 당시 확인된 포메이션으로 보완했습니다.
          </p>
          <MatchPresetPicker onSelect={handleSelectPreset} />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">빈 포메이션으로 시작하기</h2>
          <p className="mb-6 text-sm text-muted-foreground">기본 대형을 고르면 빈 편집 화면으로 이동합니다.</p>
          <FormationPicker onSelect={handleSelectFormation} />
        </section>
      </div>
    </div>
  )
}
