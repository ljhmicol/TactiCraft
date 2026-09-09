import { useState } from 'react'

import { cn } from '@/lib/utils'

interface MatchPreset {
  url: string
  title: string
  matchup: string
  blurb: string
}

/**
 * 실제 경기 명장면 프리셋(TO-DO 9번) — StatsBomb OpenData(무료, GitHub 공개)의
 * 슛 프리즈프레임(그 순간 선수 실제 좌표)을 변환해 만든다. 감독 프리셋과
 * 달리 "재구성"이 아니라 실측 추적 데이터가 바탕이지만, 프리즈프레임은
 * 슛에 관여된 선수만 담아서(보통 11명 안팎, 22명 전원이 아님) 카메라에
 * 안 잡힌 나머지 선수는 그 시점 포메이션 템플릿으로 보완한다 — 이 사실은
 * 각 프리셋의 summary/comment 필드에도 명시해 둔다. 슛 장면 위주라는
 * 제약(전 경기 트래킹 아님)도 여기서 비롯된다.
 */
const MATCH_PRESETS: MatchPreset[] = [
  {
    url: '/samples/matches/dimaria-wc2022-final.json',
    title: '디마리아의 6턴 역습골 (35분)',
    matchup: '아르헨티나 vs 프랑스 · 2022 카타르 월드컵 결승',
    blurb:
      '몰리나 탈압박 → 맥 알리스터 → 메시 → 알바레스 → 맥 알리스터 원터치 연결 → 디마리아 마무리. 타임라인 6개 시점으로 패스가 이어지는 과정을 그대로 따라갈 수 있음',
  },
  {
    url: '/samples/matches/mbappe-wc2022-final.json',
    title: '음바페 동점골 (80분)',
    matchup: '아르헨티나 vs 프랑스 · 2022 카타르 월드컵 결승',
    blurb: '튀랑의 어시스트를 받은 발리 동점골(3-2 → 3-3) — 실제 추적 좌표 11명 + 포메이션 보완 11명',
  },
]

interface MatchPresetPickerProps {
  onSelect: (url: string) => void
}

export function MatchPresetPicker({ onSelect }: MatchPresetPickerProps) {
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (preset: MatchPreset) => {
    setError(null)
    setLoadingUrl(preset.url)
    try {
      await onSelect(preset.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : '프리셋을 불러오지 못했습니다.')
    } finally {
      setLoadingUrl(null)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MATCH_PRESETS.map((preset) => (
          <button
            key={preset.url}
            type="button"
            disabled={loadingUrl !== null}
            onClick={() => handleClick(preset)}
            className={cn(
              'rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent',
              loadingUrl === preset.url && 'opacity-60',
            )}
          >
            <p className="font-semibold text-foreground">{preset.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{preset.matchup}</p>
            <p className="mt-1 text-xs text-muted-foreground">{preset.blurb}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}
