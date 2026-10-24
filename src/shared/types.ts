/**
 * Types shared by the worker (markets / trades Durable Objects) and the
 * client (game store / trading engine). No runtime dependencies.
 */

/** Everything a player owns. `money` is the currency; the rest can be traded. */
export const RESOURCE_KEYS = ['money', 'metal', 'ammo', 'biomass', 'oxygen', 'buildings', 'health'] as const
export type ResourceKey = (typeof RESOURCE_KEYS)[number]

/** Resources that can be bought/sold (everything except the currency). */
export const TRADABLE_KEYS = ['metal', 'ammo', 'biomass', 'oxygen', 'buildings', 'health'] as const
export type TradableKey = (typeof TRADABLE_KEYS)[number]

export function isTradable(value: unknown): value is TradableKey {
  return typeof value === 'string' && (TRADABLE_KEYS as readonly string[]).includes(value)
}

/** A change to a player's holdings (positive = gain, negative = loss). */
export type Delta = Partial<Record<ResourceKey, number>>

// ---- Markets ----------------------------------------------------------------

export interface MarketPrice {
  /** Price a player pays per unit to buy from the market. */
  buy: number
  /** Price a player receives per unit when selling to the market. */
  sell: number
}

export interface MarketEntry {
  name: string
  prices: Partial<Record<TradableKey, MarketPrice>>
}

export interface MarketsConfig {
  /** Seconds between batch updates (default 30). */
  batchInterval: number
  /** Percent added to every price each cycle (default 0). */
  interest: number
  /** Percent price rise per net unit bought in a cycle (default 1). */
  effect: number
  /** Percent price fall per net unit sold in a cycle (default 1). */
  impact: number
  /** Largest total shift (percent, either direction) one cycle may apply (default 50). */
  maxShift: number
  /** Gap between buy and sell price, as a percent of the midpoint (default 10). */
  spread: number
  /** Prices never fall below this (default 0.01). */
  minPrice: number
}

export const DEFAULT_MARKETS_CONFIG: MarketsConfig = {
  batchInterval: 30,
  interest: 0,
  effect: 1,
  impact: 1,
  maxShift: 50,
  spread: 10,
  minPrice: 0.01,
}

/** Aggregated order volume for one market + resource in the current cycle. */
export interface Volume {
  buy: number
  sell: number
}

export interface MarketsSnapshot {
  markets: MarketEntry[]
  config: MarketsConfig
  /** Epoch ms of the next price update, or null if none is scheduled. */
  nextUpdateAt: number | null
  serverTime: number
}

export interface OrderReceipt {
  side: 'buy' | 'sell'
  market: string
  resource: TradableKey
  quantity: number
  /** Per-unit price the order executed at. */
  price: number
  total: number
  nextUpdateAt: number | null
}

// ---- Player-to-player trades --------------------------------------------------

/** How long the recipient has to accept a trade request. */
export const TRADE_TTL_MS = 15_000

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

export interface Trade {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  /** The requester's side: 'sell' = requester gives goods for money; 'buy' = requester gives money for goods. */
  side: 'buy' | 'sell'
  resource: TradableKey
  quantity: number
  unitPrice: number
  /** quantity * unitPrice, rounded to cents. */
  total: number
  createdAt: number
  expiresAt: number
  status: TradeStatus
  resolvedAt?: number
  /** Which parties have applied the outcome locally. */
  ackedBy: string[]
}

export interface TradeRequestInput {
  /** Recipient's display name or email. */
  to: string
  side: 'buy' | 'sell'
  resource: TradableKey
  quantity: number
  unitPrice: number
}

export interface TradeSyncResult {
  /** Trades the caller must still act on or settle (pending, or finished but un-acked). */
  trades: Trade[]
  serverTime: number
}
