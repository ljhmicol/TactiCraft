import { describe, expect, it } from 'vitest'

import { CARD_HEIGHT_BY_RATIO, CARD_WIDTH, scaledCardHeight } from './cardRatio'

describe('scaledCardHeight', () => {
  it('width가 CARD_WIDTH와 같으면 CARD_HEIGHT_BY_RATIO와 정확히 같다(PNG와 100% 호환)', () => {
    for (const ratio of ['1:1', '4:5', '9:16'] as const) {
      expect(scaledCardHeight(ratio, CARD_WIDTH)).toBe(CARD_HEIGHT_BY_RATIO[ratio])
    }
  })

  it('더 작은 폭(GIF_CARD_SIZE 등)에도 같은 종횡비를 유지한다', () => {
    // 4:5는 1080:1350 = 4:5 비율 — 720폭이면 900이어야 한다.
    expect(scaledCardHeight('4:5', 720)).toBe(900)
    // 9:16은 1080:1920 = 9:16 비율 — 720폭이면 1280이어야 한다.
    expect(scaledCardHeight('9:16', 720)).toBe(1280)
    expect(scaledCardHeight('1:1', 720)).toBe(720)
  })
})
