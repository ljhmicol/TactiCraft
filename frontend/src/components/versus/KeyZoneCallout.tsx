import { InfoDialogButton } from '@/components/versus/InfoDialogButton'
import { playersInZone, type ZonePlayer } from '@/lib/matchup'
import { VERSUS_TEAM_COLORS } from '@/lib/theme'
import { THIRD_KOREAN, type MatchupAdvantage, zoneLabel } from '@/lib/versusAdvantage'
import type { Analysis, PhaseData, PlayerPosition, ZoneOverload } from '@/types/analysis'

interface KeyZoneCalloutProps {
  advantage: MatchupAdvantage
  labelA: string
  labelB: string
  analysisA: Analysis
  analysisB: Analysis
  dataA: PhaseData
  positionsB: PlayerPosition[]
}

function playerListText(players: ZonePlayer[]): string {
  if (players.length === 0) return '(지금 배치엔 이 구역에 선 선수가 없습니다 — 국면을 바꾸는 사이일 수 있어요)'
  return players.map((zp) => `${zp.line} ${zp.player.name}`).join(', ')
}

/**
 * "키포인트 포지션"(TO-DO 38 후속) — `AdvantageBadge`가 이미 우세 구역을
 * |diff| 내림차순으로 나열하고 있어서(맨 위가 사실상 핵심 구역이다), 새로
 * 계산하지 않고 그 목록의 1등(`aTopZone`/`bTopZone`)만 따로 뽑아 더 눈에
 * 띄게 보여준다 — 문장 속에 묻혀 있던 "가장 격차 큰 구역"을 배지 형태로
 * 꺼내는 것뿐이라 AdvantageBadge와 다른 사실을 주장하지 않는다.
 *
 * 안내 버튼(TO-DO 46, "키포인트 포지션에도 버튼을 만들어서... 지금
 * 현재로는 이 선수가 있다") — 이 구역이 왜 키포인트인지 설명하고, 지금
 * 이 구역에 실제로 서 있는 선수를 알려준다. `playersInZone`이
 * `computeOverload`와 같은 경계 판정·GK 제외를 쓰기 때문에 여기 나열되는
 * 인원수는 항상 배지의 own 숫자와 일치한다. 이 텍스트는 저장되는 댓글이
 * 아니라 렌더링할 때마다 현재 좌표로 새로 계산하는 값이다 — 국면을
 * 바꾸거나 다른 분석을 고르면 그때그때 다시 계산돼서 바뀐다.
 */
export function KeyZoneCallout({ advantage, labelA, labelB, analysisA, analysisB, dataA, positionsB }: KeyZoneCalloutProps) {
  const { aTopZone, bTopZone } = advantage
  if (!aTopZone && !bTopZone) return null
  const third = THIRD_KOREAN(labelA, labelB)

  const explain = (zone: ZoneOverload, label: string, opponentLabel: string, players: ZonePlayer[]) => (
    <>
      <p>
        15구역(5채널×3서드) 중 {label}와(과) {opponentLabel}의 수적 차이가 가장 크게 벌어진 구역입니다 —{' '}
        {zoneLabel(zone, third)}.
      </p>
      <p>
        지금 이 구역에 있는 {label} 선수: {playerListText(players)}
      </p>
    </>
  )

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {aTopZone && (
        <span
          className="flex items-center gap-1 rounded-full border px-3 py-1 font-medium"
          style={{ borderColor: `${VERSUS_TEAM_COLORS.A.fill}66`, background: `${VERSUS_TEAM_COLORS.A.fill}1a`, color: VERSUS_TEAM_COLORS.A.fill }}
        >
          ★ {labelA} 키포인트: {zoneLabel(aTopZone, third)}
          <InfoDialogButton title={`${labelA} 키포인트 구역`} ariaLabel={`${labelA} 키포인트 구역 설명 보기`} color={VERSUS_TEAM_COLORS.A.fill}>
            {explain(aTopZone, labelA, labelB, playersInZone(dataA.positions, analysisA.players, analysisA.formation, aTopZone.channel, aTopZone.third))}
          </InfoDialogButton>
        </span>
      )}
      {bTopZone && (
        <span
          className="flex items-center gap-1 rounded-full border px-3 py-1 font-medium"
          style={{ borderColor: `${VERSUS_TEAM_COLORS.B.fill}66`, background: `${VERSUS_TEAM_COLORS.B.fill}1a`, color: VERSUS_TEAM_COLORS.B.fill }}
        >
          ★ {labelB} 키포인트: {zoneLabel(bTopZone, third)}
          <InfoDialogButton title={`${labelB} 키포인트 구역`} ariaLabel={`${labelB} 키포인트 구역 설명 보기`} color={VERSUS_TEAM_COLORS.B.fill}>
            {explain(bTopZone, labelB, labelA, playersInZone(positionsB, analysisB.players, analysisB.formation, bTopZone.channel, bTopZone.third))}
          </InfoDialogButton>
        </span>
      )}
    </div>
  )
}
