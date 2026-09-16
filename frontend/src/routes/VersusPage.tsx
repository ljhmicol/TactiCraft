import { useEffect, useRef, useState } from 'react'

import { VersusShareCard } from '@/components/export/VersusShareCard'
import { MatchupView } from '@/components/versus/MatchupView'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAnalyses, useAnalysis } from '@/hooks/useAnalyses'
import { useServerHealth } from '@/hooks/useServerHealth'
import { exportCard } from '@/lib/exportImage'

// 공수 전환 자동재생(2026-09-15, "턴오버 시 자동재생 버튼") 한 사이클 길이 —
// PhaseTabs의 국면 자동재생(AUTO_PLAY_INTERVAL_MS=1800, 국면 사이 대기시간)과
// 달리 여기는 0→100을 매끄럽게 훑는 연속 애니메이션이라 "구간 대기시간"이
// 아니라 "전체 소요시간"이다 — 너무 빠르면 수적 우위 숫자가 바뀌는 걸 눈으로
// 따라가기 어렵고, 너무 느리면 지루해서 2.5초로 잡았다.
const TRANSITION_AUTO_PLAY_MS = 2500

/**
 * /versus — 저장된 전술 2개를 겹쳐서 A의 공격 국면이 B의 수비 국면을 어떻게
 * 상대하는지(또는 반대로) 비교한다. 저장/목록과 마찬가지로 백엔드 조회가
 * 필요한 기능이라 서버가 꺼져 있으면 안내만 보여준다 (TO-DO 16번).
 */
export function VersusPage() {
  const { isServerUp, isChecking } = useServerHealth()
  const { data: analyses, isLoading, isError } = useAnalyses()
  const [idA, setIdA] = useState<string>('')
  const [idB, setIdB] = useState<string>('')
  const [attacker, setAttacker] = useState<'A' | 'B'>('A')
  const [showChannelGrid, setShowChannelGrid] = useState(true)
  const [showOverload, setShowOverload] = useState(true)
  const [showPressingLine, setShowPressingLine] = useState(true)
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [showZoneNumbers, setShowZoneNumbers] = useState(true)
  // "병목" 빗금 레이어(2차 4개 개선안 3번, "국면별 텐션 시각화") — 기본
  // false다. 다른 토글은 전부 기본 true(기존 화면 유지)인데 이것만 다른
  // 이유: 이 레이어는 정보를 하나 더 얹는 것이라, 방금 "숫자 표시를
  // 줄여서 덜 복잡하게"(50-2) 만든 작업과 정반대 방향이다 — 항상 켜져
  // 있으면 그 작업이 무의미해지니 켜고 싶을 때만 켜는 옵션으로 둔다.
  const [showBottleneck, setShowBottleneck] = useState(false)
  // 공수 전환 미리보기 슬라이더(TO-DO 50번대, "국면 토글/타임라인 슬라이더"
  // 4번 개선안의 축소판) — 0~100, 0이면 지금 공수 상태 그대로다. 공수
  // 교대 버튼을 누르면(=기준 자체가 바뀌면) 0으로 되돌린다 — 안 그러면
  // "전환 50% 지점"이 버튼을 누르기 전/후에 서로 다른 걸 가리키게 된다.
  const [transitionT, setTransitionT] = useState(0)
  // 턴오버 자동재생(2026-09-15, "공수 전환 미리보기 옆에 턴오버 시
  // 자동재생 버튼을 만들어서") — PhaseTabs의 isPlaying과 같은 이름의 개념
  // (재생 중엔 수동 조작을 막는다)이지만, 3국면을 순서대로 도는 게 아니라
  // 0→100을 한 번 훑고 스스로 멈춘다("턴오버가 일어나면"은 한 번 일어나는
  // 사건이지 반복 재생할 상황이 아니다).
  const [autoPlaying, setAutoPlaying] = useState(false)
  const [exportRatio, setExportRatio] = useState<'1:1' | '4:5'>('1:1')
  const [exporting, setExporting] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const analysisA = useAnalysis(idA ? Number(idA) : undefined)
  const analysisB = useAnalysis(idB ? Number(idB) : undefined)

  const handleExport = async () => {
    if (!cardRef.current) return
    setExporting(true)
    try {
      await exportCard(cardRef.current, exportRatio)
    } finally {
      setExporting(false)
    }
  }

  // requestAnimationFrame으로 transitionT를 0→100까지 매끄럽게 올린다.
  // autoPlaying이 true가 될 때만 시작하고, 100에 닿으면 스스로 꺼서(다음
  // 클릭까지) 반복 재생하지 않는다. 사용자가 슬라이더를 직접 드래그하면
  // (아래 onChange) autoPlaying을 false로 꺼서 이 루프와 충돌하지 않게 한다.
  useEffect(() => {
    if (!autoPlaying) return
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const elapsed = now - start
      const t = Math.min(100, Math.round((elapsed / TRANSITION_AUTO_PLAY_MS) * 100))
      setTransitionT(t)
      if (t >= 100) {
        setAutoPlaying(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [autoPlaying])

  if (isChecking) return <p className="p-6 text-muted-foreground">서버 확인 중…</p>

  if (!isServerUp) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-2xl font-semibold text-foreground">전술 대결</h1>
        <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
          백엔드 서버가 꺼져 있어 저장된 분석을 불러올 수 없습니다.
          <br />
          <code className="text-xs">uvicorn main:app --reload</code>로 서버를 켠 뒤 새로고침하세요.
        </div>
      </div>
    )
  }

  if (isLoading) return <p className="p-6 text-muted-foreground">불러오는 중…</p>
  if (isError) return <p className="p-6 text-destructive">목록을 불러오지 못했습니다.</p>
  if (!analyses || analyses.length < 2) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-2xl font-semibold text-foreground">전술 대결</h1>
        <p className="text-sm text-muted-foreground">
          대결시키려면 저장된 분석이 2개 이상 필요합니다. 현재 {analyses?.length ?? 0}개 저장됨.
        </p>
      </div>
    )
  }

  const label = (a: (typeof analyses)[number]) => a.matchName || `${a.homeTeam} vs ${a.awayTeam}`

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">전술 대결</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">전술 A (채움)</label>
          <Select value={idA} onValueChange={setIdA}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="분석 선택" />
            </SelectTrigger>
            <SelectContent>
              {analyses.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {label(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">전술 B (테두리)</label>
          <Select value={idB} onValueChange={setIdB}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="분석 선택" />
            </SelectTrigger>
            <SelectContent>
              {analyses.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {label(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={!idA || !idB}
          onClick={() => {
            setAttacker((s) => (s === 'A' ? 'B' : 'A'))
            setTransitionT(0)
            setAutoPlaying(false)
          }}
        >
          {attacker === 'A' ? 'A 공격 × B 수비' : 'B 공격 × A 수비'} — 교대
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'channelGrid', label: '5채널', on: showChannelGrid, set: setShowChannelGrid, disabled: false },
            { key: 'overload', label: '오버로드', on: showOverload, set: setShowOverload, disabled: false },
            // 피치 위 "N:M" 숫자만 끄는 토글(TO-DO 50-2, "피치 내부 시각적
            // 복잡도" 피드백) — 오버로드 레이어 자체가 꺼져 있으면 무의미하니
            // 그때는 비활성화한다. 호버 방식 대신 토글을 고른 이유는
            // CLAUDE.md에 남은 실기기(iOS Safari/Android Chrome) 미검증
            // 메모 — 터치 기기엔 hover가 없다.
            {
              key: 'zoneNumbers',
              label: '구역 수치',
              on: showZoneNumbers,
              set: setShowZoneNumbers,
              disabled: !showOverload,
            },
            // "국면별 텐션 시각화"(2차 4개 개선안 3번) — 어느 팀이 우세한지가
            // 아니라 두 포메이션이 겹쳐서 밀집되는 구역을 빗금으로 보여준다.
            // 기본 Off — 위 "구역 수치"와 반대로, 정보를 하나 더 얹는
            // 레이어라 원할 때만 켠다.
            {
              key: 'bottleneck',
              label: '밀집 구역(병목)',
              on: showBottleneck,
              set: setShowBottleneck,
              disabled: !showOverload,
            },
            { key: 'pressingLine', label: '압박 라인(수비 팀)', on: showPressingLine, set: setShowPressingLine, disabled: false },
            { key: 'annotations', label: '이동 벡터', on: showAnnotations, set: setShowAnnotations, disabled: false },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            disabled={chip.disabled}
            onClick={() => chip.set((v) => !v)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 ${
              chip.on ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {!idA || !idB ? (
        <p className="text-sm text-muted-foreground">두 전술을 모두 선택하세요.</p>
      ) : analysisA.isLoading || analysisB.isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : analysisA.isError || analysisB.isError || !analysisA.data || !analysisB.data ? (
        <p className="text-sm text-destructive">분석을 불러오지 못했습니다.</p>
      ) : (
        <>
          {/* 전술 대결 결과 PNG 내보내기(TO-DO 41) — 에디터는 PNG/GIF 내보내기가
           * 있는데 /versus에는 전혀 없었다("더 추가할 기능들은 없을지" 요청에서
           * 가장 확실한 공백으로 골라 먼저 구현). ExportControls(에디터)와 같은
           * exportCard/ratio 패턴을 그대로 재사용한다. */}
          <div className="flex items-center gap-2">
            <Select value={exportRatio} onValueChange={(v) => setExportRatio(v as '1:1' | '4:5')}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1:1</SelectItem>
                <SelectItem value="4:5">4:5</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? '내보내는 중…' : 'PNG 내보내기'}
            </Button>
          </div>

          {/* 공수 전환 미리보기(TO-DO 50번대) — "국면을 시간 흐름으로 쪼개 보고
              싶다"는 요청의 축소판이다. 새 스냅샷("빌드업 시" 등)을 만드는 대신
              이미 있는 공격↔수비 두 국면을 선형 보간해서, 턴오버가 일어나
              반대 국면으로 바뀌는 순간 15구역 수적 우위가 어떻게 움직이는지
              미리 본다. 선수 위치·구역 우위(아래 카드들)만 실시간으로 바뀌고,
              압박 라인·이동 벡터는 숨겨지며, 전술 개선방안·고립 매치업·
              키포인트는 0% 상태(지금 공수 상태) 기준으로 고정된다 — 사용자가
              슬라이더로 만들어낸 가상의 배치에 대해 "이 선수를 여기로
              재배치하라"는 식의 조언을 만들어내면 안 되기 때문이다(가짜 예측
              금지 원칙과 같은 이유).
              위치·너비(2026-09-15, "png내보내기 아래, 수적우위 바로 위에
              두자. 길이를 수적우위랑 같게") — PNG 내보내기 바로 아래,
              MatchupView가 그리는 "N구역 수적 우위" 카드 바로 위로 옮기고,
              그 카드와 같은 폭(MatchupView.tsx의 max-w-6xl 래퍼와 동일)으로
              맞췄다. 글자 크기(2026-09-15, "콘텐츠 글씨들을 조금만
              키워줘")도 버튼·라벨과 같이 한 단계씩 키웠다. */}
          <div className="mx-auto w-full max-w-6xl space-y-1 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                공수 전환 미리보기
                {/* 턴오버 자동재생(2026-09-15, "공수 전환 미리보기 옆에
                    턴오버 시 자동재생 버튼을 만들어서") — PhaseTabs의
                    "▶ 자동재생/⏸ 정지" 버튼과 같은 표기·색 관례를 그대로
                    따랐다(같은 뜻의 컨트롤이 화면마다 다르게 보이면 안 되니까). */}
                <button
                  type="button"
                  onClick={() => {
                    if (autoPlaying) {
                      setAutoPlaying(false)
                    } else {
                      setTransitionT(0)
                      setAutoPlaying(true)
                    }
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    autoPlaying ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {autoPlaying ? '⏸ 정지' : '▶ 턴오버 자동재생'}
                </button>
              </span>
              <span className="tabular-nums">{transitionT}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={transitionT}
              disabled={autoPlaying}
              onChange={(e) => {
                setAutoPlaying(false)
                setTransitionT(Number(e.target.value))
              }}
              className="w-full accent-primary disabled:opacity-60"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{attacker === 'A' ? 'A 공격 × B 수비' : 'B 공격 × A 수비'} (0%)</span>
              <span>{attacker === 'A' ? 'B 공격 × A 수비' : 'A 공격 × B 수비'} (100%)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              선수 위치·구역 수적 우위만 실시간 반영됩니다 — 전환 중엔 압박 라인·이동 벡터가 숨겨지고, 전술 개선방안·고립
              매치업·키포인트는 0% 상태 기준으로 고정됩니다.
            </p>
          </div>

          {/* EditorPage와 같은 이유(2026-09-11)로 dvh 폴백 — 모바일 실기기에서만
              주소창 때문에 vh가 잘못 계산되는 문제 대응.
              높이 82vh→90vh→94vh→97vh→99vh, max-w-6xl→max-w-7xl→
              max-w-[1800px]→max-w-[2000px]→max-w-[2200px](2026-09-15,
              "전술판이 너무 작아"류 요청이 네 차례째) — Pitch(landscape)는
              aspect-[105/68] h-full로 높이 기준 너비를 계산한다(Pitch.tsx 주석
              참조). 99vh는 100vh 바로 아래 — 뷰포트 안 스크롤바·브라우저
              크롬과 겹쳐 세로 스크롤이 생기는 걸 피하려고 100vh 자체는 안
              쓴다(모바일 dvh 폴백과 같은 종류의 여유분). 텍스트 패널은 위
              (공수 전환 슬라이더)·MatchupView 안(AdvantageBadge 등)에서
              각자 max-w-6xl로 따로 고정돼 있어서, 이 박스를 더 키워도
              커지는 건 피치뿐이다. */}
          <div className="mx-auto h-[99vh] w-full max-w-[2200px] supports-[height:100dvh]:h-[99dvh]">
            <MatchupView
              analysisA={analysisA.data}
              analysisB={analysisB.data}
              attacker={attacker}
              showChannelGrid={showChannelGrid}
              showOverload={showOverload}
              showPressingLine={showPressingLine}
              showAnnotations={showAnnotations}
              showZoneNumbers={showZoneNumbers}
              showBottleneck={showBottleneck}
              transitionT={transitionT}
            />
          </div>
          {/* VersusShareCard(PNG 카드)엔 transitionT를 안 넘긴다 — 슬라이더로
              스크러빙 중인 상태는 탐색용 미리보기지 "저장할 요약"이 아니다
              (TacticalSuggestions를 카드에서 뺀 41번, 애니메이션을 끈 48/49번과
              같은 "카드는 고정 요약" 원칙). 카드는 항상 0%(지금 공수 상태)로
              내보낸다. */}
          <VersusShareCard
            ref={cardRef}
            analysisA={analysisA.data}
            analysisB={analysisB.data}
            attacker={attacker}
            showChannelGrid={showChannelGrid}
            showOverload={showOverload}
            showPressingLine={showPressingLine}
            showAnnotations={showAnnotations}
            showZoneNumbers={showZoneNumbers}
            showBottleneck={showBottleneck}
            ratio={exportRatio}
          />
        </>
      )}
    </div>
  )
}
