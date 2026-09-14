import { AdvantageBadge } from '@/components/versus/AdvantageBadge'
import { KeyZoneCallout } from '@/components/versus/KeyZoneCallout'
import { MatchupOverloadLayer } from '@/components/versus/MatchupOverloadLayer'
import { TacticalSuggestions } from '@/components/versus/TacticalSuggestions'
import { ZoneSideGauges } from '@/components/versus/ZoneSideGauges'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { StaticPlayerNode } from '@/components/pitch/StaticPlayerNode'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { buildMatchupMarkers, computeMatchupData, computeMatchupLabelOffsets, transformAnnotationsForMatchup } from '@/lib/matchup'
import type { Analysis } from '@/types/analysis'

interface MatchupViewProps {
  analysisA: Analysis
  analysisB: Analysis
  /** 어느 쪽이 공격 국면인지 — 나머지 한쪽은 자동으로 수비 국면이 된다 */
  attacker: 'A' | 'B'
  showChannelGrid: boolean
  showOverload: boolean
  showPressingLine: boolean
  showAnnotations: boolean
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
}: MatchupViewProps) {
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
  } = computeMatchupData(analysisA, analysisB, attacker)

  // 마커는 겹치면 그냥 겹치는 채로 둔다(2026-09-09 사용자 결정 — 스파이더파이어
  // 대신 예전처럼). 이름표만 겹치지 않게 위아래로 나눈다(TO-DO 28, 1번).
  const markers = buildMatchupMarkers(analysisA, analysisB, dataA, positionsB)
  const labelOffsets = computeMatchupLabelOffsets(markers)

  return (
    <div className="flex h-full flex-col gap-3">
      {showOverload && (
        <>
          <AdvantageBadge zones={zones} labelA={labelA} labelB={labelB} />
          <ZoneSideGauges zones={zones} labelA={labelA} labelB={labelB} />
          <KeyZoneCallout
            advantage={matchupAdvantage}
            labelA={labelA}
            labelB={labelB}
            analysisA={analysisA}
            analysisB={analysisB}
            dataA={dataA}
            positionsB={positionsB}
          />
        </>
      )}
      <div className="min-h-0 flex-1">
        <Pitch orientation="landscape">
          {showChannelGrid && <ChannelGrid halfSpaces orientation="landscape" sideLabels />}
          {showPressingLine && (
            <PressingLine
              positions={defendingPositions}
              pressingLineY={defendingPressingLineY}
              labelY={defendingPressingLineLevel}
              orientation="landscape"
            />
          )}
          {showOverload && <MatchupOverloadLayer zones={zones} orientation="landscape" />}
          {showAnnotations && (
            <g opacity={0.55}>
              <AnnotationLayer annotations={transformAnnotationsForMatchup(dataA.annotations, false, true)} loop />
              <AnnotationLayer annotations={transformAnnotationsForMatchup(dataB.annotations, true, true)} loop />
            </g>
          )}
          {markers.map((marker) => (
            <StaticPlayerNode
              key={marker.key}
              player={marker.player}
              position={marker.originalPosition}
              formation={marker.formation}
              index={marker.index}
              variant={marker.variant}
              orientation="landscape"
              labelYOffset={labelOffsets.get(marker.key) ?? 0}
            />
          ))}
        </Pitch>
      </div>
      {showOverload && (
        <TacticalSuggestions advantage={matchupAdvantage} labelA={labelA} labelB={labelB} phaseA={phaseA} phaseB={phaseB} />
      )}
    </div>
  )
}
