/**
 * Markets Durable Object (single instance per app).
 *
 * Each market lists a buy and a sell price per resource. Orders execute
 * immediately at the current price (the caller moves its own balances), but
 * only their *volume* is recorded; every `batchInterval` seconds prices are
 * updated from the net volume of the previous cycle (see shared/pricing.ts).
 *
 * Only reachable through the authenticated actions in src/actions/index.ts.
 */

import { updateMarkets, priceFromMid, volumeKey } from '../shared/pricing'
import { DEFAULT_MARKETS_CONFIG, isTradable } from '../shared/types'
import type {
  MarketEntry,
  MarketPrice,
  MarketsConfig,
  MarketsSnapshot,
  OrderReceipt,
  TradableKey,
  Volume,
} from '../shared/types'

const MAX_ORDER_QUANTITY = 1_000_000

/** Markets created the first time the room wakes up. Mid prices per unit. */
const SEED_MARKETS: Record<string, Partial<Record<TradableKey, number>>> = {
  'Ceres Station': { metal: 10, ammo: 25, biomass: 6, oxygen: 8, buildings: 500 },
  'Mars Colony': { metal: 14, ammo: 20, biomass: 4, oxygen: 12, buildings: 450 },
  'Belt Traders': { metal: 7, ammo: 30, biomass: 9, oxygen: 6, buildings: 600 },
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status)

export class AppMarketsRoom {
  private storage: DurableObjectStorage
  private config: MarketsConfig = DEFAULT_MARKETS_CONFIG
  private markets: MarketEntry[] = []
  /** Order volume since the last update, keyed by volumeKey(market, resource). */
  private volumes: Record<string, Volume> = {}

  constructor(state: DurableObjectState, _env: unknown) {
    this.storage = state.storage
    state.blockConcurrencyWhile(async () => {
      this.config = { ...DEFAULT_MARKETS_CONFIG, ...(await this.storage.get<Partial<MarketsConfig>>('config')) }
      const stored = await this.storage.get<MarketEntry[]>('markets')
      this.markets = stored ?? seedMarkets(this.config)
      if (!stored) await this.storage.put('markets', this.markets)
      this.volumes = (await this.storage.get<Record<string, Volume>>('volumes')) ?? {}
      // The cycle runs continuously (so `interest` applies even with no orders).
      if ((await this.storage.getAlarm()) === null) await this.scheduleNext()
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const method = request.method
    const body = method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {}

    switch (url.pathname) {
      case '/snapshot':
        return json(await this.snapshot())
      case '/order':
        return this.handleOrder(body)
      case '/markets':
        if (method === 'POST') return this.handleUpsert(body)
        if (method === 'DELETE') return this.handleRemove(url.searchParams.get('name') ?? '')
        return bad('Method Not Allowed', 405)
      case '/config':
        if (method === 'POST') return this.handleSetConfig(body)
        return json({ config: this.config })
      case '/reset':
        if (method === 'POST') return this.handleReset()
        return bad('Method Not Allowed', 405)
      default:
        return bad('Not Found', 404)
    }
  }

  /** End of cycle: apply interest + net volume shift, clear volumes, re-arm. */
  async alarm(): Promise<void> {
    this.markets = updateMarkets(this.markets, this.volumes, this.config)
    this.volumes = {}
    await this.storage.put({ markets: this.markets, volumes: this.volumes })
    await this.scheduleNext()
  }

  private async scheduleNext() {
    await this.storage.setAlarm(Date.now() + this.config.batchInterval * 1000)
  }

  private async snapshot(): Promise<MarketsSnapshot> {
    return {
      markets: this.markets,
      config: this.config,
      nextUpdateAt: await this.storage.getAlarm(),
      serverTime: Date.now(),
    }
  }

  // ---- Orders -------------------------------------------------------------

  private async handleOrder(body: Record<string, unknown>): Promise<Response> {
    const { side, market: marketName, resource, quantity, expectedPrice } = body
    if (side !== 'buy' && side !== 'sell') return bad('"side" must be "buy" or "sell"')
    if (typeof marketName !== 'string') return bad('"market" is required')
    if (!isTradable(resource)) return bad('Unknown "resource"')
    if (!Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_ORDER_QUANTITY) {
      return bad(`"quantity" must be a whole number from 1 to ${MAX_ORDER_QUANTITY}`)
    }
    const market = this.markets.find((m) => m.name === marketName)
    const price = market?.prices[resource]
    if (!market || !price) return bad(`${marketName} does not trade ${resource}`, 404)

    const unit = side === 'buy' ? price.buy : price.sell
    // Prices only move once per cycle, but a client may be showing last cycle's.
    if (typeof expectedPrice === 'number' && Math.abs(expectedPrice - unit) > 1e-6) {
      return bad('Price has changed', 409, { code: 'price_changed' })
    }

    const key = volumeKey(market.name, resource)
    const volume = (this.volumes[key] ??= { buy: 0, sell: 0 })
    volume[side] += quantity as number
    await this.storage.put('volumes', this.volumes)

    const receipt: OrderReceipt = {
      side,
      market: market.name,
      resource,
      quantity: quantity as number,
      price: unit,
      total: unit * (quantity as number),
      nextUpdateAt: await this.storage.getAlarm(),
    }
    return json({ receipt })
  }

  // ---- Management ---------------------------------------------------------

  private async handleUpsert(body: Record<string, unknown>): Promise<Response> {
    const { name, prices } = body
    if (typeof name !== 'string' || !name.trim()) return bad('"name" is required')
    if (!prices || typeof prices !== 'object') return bad('"prices" object is required')

    // Each price is either a midpoint number (spread applied) or { buy, sell }.
    const entry: MarketEntry = { name: name.trim(), prices: {} }
    for (const [resource, value] of Object.entries(prices as Record<string, unknown>)) {
      if (!isTradable(resource)) return bad(`Unknown resource "${resource}"`)
      let price: MarketPrice | null = null
      if (typeof value === 'number' && value > 0) price = priceFromMid(value, this.config.spread)
      else if (value && typeof value === 'object') {
        const { buy, sell } = value as Partial<MarketPrice>
        if (typeof buy === 'number' && typeof sell === 'number' && buy > 0 && sell > 0 && sell <= buy) price = { buy, sell }
      }
      if (!price) return bad(`Invalid price for ${resource} (use a positive number, or {buy, sell} with sell <= buy)`)
      entry.prices[resource] = price
    }

    const idx = this.markets.findIndex((m) => m.name === entry.name)
    if (idx >= 0) this.markets[idx] = entry
    else this.markets.push(entry)
    await this.storage.put('markets', this.markets)
    return json({ market: entry })
  }

  private async handleRemove(name: string): Promise<Response> {
    const next = this.markets.filter((m) => m.name !== name)
    if (next.length === this.markets.length) return bad('No such market', 404)
    this.markets = next
    await this.storage.put('markets', this.markets)
    return json({ removed: name })
  }

  private async handleSetConfig(body: Record<string, unknown>): Promise<Response> {
    const next = { ...this.config }
    for (const key of Object.keys(DEFAULT_MARKETS_CONFIG) as (keyof MarketsConfig)[]) {
      const value = body[key]
      if (value === undefined) continue
      if (typeof value !== 'number' || !Number.isFinite(value)) return bad(`"${key}" must be a number`)
      next[key] = value
    }
    if (next.batchInterval < 1) return bad('"batchInterval" must be at least 1 second')
    if (next.minPrice <= 0) return bad('"minPrice" must be positive')
    if (next.maxShift < 0 || next.spread < 0) return bad('"maxShift" and "spread" cannot be negative')

    const intervalChanged = next.batchInterval !== this.config.batchInterval
    this.config = next
    await this.storage.put('config', next)
    if (intervalChanged) await this.scheduleNext()
    return json({ config: next })
  }

  /** Reset markets, config, and volumes to their seed defaults. */
  private async handleReset(): Promise<Response> {
    this.config = { ...DEFAULT_MARKETS_CONFIG }
    this.markets = seedMarkets(this.config)
    this.volumes = {}
    await this.storage.put({ markets: this.markets, config: this.config, volumes: this.volumes })
    await this.storage.deleteAlarm()
    await this.scheduleNext()
    return json({ reset: true })
  }
}

function seedMarkets(config: MarketsConfig): MarketEntry[] {
  return Object.entries(SEED_MARKETS).map(([name, mids]) => {
    const prices: MarketEntry['prices'] = {}
    for (const [resource, mid] of Object.entries(mids) as [TradableKey, number][]) {
      prices[resource] = priceFromMid(mid, config.spread)
    }
    return { name, prices }
  })
}
