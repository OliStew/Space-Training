/**
 * Market pricing.
 *
 * Net Volume Percentage Shift (NVPS): in each cycle a resource's price moves
 * by a percentage proportional to its *net* order volume —
 *
 *   shift% = clamp(buys * effect - sells * impact, ±maxShift)
 *   price *= 1 + shift% / 100
 *
 * Buys and sells cancel one another (100 buys + 100 sells = no move) and the
 * shift is linear in volume rather than compounding per order. Buy and sell
 * prices shift together so the spread keeps its proportion.
 */

import type { MarketEntry, MarketPrice, MarketsConfig, TradableKey, Volume } from './types'

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** Build a buy/sell pair around a midpoint using the configured spread. */
export function priceFromMid(mid: number, spreadPct: number): MarketPrice {
  return { buy: mid * (1 + spreadPct / 200), sell: mid * (1 - spreadPct / 200) }
}

/** Percentage shift (before interest) a volume produces under the config. */
export function netVolumeShiftPct(volume: Volume, config: MarketsConfig): number {
  const raw = volume.buy * config.effect - volume.sell * config.impact
  return Math.max(-config.maxShift, Math.min(config.maxShift, raw))
}

/** Apply interest + NVPS to one price pair. */
export function shiftPrice(price: MarketPrice, volume: Volume | undefined, config: MarketsConfig): MarketPrice {
  const interest = 1 + config.interest / 100
  const shift = 1 + (volume ? netVolumeShiftPct(volume, config) : 0) / 100
  const factor = interest * shift
  const buy = Math.max(config.minPrice, price.buy * factor)
  // Selling can never pay more than buying costs.
  const sell = Math.min(buy, Math.max(config.minPrice, price.sell * factor))
  return { buy, sell }
}

/**
 * Run one update cycle: returns new market entries (inputs are not mutated).
 * `volumes` is keyed `${market}\u0000${resource}`.
 */
export function updateMarkets(
  markets: MarketEntry[],
  volumes: Record<string, Volume>,
  config: MarketsConfig,
): MarketEntry[] {
  return markets.map((market) => {
    const prices: MarketEntry['prices'] = {}
    for (const [resource, price] of Object.entries(market.prices) as [TradableKey, MarketPrice][]) {
      prices[resource] = shiftPrice(price, volumes[volumeKey(market.name, resource)], config)
    }
    return { name: market.name, prices }
  })
}

export const volumeKey = (market: string, resource: string): string => `${market}\u0000${resource}`
