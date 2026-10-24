import { describe, expect, it } from 'vitest'
import { netVolumeShiftPct, priceFromMid, shiftPrice, updateMarkets, volumeKey } from './pricing'
import { DEFAULT_MARKETS_CONFIG } from './types'
import type { MarketEntry } from './types'

const cfg = DEFAULT_MARKETS_CONFIG

describe('net volume percentage shift', () => {
  it('is linear in net volume, not compounding per order', () => {
    // 10 net buys at 1% = +10% (compounding would give 10.46%).
    const p = shiftPrice({ buy: 100, sell: 90 }, { buy: 10, sell: 0 }, cfg)
    expect(p.buy).toBeCloseTo(110)
    expect(p.sell).toBeCloseTo(99)
  })

  it('lets buys and sells cancel', () => {
    expect(netVolumeShiftPct({ buy: 40, sell: 40 }, cfg)).toBe(0)
    const p = shiftPrice({ buy: 100, sell: 90 }, { buy: 40, sell: 40 }, cfg)
    expect(p).toEqual({ buy: 100, sell: 90 })
  })

  it('lowers prices on net sells and clamps to maxShift', () => {
    expect(shiftPrice({ buy: 100, sell: 100 }, { buy: 0, sell: 5 }, cfg).buy).toBeCloseTo(95)
    expect(shiftPrice({ buy: 100, sell: 100 }, { buy: 0, sell: 500 }, cfg).buy).toBeCloseTo(50)
    expect(shiftPrice({ buy: 100, sell: 100 }, { buy: 500, sell: 0 }, cfg).buy).toBeCloseTo(150)
  })

  it('applies interest even with no orders, and respects the price floor', () => {
    expect(shiftPrice({ buy: 100, sell: 90 }, undefined, { ...cfg, interest: 2 }).buy).toBeCloseTo(102)
    const floored = shiftPrice({ buy: 0.011, sell: 0.01 }, { buy: 0, sell: 50 }, cfg)
    expect(floored.buy).toBeGreaterThanOrEqual(cfg.minPrice)
    expect(floored.sell).toBeLessThanOrEqual(floored.buy)
  })

  it('updates each market/resource from its own volume', () => {
    const markets: MarketEntry[] = [
      { name: 'A', prices: { metal: priceFromMid(10, 10), ammo: priceFromMid(20, 10) } },
      { name: 'B', prices: { metal: priceFromMid(10, 10) } },
    ]
    const next = updateMarkets(markets, { [volumeKey('A', 'metal')]: { buy: 10, sell: 0 } }, cfg)
    expect(next[0].prices.metal.buy).toBeCloseTo(10.5 * 1.1)
    expect(next[0].prices.ammo).toEqual(markets[0].prices.ammo)
    expect(next[1].prices.metal).toEqual(markets[1].prices.metal)
    expect(markets[0].prices.metal.buy).toBeCloseTo(10.5) // input untouched
  })
})
