/**
 * 포지션별 전술 역할(FM 스타일) 목록 — 2026-09-07 사용자 요청.
 *
 * `lib/positions.ts`가 도출하는 라벨(LB/CB/DM/ST…)은 "포메이션 슬롯 이름"이고,
 * 여기 역할은 그 슬롯 안에서 "어떻게 뛰는지"를 고르는 한 단계 더 구체적인
 * 선택지다. 라벨이 너무 세분화(LCB/RCB/LWB/RWB 등)돼 있어 그대로 역할
 * 목록의 키로 쓰면 사실상 같은 자리인데 목록이 중복되므로, 더 성긴
 * `PositionGroup`으로 먼저 묶은 뒤 그룹별 역할을 고른다.
 *
 * blurb는 역할 선택 드롭다운(PlayerForm·PlayerEditDialog)의 title 툴팁으로
 * 쓰이는 문장이라, 완결된 한 문장으로 적는다.
 */
import type { PositionInfo, PositionLine } from '@/lib/positions'

export type PositionGroup = 'GK' | 'CB' | 'FB' | 'WB' | 'DM' | 'CM' | 'AM' | 'WM' | 'W' | 'ST'

export interface TacticalRole {
  id: string
  label: string
  blurb: string
}

const LABEL_TO_GROUP: Record<string, PositionGroup> = {
  GK: 'GK',
  CB: 'CB',
  LCB: 'CB',
  RCB: 'CB',
  LB: 'FB',
  RB: 'FB',
  LWB: 'WB',
  RWB: 'WB',
  DM: 'DM',
  CM: 'CM',
  AM: 'AM',
  LM: 'WM',
  RM: 'WM',
  LW: 'W',
  RW: 'W',
  ST: 'ST',
}

/** positionInfoAt이 못 찾을 때 쓰는 라인별 기본 그룹 (DF/MF/FW 폴백) */
const LINE_FALLBACK_GROUP: Record<PositionLine, PositionGroup> = {
  GK: 'GK',
  DF: 'CB',
  MF: 'CM',
  FW: 'ST',
}

export function positionGroupFromLabel(label: string, line?: PositionLine): PositionGroup {
  return LABEL_TO_GROUP[label] ?? (line ? LINE_FALLBACK_GROUP[line] : 'CM')
}

export const POSITION_GROUP_KOREAN: Record<PositionGroup, string> = {
  GK: '골키퍼',
  CB: '센터백',
  FB: '풀백',
  WB: '윙백',
  DM: '수비형 미드필더',
  CM: '중앙 미드필더',
  AM: '공격형 미드필더',
  WM: '측면 미드필더',
  W: '윙어',
  ST: '스트라이커',
}

export const TACTICAL_ROLES: Record<PositionGroup, TacticalRole[]> = {
  GK: [
    { id: 'sweeper-keeper', label: '스위퍼 키퍼', blurb: '페널티 박스 밖까지 나와 최후방 수비수처럼 커버한다' },
    { id: 'traditional-gk', label: '전통적 키퍼', blurb: '골라인 지역에 집중하며 안정적으로 처리한다' },
  ],
  CB: [
    { id: 'ball-playing-cb', label: '볼 플레잉 센터백', blurb: '직접 패스를 운반해 빌드업을 시작한다' },
    { id: 'stopper-cb', label: '스토퍼', blurb: '공중볼 경합과 몸싸움에 강하며 전진 저지에 집중한다' },
    { id: 'cover-cb', label: '커버링 센터백', blurb: '파트너 뒤 공간을 커버하며 뒷공간을 지운다' },
  ],
  FB: [
    { id: 'overlapping-fb', label: '오버래핑 풀백', blurb: '터치라인을 타고 오버래핑해 크로스 기회를 만든다' },
    { id: 'inverted-fb', label: '인버티드 풀백', blurb: '빌드업 시 중앙으로 좁혀 들어가 미드필더처럼 움직인다' },
    { id: 'defensive-fb', label: '수비형 풀백', blurb: '공격 가담을 자제하고 라인을 지킨다' },
  ],
  WB: [
    { id: 'attacking-wb', label: '어태킹 윙백', blurb: '공수 모두 터치라인을 오가며 측면 폭을 전담한다' },
    { id: 'complete-wb', label: '컴플리트 윙백', blurb: '박스 안까지 침투해 공격에 적극 가담한다' },
  ],
  DM: [
    { id: 'anchor', label: '앵커맨', blurb: '전진하지 않고 백라인 앞 공간을 지킨다' },
    { id: 'deep-playmaker', label: '딥 라잉 플레이메이커', blurb: '낮은 위치에서 경기를 조율하는 패스를 뿌린다' },
    { id: 'ball-winning-mf', label: '볼 위닝 미드필더', blurb: '적극적으로 전진 압박해 볼을 탈취한다' },
  ],
  CM: [
    { id: 'box-to-box', label: '박스 투 박스', blurb: '공수 양쪽 페널티 박스를 오가며 활동량을 책임진다' },
    { id: 'deep-playmaker-cm', label: '딥 라잉 플레이메이커', blurb: '낮은 위치에서 경기를 조율하는 패스를 뿌린다' },
    { id: 'advanced-playmaker-cm', label: '어드밴스드 플레이메이커', blurb: '전진 배치되어 라인 사이에서 창조적인 패스를 노린다' },
  ],
  AM: [
    { id: 'advanced-playmaker', label: '어드밴스드 플레이메이커', blurb: '라인 사이에서 마지막 패스를 노린다' },
    { id: 'shadow-striker', label: '섀도우 스트라이커', blurb: '스트라이커 뒤에서 침투해 득점에 가담한다' },
    { id: 'trequartista', label: '트레콰르티스타', blurb: '위치에 얽매이지 않고 자유롭게 움직이며 창의성을 발휘한다' },
  ],
  WM: [
    { id: 'wide-mf', label: '와이드 미드필더', blurb: '측면 폭을 지키며 공수 균형을 맞춘다' },
    { id: 'winger-style-mf', label: '윙어형 미드필더', blurb: '터치라인 끝까지 벌려 크로스 위주로 공격한다' },
  ],
  W: [
    { id: 'inverted-winger', label: '인버티드 윙어', blurb: '반대발 윙어로 안쪽으로 잘라 들어와 슈팅·패스를 노린다' },
    { id: 'traditional-winger', label: '트래디셔널 윙어', blurb: '터치라인을 타고 돌파해 크로스를 올린다' },
    { id: 'inside-forward', label: '인사이드 포워드', blurb: '하프스페이스로 좁혀 들어와 직접 골을 노린다' },
  ],
  ST: [
    { id: 'target-forward', label: '타겟 포워드', blurb: '공중볼 연계와 포스트플레이로 동료를 살린다' },
    { id: 'deep-lying-forward', label: '딥라잉 포워드', blurb: '내려와 볼을 받아 연계하고 동료의 침투를 유도한다' },
    { id: 'poacher', label: '폭스 인 더 박스', blurb: '박스 안 침투와 마무리에 집중한다' },
    { id: 'pressing-forward', label: '프레싱 포워드', blurb: '최전방에서부터 강하게 압박을 시작한다' },
  ],
}

/** 벤치 등 포지션이 정해지지 않은 선수용 — 전체 역할을 그룹 구분 없이 펼친 목록 */
export function allTacticalRoles(): (TacticalRole & { group: PositionGroup })[] {
  return (Object.keys(TACTICAL_ROLES) as PositionGroup[]).flatMap((group) =>
    TACTICAL_ROLES[group].map((role) => ({ ...role, group })),
  )
}

export function findTacticalRole(id: string | undefined): TacticalRole | undefined {
  if (!id) return undefined
  return allTacticalRoles().find((r) => r.id === id)
}

/**
 * 역할 드롭다운(PlayerForm·PlayerEditDialog 공용, TO-DO 20)이 보여줄 목록.
 * info가 있으면(선발) 그 포지션 그룹에 맞는 역할만, 없으면(벤치·포지션
 * 미상) 전체 목록을 그룹명과 함께 펼친다.
 */
export function roleOptionsFor(info: PositionInfo | null): (TacticalRole & { groupLabel?: string })[] {
  if (info) {
    return TACTICAL_ROLES[positionGroupFromLabel(info.label, info.line)].map((r) => ({ ...r, groupLabel: undefined }))
  }
  return allTacticalRoles().map((r) => ({ ...r, groupLabel: POSITION_GROUP_KOREAN[r.group] }))
}
