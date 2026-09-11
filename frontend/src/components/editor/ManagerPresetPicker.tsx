import { useState } from 'react'

import { cn } from '@/lib/utils'

interface ManagerPreset {
  url: string
  manager: string
  club: string
  blurb: string
}

/**
 * 스타일이 뚜렷한 감독들의 실제 전술을 국면별로 재현한 프리셋. 클롭은
 * 2025년부터 현장을 떠나 리버풀 시절 스타일로, 이정효는 광주·수원 두 시절
 * 모두 넣었다. 무리뉴·안첼로티·투헬은 2026-09-07 기준 조사로 각각 레알
 * 마드리드·브라질·잉글랜드 대표팀 부임 이후 전술을 담았다. 좌표는 실제 선수
 * 트래킹 데이터가 아니라 공개된 전술 분석을 바탕으로 재구성한 예시다.
 */
const MANAGER_PRESETS: ManagerPreset[] = [
  {
    url: '/samples/managers/guardiola.json',
    manager: '펩 과르디올라',
    club: '맨체스터 시티',
    blurb: '인버티드 풀백으로 중원 수적 우위, 비보유 시 4-1-4-1',
  },
  {
    url: '/samples/managers/arteta.json',
    manager: '미켈 아르테타',
    club: '아스널',
    blurb: '빌드업 시 백3 전환, 볼 소실 즉시 재압박',
  },
  {
    url: '/samples/managers/klopp.json',
    manager: '위르겐 클롭',
    club: '리버풀 (레전드 스타일)',
    blurb: '게겐프레싱과 헤비메탈 축구, 극단적으로 높은 라인',
  },
  {
    url: '/samples/managers/xabi_alonso.json',
    manager: '사비 알론소',
    club: '바이어 레버쿠젠 (무패 우승 시절)',
    blurb: '백3+윙백, 공격 시 3-2-5·수비 시 백5',
  },
  {
    url: '/samples/managers/luis_enrique.json',
    manager: '루이스 엔리케',
    club: '파리 생제르맹',
    blurb: '양쪽 풀백이 윙어처럼 전진하는 3-2-5 공격진',
  },
  {
    url: '/samples/managers/lee_jeonghyo_gwangju.json',
    manager: '이정효',
    club: '광주FC 시절',
    blurb: '하프스페이스 침투 + 측면 유도 압박 (K리그1 승격·3위)',
  },
  {
    url: '/samples/managers/lee_jeonghyo_suwon.json',
    manager: '이정효',
    club: '수원삼성 2026, K리그2',
    blurb: '4-4-2 기반, 중앙 미드필더가 내려와 3백 빌드업',
  },
  {
    url: '/samples/managers/mourinho.json',
    manager: '조제 무리뉴',
    club: '레알 마드리드 2026',
    blurb: '비대칭 풀백(좌 수비 전념·우 인버트) + 실용적 반격 축구',
  },
  {
    url: '/samples/managers/ancelotti.json',
    manager: '카를로 안첼로티',
    club: '브라질 대표팀',
    blurb: '가짜 9번 연계 + 조직적 실점 최소화, 즉시 수직 전개 역습',
  },
  {
    url: '/samples/managers/tuchel.json',
    manager: '토마스 투헬',
    club: '잉글랜드 대표팀',
    blurb: '공격 시 풀백 인버트로 3-2-5, 비보유 시 4-4-2 압박 블록',
  },
]

interface ManagerPresetPickerProps {
  onSelect: (url: string) => void
}

export function ManagerPresetPicker({ onSelect }: ManagerPresetPickerProps) {
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (preset: ManagerPreset) => {
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
      {/* Hallmark 감사의 minor 지적(2026-09-11) — 프리셋 고르기 3곳이 전부
       * 똑같은 테두리 카드 그리드였다. 여기는 10개짜리 텍스트 전용 목록이라
       * "훑어보기"에 맞는 조밀한 리스트로 바꿨다 — 카드 상자 대신 hairline
       * 구분선, 번호는 tabular-nums로 정렬해 스캔하기 쉽게 한다. 썸네일이
       * 있는 커뮤니티(그리드 유지)·2개뿐인 실제 경기 프리셋(큰 카드)과
       * 형태 자체가 다르다. */}
      <div className="divide-y divide-border rounded-lg border border-border">
        {MANAGER_PRESETS.map((preset, i) => (
          <button
            key={preset.url}
            type="button"
            disabled={loadingUrl !== null}
            onClick={() => handleClick(preset)}
            className={cn(
              'flex w-full items-baseline gap-3 px-4 py-3 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent',
              loadingUrl === preset.url && 'opacity-60',
            )}
          >
            <span className="w-6 shrink-0 font-display text-xs tabular-nums text-muted-foreground">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-foreground">
                {preset.manager} <span className="font-normal text-muted-foreground">· {preset.club}</span>
              </span>
              <span className="block text-xs text-muted-foreground">{preset.blurb}</span>
            </span>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}
