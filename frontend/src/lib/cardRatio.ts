/**
 * PNG 카드(ShareCard/SharePngCard/exportImage.ts) 공용 비율 정의(2026-09-24,
 * "핸드폰 화면에 꽉 차게 하고 싶은데 4:5로 하면 안 되는 거 아니야?" 요청으로
 * 9:16 추가) — 세 파일에 흩어져 있던 `ratio === '1:1' ? 1080 : 1350` 같은
 * 이항 삼항연산자를 한 곳으로 모은다. 폭은 항상 1080 고정, 비율마다 높이만
 * 다르다.
 *
 * 9:16은 실제 휴대폰 화면 비율(보통 9:19.5~9:20)과 정확히 같진 않지만 가장
 * 가깝고, 유튜브 쇼츠·인스타 릴스·틱톡이 전부 이 비율이라 범용성이 가장
 * 높다.
 */
export type CardRatio = '1:1' | '4:5' | '9:16'

export const CARD_WIDTH = 1080

export const CARD_HEIGHT_BY_RATIO: Record<CardRatio, number> = {
  '1:1': 1080,
  '4:5': 1350,
  '9:16': 1920,
}

/** ShareCard/SharePngCard의 피치 영역(flex:1) 최소 높이 — 카드가 세로로 길수록 더 크게 잡는다. */
export const PITCH_MIN_HEIGHT_BY_RATIO: Record<CardRatio, number> = {
  '1:1': 380,
  '4:5': 460,
  '9:16': 700,
}

/** ShareCard/SharePngCard의 본문(코멘트) 텍스트 박스 높이 — 벤치 줄이 있으면 그만큼 줄인다. */
export const BODY_BOX_HEIGHT_BY_RATIO: Record<CardRatio, { withBench: number; noBench: number }> = {
  '1:1': { withBench: 170, noBench: 210 },
  '4:5': { withBench: 220, noBench: 270 },
  '9:16': { withBench: 320, noBench: 400 },
}

/**
 * width 기준으로 축척한 카드 높이(2026-09-26, "GIF도 비율 설정할 수 있으면
 * 좋겠어" 요청) — PNG(width=CARD_WIDTH=1080)뿐 아니라 GIF처럼 더 작은
 * 고정 폭(AnimatedShareCard의 GIF_CARD_SIZE=720)에도 같은 비율을 쓰려면
 * 폭에 비례해 높이를 다시 계산해야 한다. width가 CARD_WIDTH와 같으면
 * CARD_HEIGHT_BY_RATIO[ratio]와 정확히 같은 값을 돌려준다(기존 PNG 동작과
 * 100% 호환).
 */
export function scaledCardHeight(ratio: CardRatio, width: number): number {
  return Math.round((CARD_HEIGHT_BY_RATIO[ratio] / CARD_WIDTH) * width)
}
