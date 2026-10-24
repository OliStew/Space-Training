/**
 * Player state and the pure functions that change it. Everything here is
 * synchronous and side-effect free so it can be tested and reused by any UI.
 */

import { round2 } from '../shared/pricing'
import { RESOURCE_KEYS, TRADABLE_KEYS } from '../shared/types'
import type { Delta, ResourceKey, TradableKey, Trade } from '../shared/types'

/** Resources players may trade (markets and other players). Buildings are owned, not traded, for now. */
export const PLAYER_TRADABLE_KEYS: TradableKey[] = TRADABLE_KEYS.filter((k) => k !== 'buildings')
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
  /** Epoch ms the depletion was last applied up to. */
  lastTick: number
  holds: Record<string, Hold>
  history: HistoryEntry[]
}

export const STARTING_RESOURCES: Record<ResourceKey, number> = {
  money: 1000,
  metal: 100,
  ammo: 50,
  biomass: 100,
  oxygen: 100,
  buildings: 0,
}

export const DEFAULT_DEPLETION: Record<DepletingKey, number> = { biomass: 0.05, oxygen: 0.1 }

const HISTORY_LIMIT = 50

export function initialState(now: number): GameState {
  return {
    version: 1,
    resources: { ...STARTING_RESOURCES },
    depletion: { ...DEFAULT_DEPLETION },
    lastTick: now,
    holds: {},
    history: [],
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
    lastTick: num(r.lastTick, now),
    holds: r.holds && typeof r.holds === 'object' ? r.holds : {},
    history: Array.isArray(r.history) ? r.history.slice(-HISTORY_LIMIT) : [],
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

/** Drain biomass and oxygen for the time elapsed since the last tick. */
export function tick(state: GameState, now: number): GameState {
  const seconds = (now - state.lastTick) / 1000
  if (seconds <= 0) return state.lastTick > now ? { ...state, lastTick: now } : state
  const resources = { ...state.resources }
  for (const k of DEPLETING_KEYS) {
    resources[k] = Math.max(0, resources[k] - state.depletion[k] * seconds)
  }
  return { ...state, resources, lastTick: now }
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
