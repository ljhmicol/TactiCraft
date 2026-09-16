import { forwardRef } from 'react'

import { MatchupBottleneckLayer } from '@/components/versus/MatchupBottleneckLayer'
import { MatchupCompactnessLayer } from '@/components/versus/MatchupCompactnessLayer'
import { MatchupOverloadLayer } from '@/components/versus/MatchupOverloadLayer'
import { AnnotationLayer } from '@/components/pitch/AnnotationLayer'
import { ChannelGrid } from '@/components/pitch/ChannelGrid'
import { Pitch } from '@/components/pitch/Pitch'
import { PressingLine } from '@/components/pitch/PressingLine'
import { StaticPlayerNode } from '@/components/pitch/StaticPlayerNode'
import {
  buildMatchupMarkers,
  computeMatchupData,
  computeMatchupLabelOffsets,
  transformAnnotationsForMatchup,
  VERSUS_BALL_DURATION_SCALE,
} from '@/lib/matchup'
import { SHARE_CARD_COLORS, VERSUS_TEAM_COLORS } from '@/lib/theme'
import { computeSideAdvantage, SIDE_KOREAN, THIRD_KOREAN, zoneLabel, type PitchSide } from '@/lib/versusAdvantage'
import type { Analysis } from '@/types/analysis'

interface VersusShareCardProps {
  analysisA: Analysis
  analysisB: Analysis
  attacker: 'A' | 'B'
  showChannelGrid: boolean
  showOverload: boolean
  showPressingLine: boolean
  showAnnotations: boolean
  showZoneNumbers: boolean
  showBottleneck: boolean
  showCompactness: boolean
  ratio: '1:1' | '4:5'
}

const SIDES: PitchSide[] = ['left', 'center', 'right']

/**
 * 전술 대결(/versus) 결과 PNG 카드(TO-DO 41, "전술 대결 PNG/카드 내보내기"
 * 요청). 에디터의 `SharePngCard`와 같은 원칙(2단계 §12.5 — "화면을 그대로
 * 캡처하지 않는다") — 화면 그대로가 아니라 고정 1080px 폭 카드로 별도
 * 렌더링해서 캡처한다. `MatchupView`와 같은 파생 데이터(`lib/matchup.ts`)를
 * 공유해서 화면과 카드가 서로 다른 숫자를 보여주는 일이 없게 한다.
 *
 * `AdvantageBadge`/`ZoneSideGauges`/`KeyZoneCallout`(화면용, Tailwind
 * flex 기반)을 그대로 재사용하지 않고 아래에서 인라인 스타일로 다시
 * 그린다 — 실제 캡처해보니(`html-to-image`의 SVG `foreignObject` 경유
 * 렌더링) `justify-between` 같은 flex 배치의 텍스트가 실제 DOM에서는
 * 안 그러는데 캡처 결과에서만 줄바꿈되며 아래 요소와 겹치는 현상이
 * 있었다(Playwright로 실제 DOM 스크린샷 vs PNG 캡처 결과를 대조해서
 * 확인). `SharePngCard`가 처음부터 Tailwind 없이 인라인 스타일만 쓰는
 * 것과 같은 이유로 보인다 — 이 파일도 그 관례를 따른다. 숫자 자체는
 * `computeMatchupData`/`computeSideAdvantage`를 그대로 재사용해서 화면과
 * 다른 계산을 하지 않는다.
 *
 * `TacticalSuggestions`(전술 개선방안 문단)는 카드에서 뺐다 — 공유용
 * 카드는 한눈에 훑는 용도라 문장형 조언까지 넣으면 정보가 너무 많아진다
 * (SharePngCard도 코멘트를 500자로 잘라내는 것과 같은 절제 판단).
 */
export const VersusShareCard = forwardRef<HTMLDivElement, VersusShareCardProps>(function VersusShareCard(
  {
    analysisA,
    analysisB,
    attacker,
    showChannelGrid,
    showOverload,
    showPressingLine,
    showAnnotations,
    showZoneNumbers,
    showBottleneck,
    showCompactness,
    ratio,
  },
  ref,
) {
  const {
    phaseA,
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
  const markers = buildMatchupMarkers(analysisA, analysisB, dataA, dataB, positionsB)
  const labelOffsets = computeMatchupLabelOffsets(markers)

  const cardHeight = ratio === '1:1' ? 1080 : 1350
  const attackLabel = phaseA === 'attack' ? `${labelA} 공격 × ${labelB} 수비` : `${labelB} 공격 × ${labelA} 수비`
  const colorA = VERSUS_TEAM_COLORS.A.fill
  const colorB = VERSUS_TEAM_COLORS.B.fill
  const third = THIRD_KOREAN(labelA, labelB)
  const { aZones, bZones, totalZones } = matchupAdvantage
  const aPct = totalZones === 0 ? 0 : (aZones.length / totalZones) * 100
  const bPct = totalZones === 0 ? 0 : (bZones.length / totalZones) * 100
  const sideAdvantage = computeSideAdvantage(zones)

  return (
    <div style={{ position: 'absolute', left: -9999, top: 0 }}>
      <div
        ref={ref}
        style={{
          width: 1080,
          height: cardHeight,
          background: SHARE_CARD_COLORS.background,
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          fontFamily: '"IBM Plex Sans KR", ui-sans-serif, system-ui, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: SHARE_CARD_COLORS.title,
              fontFamily: '"Nanum Gothic Coding", monospace',
            }}
          >
            {labelA} vs {labelB}
          </div>
          <div style={{ fontSize: 26, color: SHARE_CARD_COLORS.phaseLabel, fontWeight: 700, marginTop: 8 }}>
            {attackLabel}
          </div>
        </div>

        {showOverload && totalZones > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <span style={{ color: colorA, fontSize: 20, fontWeight: 700, flex: 1 }}>
                  {labelA} {aZones.length}구역 수적 우위
                </span>
                <span style={{ color: SHARE_CARD_COLORS.subtitle, fontSize: 15, whiteSpace: 'nowrap', padding: '0 12px' }}>
                  전체 {totalZones}구역 중
                </span>
                <span style={{ color: colorB, fontSize: 20, fontWeight: 700, flex: 1, textAlign: 'right' }}>
                  {labelB} {bZones.length}구역 수적 우위
                </span>
              </div>
              <div style={{ display: 'flex', height: 10, width: '100%', overflow: 'hidden', borderRadius: 999, background: 'rgba(148,163,184,0.2)' }}>
                <div style={{ width: `${aPct}%`, background: colorA }} />
                <div style={{ width: `${100 - aPct - bPct}%` }} />
                <div style={{ width: `${bPct}%`, background: colorB }} />
              </div>
            </div>

            <div style={{ display: 'flex', width: '100%', gap: 16 }}>
              {SIDES.map((side) => {
                const { aZones: sideA, bZones: sideB, totalZones: sideTotal } = sideAdvantage[side]
                const sidePctA = sideTotal === 0 ? 0 : (sideA.length / sideTotal) * 100
                const sidePctB = sideTotal === 0 ? 0 : (sideB.length / sideTotal) * 100
                return (
                  <div key={side} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ color: SHARE_CARD_COLORS.subtitle, fontSize: 15, marginBottom: 4 }}>{SIDE_KOREAN[side]}</div>
                    <div style={{ display: 'flex', height: 7, width: '100%', overflow: 'hidden', borderRadius: 999, background: 'rgba(148,163,184,0.2)' }}>
                      <div style={{ width: `${sidePctA}%`, background: colorA }} />
                      <div style={{ width: `${100 - sidePctA - sidePctB}%` }} />
                      <div style={{ width: `${sidePctB}%`, background: colorB }} />
                    </div>
                    <div style={{ fontSize: 13, color: SHARE_CARD_COLORS.subtitle, marginTop: 4 }}>
                      <span style={{ color: colorA }}>{sideA.length}</span> : <span style={{ color: colorB }}>{sideB.length}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11, color: SHARE_CARD_COLORS.subtitle, marginTop: 6 }}>
              왼쪽·오른쪽은 {labelA} 공격 방향 기준(공수 교대와 무관) · 가로 화면에서는 위아래로 표시됩니다
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: ratio === '1:1' ? 420 : 540, display: 'flex', justifyContent: 'center' }}>
          <div style={{ height: '100%' }}>
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
              {showOverload && <MatchupOverloadLayer zones={zones} orientation="landscape" showNumbers={showZoneNumbers} />}
              {showOverload && showBottleneck && <MatchupBottleneckLayer zones={zones} orientation="landscape" />}
              {showCompactness && (
                <MatchupCompactnessLayer aPositions={dataA.positions} bPositions={positionsB} orientation="landscape" />
              )}
              {showAnnotations && (
                <g opacity={0.55}>
                  <AnnotationLayer
                    annotations={transformAnnotationsForMatchup(dataA.annotations, false, true)}
                    orientation="landscape"
                    ballDurationScale={VERSUS_BALL_DURATION_SCALE}
                  />
                  <AnnotationLayer
                    annotations={transformAnnotationsForMatchup(dataB.annotations, true, true)}
                    orientation="landscape"
                    ballDurationScale={VERSUS_BALL_DURATION_SCALE}
                  />
                </g>
              )}
              {/* animated={false}(TO-DO 48) — 선수 run 반복 이동은 라이브 화면
                  전용이다. 고정 프레임 한 장인 이 카드에서 궤적 중간 어딘가를
                  찍으면 마커·글자가 자기 이름표 자리에서 떨어져 보여 렌더링
                  버그처럼 읽힐 위험이 있다(패스 공은 "경로 위 어딘가"가
                  자연스럽지만 선수 마커는 다르다) — TacticalSuggestions를
                  카드에서 뺀 것과 같은 "카드는 고정 요약" 원칙. */}
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
                  animated={false}
                />
              ))}
            </Pitch>
          </div>
        </div>

        {showOverload && (matchupAdvantage.aTopZone || matchupAdvantage.bTopZone) && (
          <div style={{ display: 'flex', gap: 12 }}>
            {matchupAdvantage.aTopZone && (
              <div
                style={{
                  flex: 1,
                  border: `1px solid ${colorA}66`,
                  background: `${colorA}1a`,
                  color: colorA,
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                ★ {labelA} 키포인트: {zoneLabel(matchupAdvantage.aTopZone, third)}
              </div>
            )}
            {matchupAdvantage.bTopZone && (
              <div
                style={{
                  flex: 1,
                  border: `1px solid ${colorB}66`,
                  background: `${colorB}1a`,
                  color: colorB,
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                ★ {labelB} 키포인트: {zoneLabel(matchupAdvantage.bTopZone, third)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
