import { useNavigate } from 'react-router-dom'

import { FormationPicker } from '@/components/editor/FormationPicker'
import { ManagerPresetPicker } from '@/components/editor/ManagerPresetPicker'
import { MatchPresetPicker } from '@/components/editor/MatchPresetPicker'
import { loadSampleAnalysis } from '@/lib/loadSample'
import { createEmptyAnalysis, useAnalysisStore } from '@/store/analysisStore'

/**
 * 시작 화면 전용 장식 배경(2026-09-11 사용자 요청 — "검은 배경에 흰 줄로 축구
 * 그라운드처럼"). `lib/theme.ts`의 `PITCH_COLORS`(실제 전술 피치, 초록·데이터)와는
 * 완전히 별개다 — 이건 좌표 데이터를 그리는 게 아니라 시작 화면 한 곳에만 쓰는
 * 순수 장식용 SVG라 피치 색 상수를 건드리지 않고 여기 로컬로 둔다. 정식 규격
 * 105×68m 축구장 비율을 viewBox로 그대로 써서(터치라인·하프라인·센터서클·
 * 페널티 박스·골에어리어·페널티 아크) 실루엣만으로 "축구장"이 읽히게 하되,
 * 흰 선을 10% 불투명도로 눌러서 본문 텍스트 대비를 해치지 않는다.
 * `-z-10` fixed로 스크롤해도 고정 — 애니메이션 없음(모션 절제 원칙 유지).
 */
function PitchFieldBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      viewBox="0 0 105 68"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="white"
      strokeOpacity={0.1}
      strokeWidth={0.3}
    >
      {/* 터치라인·골라인 */}
      <rect x={0.5} y={0.5} width={104} height={67} />
      {/* 하프라인 */}
      <line x1={52.5} y1={0.5} x2={52.5} y2={67.5} />
      {/* 센터서클·센터스팟 */}
      <circle cx={52.5} cy={34} r={9.15} />
      <circle cx={52.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      {/* 왼쪽 페널티 박스·골에어리어·스팟·아크 */}
      <rect x={0.5} y={13.84} width={16} height={40.32} />
      <rect x={0.5} y={24.84} width={5} height={18.32} />
      <circle cx={11.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      <path d="M16.5 26.34 A9.15 9.15 0 0 1 16.5 41.66" />
      {/* 오른쪽 페널티 박스·골에어리어·스팟·아크(왼쪽 대칭) */}
      <rect x={88.5} y={13.84} width={16} height={40.32} />
      <rect x={99.5} y={24.84} width={5} height={18.32} />
      <circle cx={93.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      <path d="M88.5 26.34 A9.15 9.15 0 0 0 88.5 41.66" />
    </svg>
  )
}

/** /new — 포메이션 프리셋·감독 스타일 프리셋·실제 경기 명장면(TO-DO 9번) 선택 → / 로 이동 (2단계 §11.3). */
export function NewAnalysisPage() {
  const navigate = useNavigate()
  const loadAnalysis = useAnalysisStore((s) => s.loadAnalysis)

  const handleSelectFormation = (formation: string) => {
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
