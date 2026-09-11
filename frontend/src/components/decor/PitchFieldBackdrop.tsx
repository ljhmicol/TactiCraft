/**
 * 첫 화면 전용 장식 배경(2026-09-11 사용자 요청 — "검은 배경에 흰 줄로 축구
 * 그라운드처럼", 이어서 "첫번째 화면에서도 이렇게 나오면 좋겠어"로 `/`의 빈
 * 편집기 안내 화면에도 확장). `lib/theme.ts`의 `PITCH_COLORS`(실제 전술 피치,
 * 초록·데이터)와는 완전히 별개다 — 이건 좌표 데이터를 그리는 게 아니라
 * 분석이 아직 없는 화면(`/new`, `/`의 빈 상태)에만 쓰는 순수 장식용 SVG라
 * 피치 색 상수를 건드리지 않고 여기 따로 둔다. 정식 규격 105×68m 축구장
 * 비율을 viewBox로 그대로 써서(터치라인·하프라인·센터서클·페널티 박스·
 * 골에어리어·페널티 아크) 실루엣만으로 "축구장"이 읽히게 하되, 흰 선을 10%
 * 불투명도로 눌러서 본문 텍스트 대비를 해치지 않는다. `-z-10` fixed로
 * 스크롤해도 고정 — 애니메이션 없음(모션 절제 원칙 유지).
 */
export function PitchFieldBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      viewBox="0 0 105 68"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="white"
      strokeOpacity={0.1}
      strokeWidth={0.3}
    >
      {/* 터치라인·골라인 */}
      <rect x={0.5} y={0.5} width={104} height={67} />
      {/* 하프라인 */}
      <line x1={52.5} y1={0.5} x2={52.5} y2={67.5} />
      {/* 센터서클·센터스팟 */}
      <circle cx={52.5} cy={34} r={9.15} />
      <circle cx={52.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      {/* 왼쪽 페널티 박스·골에어리어·스팟·아크 */}
      <rect x={0.5} y={13.84} width={16} height={40.32} />
      <rect x={0.5} y={24.84} width={5} height={18.32} />
      <circle cx={11.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      <path d="M16.5 26.34 A9.15 9.15 0 0 1 16.5 41.66" />
      {/* 오른쪽 페널티 박스·골에어리어·스팟·아크(왼쪽 대칭) */}
      <rect x={88.5} y={13.84} width={16} height={40.32} />
      <rect x={99.5} y={24.84} width={5} height={18.32} />
      <circle cx={93.5} cy={34} r={0.4} fill="white" stroke="none" fillOpacity={0.1} />
      <path d="M88.5 26.34 A9.15 9.15 0 0 0 88.5 41.66" />
    </svg>
  )
}
