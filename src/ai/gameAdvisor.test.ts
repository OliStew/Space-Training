import { describe, expect, it } from 'vitest'
import { DEFAULT_MARKETS_CONFIG } from '../shared/types'
import type { MarketsSnapshot } from '../shared/types'
import { buildColonyPrompt } from './gameAdvisor'

const marketSnapshot: MarketsSnapshot = {
  markets: [{ name: 'Ceres Station', prices: { ammo: { buy: 12, sell: 10 } } }],
  config: DEFAULT_MARKETS_CONFIG,
  nextUpdateAt: null,
  serverTime: 0,
}

describe('buildColonyPrompt', () => {
  it('uses trade advice for the markets page even without active player offers', () => {
    const prompt = buildColonyPrompt(
      'Should I buy ammo?',
      { ammo: 20 },
      undefined,
      undefined,
      marketSnapshot,
      undefined,
      true,
    )

    expect(prompt).toContain('currently in the markets and trading module')
    expect(prompt).toContain('[MARKET DATA]')
    expect(prompt).toContain('Ceres Station')
  })

  it('keeps regular advice when the user is not on the markets page', () => {
    const prompt = buildColonyPrompt('How are supplies?', { ammo: 20 }, undefined, undefined, marketSnapshot)

    expect(prompt).toContain('currently in the home module')
    expect(prompt).not.toContain('currently in the markets and trading module')
  })
})
