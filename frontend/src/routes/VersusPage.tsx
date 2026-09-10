import { useState } from 'react'

import { MatchupView } from '@/components/versus/MatchupView'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAnalyses, useAnalysis } from '@/hooks/useAnalyses'
import { useServerHealth } from '@/hooks/useServerHealth'

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

  const analysisA = useAnalysis(idA ? Number(idA) : undefined)
  const analysisB = useAnalysis(idB ? Number(idB) : undefined)

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
          onClick={() => setAttacker((s) => (s === 'A' ? 'B' : 'A'))}
        >
          {attacker === 'A' ? 'A 공격 × B 수비' : 'B 공격 × A 수비'} — 교대
        </Button>
      </div>

      <div className="flex gap-2">
        {(
          [
            { key: 'channelGrid', label: '5채널', on: showChannelGrid, set: setShowChannelGrid },
            { key: 'overload', label: '오버로드', on: showOverload, set: setShowOverload },
            { key: 'pressingLine', label: '압박 라인(수비 팀)', on: showPressingLine, set: setShowPressingLine },
            { key: 'annotations', label: '이동 벡터', on: showAnnotations, set: setShowAnnotations },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => chip.set((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
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
        <div className="mx-auto h-[82vh] w-full max-w-6xl">
          <MatchupView
            analysisA={analysisA.data}
            analysisB={analysisB.data}
            attacker={attacker}
            showChannelGrid={showChannelGrid}
            showOverload={showOverload}
            showPressingLine={showPressingLine}
            showAnnotations={showAnnotations}
          />
        </div>
      )}
    </div>
  )
}
