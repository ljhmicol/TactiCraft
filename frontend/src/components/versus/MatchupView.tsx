import { useEffect, useMemo, useState } from 'react'

import { AdvantageBadge } from '@/components/versus/AdvantageBadge'
import { KeyZoneCallout } from '@/components/versus/KeyZoneCallout'
import { MatchupBottleneckLayer } from '@/components/versus/MatchupBottleneckLayer'
import { MatchupOverloadLayer } from '@/components/versus/MatchupOverloadLayer'
import { TacticalSuggestions } from '@/components/versus/TacticalSuggestions'
import { TiltGauge } from '@/components/versus/TiltGauge'
import { ZoneSideGauges } from '@/components/versus/ZoneSideGauges'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { StaticPlayerNode } from '@/components/pitch/StaticPlayerNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import {
  buildMatchupMarkers,
  computeMatchupData,
  computeMatchupLabelOffsets,
  computeTiltIndex,
  computeTransitionPositions,
  computeZonesFromPositions,
  transformAnnotationsForMatchup,
  VERSUS_BALL_DURATION_SCALE,
  type MatchupHighlight,
} from '@/lib/matchup'
import type { Analysis, Channel, Point, Third } from '@/types/analysis'

interface MatchupViewProps {
  analysisA: Analysis
  analysisB: Analysis
  /** 어느 쪽이 공격 국면인지 — 나머지 한쪽은 자동으로 수비 국면이 된다 */
  attacker: 'A' | 'B'
  showChannelGrid: boolean
  showOverload: boolean
  showPressingLine: boolean
  showAnnotations: boolean
  /** 구역 수치("N:M") On/Off (TO-DO 50-2) — 색 타일은 showOverload가 계속 맡는다 */
  showZoneNumbers: boolean
  /** "병목" 빗금 레이어 On/Off(2차 4개 개선안 3번, "국면별 텐션 시각화") —
   * 기본 Off. showOverload가 꺼져 있으면 이 레이어도 그리지 않는다. */
  showBottleneck: boolean
  /** 공수 전환 미리보기 슬라이더 값(TO-DO 50번대, 0~100) — 0이면 지금 화면
   * (기존 동작)과 완전히 같다. 0보다 크면 두 팀이 각자 반대 방향으로
   * (A는 attack→defense, B는 defense→attack) 보간된 좌표를 보여준다. */
  transitionT: number
}

/**
 * 두 분석을 한 피치에 겹친다. A는 저장된 좌표 그대로(자팀 골 y=100), B는
 * 180도 회전(lib/coords.mirrorPoint)해서 B의 골문이 A가 공격하는 방향
 * (y=0)에 오도록 맞춘다 — 그래야 "A 공격이 B 수비를 어떻게 깨는지"가
 * 실제 마주 선 두 팀처럼 겹쳐 보인다. y만 뒤집으면 좌우 플랭크가 실제와
 * 반대로 그려지므로 x도 함께 뒤집는다.
 */
export function MatchupView({
  analysisA,
  analysisB,
  attacker,
  showChannelGrid,
  showOverload,
  showPressingLine,
  showAnnotations,
  showZoneNumbers,
  showBottleneck,
  transitionT,
}: MatchupViewProps) {
  // computeMatchupData/buildMatchupMarkers를 useMemo로 감싼다(TO-DO 48) —
  // 감싸지 않으면 "5채널"·"오버로드" 같은 무관한 토글을 눌러 MatchupView가
  // 재렌더링될 때마다 markers·runPoints가 새 배열 참조로 다시 만들어져서,
  // StaticPlayerNode의 run 반복 루프가 그때마다 리셋돼 "계속 움직인다"는
  // 요청과 반대로 자꾸 끊겨 보인다. analysisA/analysisB/attacker가 실제로
  // 안 바뀌면 같은 참조를 유지해 애니메이션이 끊기지 않게 한다.
  const {
    phaseA,
    phaseB,
    dataA,
    dataB,
    positionsB,
    labelA,
    labelB,
    zones,
    matchupAdvantage,
    defendingPositions,
    defendingPressingLineY,
    defendingPressingLineLevel,
  } = useMemo(() => computeMatchupData(analysisA, analysisB, attacker), [analysisA, analysisB, attacker])

  // 마커는 겹치면 그냥 겹치는 채로 둔다(2026-09-09 사용자 결정 — 스파이더파이어
  // 대신 예전처럼). 이름표만 겹치지 않게 위아래로 나눈다(TO-DO 28, 1번).
  const markers = useMemo(
    () => buildMatchupMarkers(analysisA, analysisB, dataA, dataB, positionsB),
    [analysisA, analysisB, dataA, dataB, positionsB],
  )
  const labelOffsets = useMemo(() => computeMatchupLabelOffsets(markers), [markers])

  // 공수 전환 미리보기(TO-DO 50번대, 4번 개선안 축소판) — transitionT===0이면
  // null을 돌려주고, 아래에서 이 null을 "보간 없음"으로 취급해 기존
  // dataA.positions/positionsB/zones/matchupAdvantage를 그대로 쓴다(advisor
  // 조언 — 쉬는 상태는 별도 계산이 아니라 완전히 같은 코드 경로여야 한다).
  // 참조 안정성(TO-DO 48)을 지키려고 `markers` 자체는 절대 다시 안 만들고,
  // 렌더링 시점에만 marker.key로 보간된 좌표를 찾아 덮어쓴다.
  const transitionPositions = useMemo(
    () => (transitionT === 0 ? null : computeTransitionPositions(analysisA, analysisB, phaseA, dataA, positionsB, transitionT / 100)),
    [analysisA, analysisB, phaseA, dataA, positionsB, transitionT],
  )
  const transitionPositionByKey = useMemo(() => {
    if (!transitionPositions) return null
    const map = new Map<string, Point>()
    for (const p of transitionPositions.aPositions) map.set(`a-${p.playerId}`, p)
    for (const p of transitionPositions.bPositions) map.set(`b-${p.playerId}`, p)
    return map
  }, [transitionPositions])
  // 화면 카드(AdvantageBadge·ZoneSideGauges)와 피치 타일은 "지금 이 좌표에
  // 몇 명이 서 있는지"라는 사실이라 전환 중에도 실시간으로 바뀌어도 된다.
  // 반면 KeyZoneCallout·TacticalSuggestions는 특정 선수 이름을 짚어 조언하는
  // 문장이라(advisor 지적 — "사용자가 드래그로 만든 대형에 대한 코칭 조언"은
  // 가짜 예측 금지 원칙에 가깝다) 항상 쉬는 상태(zones/matchupAdvantage)만
  // 쓴다 — 아래에서 이 둘을 분리해서 각각 다른 컴포넌트에 넘긴다.
  const liveZones = useMemo(
    () =>
      transitionPositions
        ? computeZonesFromPositions(transitionPositions.aPositions, analysisA, transitionPositions.bPositions, analysisB)
        : zones,
    [transitionPositions, zones, analysisA, analysisB],
  )
  // 무게중심/쏠림 지수(versus-stat-features-backlog 3번)도 zones와 같은
  // 분류(이름을 안 짚는 순수 좌표 평균)라 전환 중에도 실시간으로 바뀐다.
  const liveTilt = useMemo(
    () =>
      transitionPositions
        ? computeTiltIndex(transitionPositions.aPositions, analysisA, transitionPositions.bPositions, analysisB)
        : computeTiltIndex(dataA.positions, analysisA, positionsB, analysisB),
    [transitionPositions, dataA, positionsB, analysisA, analysisB],
  )

  // 상단 텍스트 클릭 → 피치 하이라이트(TO-DO 50-3, "상단 바와 피치 간의
  // 인터랙션 연결" 피드백). 같은 대상을 다시 누르면 꺼지는 토글이라 여기서
  // 이전 값과 비교한다. 분석이나 공수 교대가 바뀌면 이전 하이라이트가
  // 엉뚱한 구역/선수를 가리킬 수 있어 초기화한다.
  const [highlight, setHighlight] = useState<MatchupHighlight>(null)
  useEffect(() => setHighlight(null), [analysisA.id, analysisB.id, attacker])

  const toggleZoneHighlight = (channel: Channel, third: Third) =>
    setHighlight((h) => (h?.kind === 'zone' && h.channel === channel && h.third === third ? null : { kind: 'zone', channel, third }))
  const togglePlayersHighlight = (keys: string[]) =>
    setHighlight((h) =>
      h?.kind === 'players' && h.keys.length === keys.length && h.keys.every((k) => keys.includes(k))
        ? null
        : { kind: 'players', keys },
    )
  const isPlayerHighlighted = (key: string) => highlight?.kind === 'players' && highlight.keys.includes(key)

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 텍스트 패널은 피치와 달리 넓어진다고 더 읽기 좋아지지 않는다 —
          "전술판 그 자체만 키워달라는거였어"(2026-09-15) — 그래서 폭을
          예전 박스 너비(max-w-6xl, 50-4번 이전)로 따로 고정한다. 피치 쪽
          박스(아래 min-h-0 flex-1)는 이 제한 없이 VersusPage가 준 넓은
          한도(현재 max-w-[1800px])를 그대로 쓴다. */}
      {showOverload && (
        <div className="mx-auto w-full max-w-6xl space-y-3">
          <AdvantageBadge zones={liveZones} labelA={labelA} labelB={labelB} highlight={highlight} onToggleZone={toggleZoneHighlight} />
          <ZoneSideGauges zones={liveZones} labelA={labelA} labelB={labelB} />
          <TiltGauge tilt={liveTilt} labelA={labelA} labelB={labelB} />
          <KeyZoneCallout
            advantage={matchupAdvantage}
            labelA={labelA}
            labelB={labelB}
            analysisA={analysisA}
            analysisB={analysisB}
            dataA={dataA}
            positionsB={positionsB}
            highlight={highlight}
            onToggleZone={toggleZoneHighlight}
          />
        </div>
      )}
      {/* 높이가 아니라 폭을 고정한다(2026-09-16, "너무 크다. 양옆이 딱
          수적우위구역이랑 길이가 같게 줄여줘") — 전에는 flex-1(→ 공수교대
          때마다 텍스트 높이에 따라 피치가 커졌다 작아졌다 하는 버그, 50-9
          참조)을 h-[85vh] 고정 높이로 바꿔 해결했는데, 그 결과 화면이 넓을
          때 피치가 위아래 텍스트 패널(max-w-6xl)보다 훨씬 넓어져 버렸다.
          이번엔 반대로 폭을 텍스트 패널과 같은 max-w-6xl로 고정하고,
          높이는 aspect-ratio로 폭에서 계산되게 한다.
          Pitch.tsx 자체(h-full로 높이를 물려받아 그 높이×비율로 폭을 냄)는
          그대로 둔다 — VersusShareCard(PNG 카드)도 같은 Pitch를 쓰는데,
          거기는 카드 높이 기준으로 폭을 내야 해서 이 파일과 반대 방향(높이
          우선) 계산이 필요하다. 대신 바깥에 aspect-[105/68] 래퍼 div를
          하나 더 둬서 "폭 고정 → 높이 계산"을 먼저 해주고, 그 결과 높이를
          Pitch가 h-full로 물려받게 한다 — 두 계산이 같은 비율(105:68)이라
          서로 안 어긋난다. */}
      <div className="mx-auto w-full max-w-6xl">
        <div className="aspect-[105/68] w-full">
          <Pitch orientation="landscape">
            {showChannelGrid && <ChannelGrid halfSpaces orientation="landscape" sideLabels />}
            {showPressingLine && transitionT === 0 && (
              <PressingLine
                positions={defendingPositions}
                pressingLineY={defendingPressingLineY}
                labelY={defendingPressingLineLevel}
                orientation="landscape"
              />
            )}
            {showOverload && (
              <MatchupOverloadLayer zones={liveZones} orientation="landscape" showNumbers={showZoneNumbers} highlight={highlight} />
            )}
            {showOverload && showBottleneck && <MatchupBottleneckLayer zones={liveZones} orientation="landscape" />}
            {showAnnotations && transitionT === 0 && (
              <g opacity={0.55}>
                <AnnotationLayer
                  annotations={transformAnnotationsForMatchup(dataA.annotations, false, true)}
                  loop
                  orientation="landscape"
                  ballDurationScale={VERSUS_BALL_DURATION_SCALE}
                />
                <AnnotationLayer
                  annotations={transformAnnotationsForMatchup(dataB.annotations, true, true)}
                  loop
                  orientation="landscape"
                  ballDurationScale={VERSUS_BALL_DURATION_SCALE}
                />
              </g>
            )}
            {markers.map((marker) => (
              <StaticPlayerNode
                key={marker.key}
                player={marker.player}
                position={transitionPositionByKey?.get(marker.key) ?? marker.originalPosition}
                formation={marker.formation}
                index={marker.index}
                variant={marker.variant}
                orientation="landscape"
                labelYOffset={labelOffsets.get(marker.key) ?? 0}
                runPoints={showAnnotations && transitionT === 0 ? marker.runPoints : null}
                highlighted={isPlayerHighlighted(marker.key)}
              />
            ))}
          </Pitch>
        </div>
      </div>
      {showOverload && (
        <div className="mx-auto w-full max-w-6xl">
          <TacticalSuggestions
            advantage={matchupAdvantage}
            labelA={labelA}
            labelB={labelB}
            phaseA={phaseA}
            phaseB={phaseB}
            zones={zones}
            analysisA={analysisA}
            analysisB={analysisB}
            dataA={dataA}
            positionsB={positionsB}
            highlight={highlight}
            onTogglePlayers={togglePlayersHighlight}
          />
        </div>
      )}
    </div>
  )
}
