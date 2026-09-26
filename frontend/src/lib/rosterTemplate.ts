import { nanoid } from 'nanoid'

import type { RosterTemplatePlayer } from '@/lib/api'
import type { Analysis, Player } from '@/types/analysis'

/**
 * 저장된 선수단 템플릿을 방금 만든 빈 분석(`createEmptyAnalysis`)에 얹는다
 * (개선 로드맵 §7.2). 앞 11명은 이미 국면별 `positions`가 그 index의
 * `playerId`를 참조하고 있으므로, 좌표는 그대로 두고 이름·등번호·역할만
 * 덮어쓴다 — id 자체는 바꾸지 않는다(모핑 애니메이션의 노드 동일성 규칙,
 * 4단계 §5.1). 11명을 넘는 나머지는 벤치로 취급해 `players`에만 새 id로
 * 추가하고 어떤 국면의 `positions`에도 넣지 않는다 — 감독 프리셋의 벤치
 * 선수(b1~b5)와 같은 규칙이다.
 */
export function applyRosterTemplate(analysis: Analysis, templatePlayers: RosterTemplatePlayer[]): Analysis {
  const starters = templatePlayers.slice(0, 11)
  const bench = templatePlayers.slice(11)

  const players: Player[] = analysis.players.map((p, i) => {
    const t = starters[i]
    if (!t) return p
    return { ...p, name: t.name, number: t.number, role: t.role, tacticalRole: t.tacticalRole }
  })

  const benchPlayers: Player[] = bench.map((t) => ({
    id: nanoid(),
    name: t.name,
    number: t.number,
    role: t.role,
    tacticalRole: t.tacticalRole,
  }))

  return { ...analysis, players: [...players, ...benchPlayers] }
}
