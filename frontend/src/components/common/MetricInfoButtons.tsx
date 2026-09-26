import { InfoDialogButton } from '@/components/versus/InfoDialogButton'

/**
 * 전술 지표 설명(개선 로드맵 §7.5, "자동 제안이 어떤 좌표와 규칙을 사용했는지
 * 설명한다" + "지표가 실제 경기 결과나 승률을 보장하지 않는다는 한계를
 * 명시한다"). 에디터(`LayerToggleChips`)와 전술 대결(`VersusPage`)이 같은
 * 계산 로직(`lib/overload.ts`·`lib/compactness.ts`·`lib/zones.ts`)을 쓰므로
 * 설명 문구도 여기 한 곳에서 공유한다 — 각자 따로 쓰면 계산 방식이 바뀔 때
 * 한쪽만 고치고 다른 쪽은 옛 설명이 남는 드리프트가 생긴다.
 *
 * `AdvantageBadge`/`KeyZoneCallout`가 이미 쓰던 패턴 그대로: 라벨 옆에
 * `<InfoDialogButton>`을 나란히 둔다(버튼 안에 버튼을 중첩할 수 없어서
 * 토글 버튼과는 형제 요소로 배치한다).
 */
export function ChannelGridInfo() {
  return (
    <InfoDialogButton title="5채널·하프스페이스란?" ariaLabel="5채널·하프스페이스 설명 보기">
      <p>
        피치를 터치라인 폭 기준으로 5구역(왼쪽 0~20%·왼쪽 하프 20~36.5%·중앙 36.5~63.5%·오른쪽 하프 63.5~80%·오른쪽
        80~100%)으로 나눈 것입니다. 균등한 20%씩 5등분이 아니라, 페널티 지역·골 지역의 실제 폭을 세로로 연장한
        기준선을 씁니다.
      </p>
      <p>&quot;하프&quot; 토글은 이 중 좌우 하프스페이스(20~36.5%, 63.5~80%) 구간만 강조해서 보여줍니다.</p>
      <p>이 구분은 선수의 좌우 위치만 보여줄 뿐, 실제 압박 강도나 패스 성공률 같은 경기 데이터를 반영하지 않습니다.</p>
    </InfoDialogButton>
  )
}

export function PressingLineInfo() {
  return (
    <InfoDialogButton title="압박 라인이란?" ariaLabel="압박 라인 설명 보기">
      <p>
        골키퍼를 제외한 출전 선수 중 가장 뒤(자기 골문에 가까운, y좌표가 가장 큰) 선수 한 명의 y좌표를 기준으로
        삼습니다. 이 값을 &quot;매우 높음~매우 낮음&quot; 5단계로 표시합니다. 수동으로 직접 지정한 값이 있으면 자동
        계산 대신 그 값을 그대로 씁니다.
      </p>
      <p>에디터에서는 이 라인을 위아래로 드래그해 대형 전체를 그 높이로 밀어 올리거나 내릴 수 있습니다.</p>
      <p>라인의 위치만 보여줄 뿐, 실제 오프사이드 트랩 성공률이나 상대 공격 차단율을 보장하지 않습니다.</p>
    </InfoDialogButton>
  )
}

export function CompactnessInfo() {
  return (
    <InfoDialogButton title="콤팩트니스(폭·깊이)란?" ariaLabel="콤팩트니스 설명 보기">
      <p>
        골키퍼를 제외한 나머지 10명의 좌표를 모두 감싸는 최소 사각형(바운딩 박스)의 세로·가로 길이를 실제 축구장
        치수(세로 105m·가로 68m)로 환산한 값입니다.
      </p>
      <p>숫자가 작을수록 대형이 더 조밀하게 뭉쳐 있다는 뜻입니다.</p>
      <p>대형의 폭·깊이만 보여줄 뿐, 실제 수비 성공률이나 실점 확률과 직접 연결되지 않습니다.</p>
    </InfoDialogButton>
  )
}

export function OverloadInfo() {
  return (
    <InfoDialogButton title="오버로드(수적 우위)란?" ariaLabel="오버로드 설명 보기">
      <p>
        피치를 5채널×3서드(공격/중간/수비) = 15구역으로 나눈 뒤, 각 구역 안에 있는 자팀·상대팀 인원수 차이(자팀
        인원−상대팀 인원)를 구역마다 계산합니다.
      </p>
      <p>차이가 2명 이상이면 진하게, 1명이면 옅게 칠하고 그 위에 +N 숫자를 함께 표시합니다.</p>
      <p>
        상대팀 좌표를 입력해야만 계산되며, 그 순간의 인원 배치만 셀 뿐 실제 압박 강도나 패스 차단 가능성은 반영하지
        않습니다. 실제 경기 결과나 승률을 보장하지 않습니다.
      </p>
    </InfoDialogButton>
  )
}

export function BottleneckInfo() {
  return (
    <InfoDialogButton title="밀집 구역(병목)이란?" ariaLabel="밀집 구역(병목) 설명 보기">
      <p>
        오버로드와 같은 15구역을 쓰지만, 어느 팀이 우세한지가 아니라 양 팀 선수가 동시에 몰려 있는 구역을 찾습니다.
        자팀·상대팀이 모두 1명 이상 있는 구역만 대상이고(한쪽만 있으면 그냥 그 팀의 우세 구역일 뿐입니다), 두 팀
        합계 인원이 3명이면 옅게, 4명 이상이면 진하게 빗금으로 표시합니다.
      </p>
      <p>좌표상 밀집도만 보여줄 뿐, 실제로 몸싸움이나 볼 다툼이 일어나는지는 알 수 없습니다.</p>
    </InfoDialogButton>
  )
}
