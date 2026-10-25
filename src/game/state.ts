/**
 * Player state and the pure functions that change it. Everything here is
 * synchronous and side-effect free so it can be tested and reused by any UI.
 */

import { round2 } from '../shared/pricing'
import { RESOURCE_KEYS, TRADABLE_KEYS } from '../shared/types'
import type { Delta, ResourceKey, TradableKey, Trade } from '../shared/types'

/** Resources players may trade (markets and other players). Buildings are owned, not traded, for now. */
export const PLAYER_TRADABLE_KEYS: TradableKey[] = TRADABLE_KEYS.filter((k) => k !== 'buildings' && k !== 'metal')
export const isPlayerTradable = (k: unknown): k is TradableKey => (PLAYER_TRADABLE_KEYS as readonly unknown[]).includes(k)

/** Resources that drain over time. */
export const DEPLETING_KEYS = ['biomass', 'oxygen'] as const
export type DepletingKey = (typeof DEPLETING_KEYS)[number]

/**
 * Resources promised to an in-flight trade. `give` was already deducted from
 * the player; `receive` is paid out if the trade is accepted, `give` is
 * refunded otherwise. Removing the hold is what makes settlement happen once.
 */
export interface Hold {
  tradeId: string
  role: 'requester' | 'recipient'
  give: Delta
  receive: Delta
  createdAt: number
  /** Enough of the trade to describe it in the history log. */
  summary: Pick<Trade, 'side' | 'resource' | 'quantity' | 'unitPrice' | 'total'> & { counterparty: string }
}

/** A market trade in transit: the price was locked and the paying side already deducted. */
export interface Delivery {
  id: string
  market: string
  side: 'buy' | 'sell'
  resource: TradableKey
  quantity: number
  unitPrice: number
  total: number
  createdAt: number
  /** Epoch ms (this device's clock) when `receive` is paid out. */
  completesAt: number
  /** Buy: the goods. Sell: the money. */
  receive: Delta
}

/** Possible travel times (seconds) for markets; each player gets them shuffled across markets. */
export const MARKET_DELAYS_SECONDS = [60, 40, 20]

export interface HistoryEntry {
  id: string
  at: number
  text: string
}

export interface GameState {
  version: 1
  resources: Record<ResourceKey, number>
  /** Units lost per second. Customizable; 0 disables depletion. */
  depletion: Record<DepletingKey, number>
  /** Game clock: seconds the game has run for this player. Advances with depletion (including time the app was closed). */
  gameTime: number
  /** Epoch ms the depletion was last applied up to. */
  lastTick: number
  holds: Record<string, Hold>
  /** Seconds a trade with each market takes, assigned randomly per player. */
  marketDelays: Record<string, number>
  /** Market trades still on their way. */
  deliveries: Record<string, Delivery>
  history: HistoryEntry[]
  /** Combat outcomes already applied here (`<attackId>:<role>` → epoch ms), so each lands once. */
  combatApplied: Record<string, number>
}

export const STARTING_RESOURCES: Record<ResourceKey, number> = {
  money: 1000,
  metal: 100,
  ammo: 50,
  biomass: 100,
  oxygen: 100,
  buildings: 0,
  health: 100,
}

export const DEFAULT_DEPLETION: Record<DepletingKey, number> = { biomass: 0.05, oxygen: 0.1 }

const HISTORY_LIMIT = 50

export function initialState(now: number): GameState {
  return {
    version: 1,
    resources: { ...STARTING_RESOURCES },
    depletion: { ...DEFAULT_DEPLETION },
    gameTime: 0,
    lastTick: now,
    holds: {},
    marketDelays: {},
    deliveries: {},
    history: [],
    combatApplied: {},
  }
}

/** Revive a persisted state, filling anything missing with defaults. */
export function reviveState(raw: unknown, now: number): GameState {
  const base = initialState(now)
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<GameState>
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const resources = { ...base.resources }
  for (const k of RESOURCE_KEYS) resources[k] = Math.max(0, num(r.resources?.[k], base.resources[k]))
  const depletion = { ...base.depletion }
  for (const k of DEPLETING_KEYS) depletion[k] = Math.max(0, num(r.depletion?.[k], base.depletion[k]))
  return {
    version: 1,
    resources,
    depletion,
    gameTime: Math.max(0, num(r.gameTime, 0)),
    lastTick: num(r.lastTick, now),
    holds: r.holds && typeof r.holds === 'object' ? r.holds : {},
    marketDelays: r.marketDelays && typeof r.marketDelays === 'object' ? r.marketDelays : {},
    deliveries: r.deliveries && typeof r.deliveries === 'object' ? r.deliveries : {},
    history: Array.isArray(r.history) ? r.history.slice(-HISTORY_LIMIT) : [],
    combatApplied: r.combatApplied && typeof r.combatApplied === 'object' ? r.combatApplied : {},
  }
}

export function canAfford(state: GameState, cost: Delta): boolean {
  return RESOURCE_KEYS.every((k) => (cost[k] ?? 0) <= state.resources[k] + 1e-9)
}

/** Add `delta` to the holdings (money is kept to the cent). Never goes below zero. */
export function applyDelta(state: GameState, delta: Delta, sign: 1 | -1 = 1): GameState {
  const resources = { ...state.resources }
  for (const k of RESOURCE_KEYS) {
    const change = (delta[k] ?? 0) * sign
    if (change === 0) continue
    const next = resources[k] + change
    resources[k] = Math.max(0, k === 'money' ? round2(next) : next)
  }
  return { ...state, resources }
}

/** Remove `cost` if affordable; returns null otherwise. */
export function spend(state: GameState, cost: Delta): GameState | null {
  return canAfford(state, cost) ? applyDelta(state, cost, -1) : null
}

/** Drain biomass and oxygen for the time elapsed, then pay out any market trades that have arrived. */
export function tick(state: GameState, now: number): GameState {
  let next = state
  const seconds = (now - state.lastTick) / 1000
  if (seconds > 0) {
    const resources = { ...state.resources }
    for (const k of DEPLETING_KEYS) {
      resources[k] = Math.max(0, resources[k] - state.depletion[k] * seconds)
    }
    next = { ...state, resources, gameTime: state.gameTime + seconds, lastTick: now }
  } else if (state.lastTick > now) {
    next = { ...state, lastTick: now }
  }
  return completeDeliveries(next, now)
}

/** Give each market without a travel time one, drawn at random from the unused times. */
export function assignMarketDelays(state: GameState, marketNames: string[], random: () => number = Math.random): GameState {
  const missing = marketNames.filter((n) => state.marketDelays[n] === undefined)
  if (missing.length === 0) return state
  const delays = { ...state.marketDelays }
  for (const name of missing) {
    const unused = MARKET_DELAYS_SECONDS.filter((d) => !Object.values(delays).includes(d))
    const pool = unused.length > 0 ? unused : MARKET_DELAYS_SECONDS
    delays[name] = pool[Math.floor(random() * pool.length)]
  }
  return { ...state, marketDelays: delays }
}

/** Reserve the paying side of a market trade and record it as in transit. Null if unaffordable. */
export function placeDelivery(state: GameState, give: Delta, delivery: Delivery): GameState | null {
  const spent = spend(state, give)
  return spent && { ...spent, deliveries: { ...spent.deliveries, [delivery.id]: delivery } }
}

/** Abort an in-transit trade (the server refused the order) and refund what was paid. */
export function cancelDelivery(state: GameState, id: string, refund: Delta): GameState {
  if (!state.deliveries[id]) return state
  const { [id]: _gone, ...deliveries } = state.deliveries
  return applyDelta({ ...state, deliveries }, refund)
}

/** Pay out every delivery whose time has come. Each is removed as it is paid, so it happens once. */
export function completeDeliveries(state: GameState, now: number): GameState {
  const due = Object.values(state.deliveries).filter((d) => d.completesAt <= now)
  if (due.length === 0) return state
  let next = state
  for (const d of due) {
    const { [d.id]: _done, ...deliveries } = next.deliveries
    next = applyDelta({ ...next, deliveries }, d.receive)
    const what = `${d.quantity} ${d.resource} ${d.side === 'buy' ? 'from' : 'to'} ${d.market}`
    next = addHistory(next, d.side === 'buy' ? `Delivered: ${what}` : `Paid $${d.total.toFixed(2)} for ${what}`, now)
  }
  return next
}

export function setDepletion(state: GameState, key: DepletingKey, perSecond: number): GameState {
  if (!Number.isFinite(perSecond) || perSecond < 0) return state
  return { ...state, depletion: { ...state.depletion, [key]: perSecond } }
}

export function addHistory(state: GameState, text: string, now: number): GameState {
  const entry: HistoryEntry = { id: `${now}-${state.history.length}-${Math.random().toString(36).slice(2, 6)}`, at: now, text }
  return { ...state, history: [...state.history, entry].slice(-HISTORY_LIMIT) }
}

/** Reserve resources for a trade. Returns null if unaffordable or the hold exists. */
export function placeHold(state: GameState, hold: Hold): GameState | null {
  if (state.holds[hold.tradeId]) return null
  const spent = spend(state, hold.give)
  return spent && { ...spent, holds: { ...spent.holds, [hold.tradeId]: hold } }
}

/** Settle a hold exactly once: pay out on success, refund on failure. No-op if already settled. */
export function resolveHold(state: GameState, tradeId: string, success: boolean, now: number, note?: string): GameState {
  const hold = state.holds[tradeId]
  if (!hold) return state
  const { [tradeId]: _removed, ...holds } = state.holds
  const next = applyDelta({ ...state, holds }, success ? hold.receive : hold.give)
  const s = hold.summary
  const what = `${s.quantity} ${s.resource} @ ${s.unitPrice.toFixed(2)}`
  const text = success
    ? `Trade with ${s.counterparty} completed: ${what}`
    : `Trade with ${s.counterparty} did not go through (${note ?? 'cancelled'}): ${what}`
  return addHistory(next, text, now)
}

/** Drop a hold and return what it reserved, without logging (the trade never existed). */
export function releaseHold(state: GameState, tradeId: string): GameState {
  const hold = state.holds[tradeId]
  if (!hold) return state
  const { [tradeId]: _removed, ...holds } = state.holds
  return applyDelta({ ...state, holds }, hold.give)
}

export function setGameTime(state: GameState, seconds: number): GameState {
  return Number.isFinite(seconds) && seconds >= 0 ? { ...state, gameTime: seconds } : state
}

// ---- Combat -----------------------------------------------------------------

const COMBAT_APPLIED_LIMIT = 200

/** Pay `ammo` (whole number) for combat. Null if you don't have it. */
export function spendAmmo(state: GameState, ammo: number): GameState | null {
  return spend(state, { ammo })
}

/**
 * Apply an attack's outcome once: the defender loses `damage` health (never
 * below zero); the attacker just gets a log line. No-op if already applied.
 */
export function applyCombatOutcome(
  state: GameState,
  attackId: string,
  role: 'attacker' | 'defender',
  text: string,
  damage: number,
  now: number,
): GameState {
  const key = `${attackId}:${role}`
  if (state.combatApplied[key]) return state
  const applied = Object.entries({ ...state.combatApplied, [key]: now })
    .sort((a, b) => a[1] - b[1])
    .slice(-COMBAT_APPLIED_LIMIT)
  const next = { ...state, combatApplied: Object.fromEntries(applied) }
  return addHistory(role === 'defender' ? applyDelta(next, { health: damage }, -1) : next, text, now)
}
