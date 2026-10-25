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
  /** Whether player chose to continue simulation after reaching 30-day victory. */
  continuedAfterVictory?: boolean
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
    continuedAfterVictory: false,
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
    continuedAfterVictory: Boolean(r.continuedAfterVictory),
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

// ---- Health Regeneration ---------------------------------------------------

/** Seconds required to regenerate 1% health. */
export const HEALTH_REGEN_INTERVAL_SECONDS = 5
/** Health regenerated per second (1% every 5 seconds = 0.2% / second). */
export const HEALTH_REGEN_RATE = 1.0 / HEALTH_REGEN_INTERVAL_SECONDS
/** Resource threshold required for health regeneration (biomass and oxygen > 50). */
export const HEALTH_REGEN_THRESHOLD = 50
/** Maximum colony base health percentage (100%). */
export const MAX_HEALTH = 100

/** Check whether health is currently actively regenerating. */
export function isHealthRegenerating(resources: Record<string, number>): boolean {
  return (
    resources.health > 0 &&
    resources.health < MAX_HEALTH &&
    resources.biomass > HEALTH_REGEN_THRESHOLD &&
    resources.oxygen > HEALTH_REGEN_THRESHOLD
  )
}

/**
 * Calculates health regenerated over `seconds` elapsed, taking into account
 * depletion rates so health only regenerates while biomass and oxygen stay above 50.
 */
export function calculateHealthRegen(
  health: number,
  biomass: number,
  oxygen: number,
  depletion: Record<DepletingKey, number>,
  seconds: number,
): number {
  if (health <= 0 || health >= MAX_HEALTH || seconds <= 0) return 0
  if (biomass <= HEALTH_REGEN_THRESHOLD || oxygen <= HEALTH_REGEN_THRESHOLD) return 0

  const bioRate = depletion.biomass ?? 0
  const oxyRate = depletion.oxygen ?? 0
  const timeBio = bioRate > 0 ? (biomass - HEALTH_REGEN_THRESHOLD) / bioRate : seconds
  const timeOxy = oxyRate > 0 ? (oxygen - HEALTH_REGEN_THRESHOLD) / oxyRate : seconds
  const validSeconds = Math.max(0, Math.min(seconds, timeBio, timeOxy))

  return Math.min(MAX_HEALTH - health, validSeconds * HEALTH_REGEN_RATE)
}

/** Drain biomass and oxygen for the time elapsed, regenerate base health if eligible, then pay out any market trades that have arrived. */
export function tick(state: GameState, now: number): GameState {
  let next = state
  const seconds = (now - state.lastTick) / 1000
  if (seconds > 0) {
    const resources = { ...state.resources }
    for (const k of DEPLETING_KEYS) {
      resources[k] = Math.max(0, resources[k] - state.depletion[k] * seconds)
    }

    // Health regenerates 1% per second when biomass and oxygen are both above 50
    const regen = calculateHealthRegen(
      state.resources.health,
      state.resources.biomass,
      state.resources.oxygen,
      state.depletion,
      seconds,
    )
    if (regen > 0) {
      resources.health = Math.min(MAX_HEALTH, resources.health + regen)
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

// ---- Day and Time System ----------------------------------------------------

/** Length of one in-game day in real-world seconds (2 minutes). */
export const DAY_DURATION_SECONDS = 120

export type DayPhase = 'NIGHT' | 'MORNING' | 'AFTERNOON' | 'EVENING'
export type DayCycle = 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT'

export interface DayTimeInfo {
  /** Current day number, starting at 1. Advances every 120 seconds. */
  day: number
  /** Elapsed seconds in the current 120-second day (0 to 119.99...). */
  daySeconds: number
  /** Seconds remaining until the next day begins (0 to 120). */
  secondsLeftInDay: number
  /** Progress through the day from 0.0 (start) to 1.0 (end). */
  progress: number
  /** Percentage of current day elapsed (0 to 100). */
  progressPercent: number
  /** In-game hour (0 to 23). Each hour lasts 5 real seconds. */
  hour: number
  /** In-game minute (0 to 59). Each minute lasts ~83.3ms. */
  minute: number
  /** In-game second (0 to 59). */
  second: number
  /** Formatted 24h clock string, e.g. "14:05". */
  timeString: string
  /** Formatted 24h clock string with seconds, e.g. "14:05:30". */
  timeStringFull: string
  /** Formatted day string, e.g. "Day 1". */
  dayString: string
  /** Combined day and time label, e.g. "Day 1, 14:05". */
  display: string
  /** Time-of-day phase: 'NIGHT' | 'MORNING' | 'AFTERNOON' | 'EVENING'. */
  phase: DayPhase
  /** Natural lighting / cycle phase: 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT'. */
  cycle: DayCycle
  /** Total elapsed game time in seconds. */
  totalSeconds: number
}

/** Pure calculator: derives the exact Day & Time state from elapsed game seconds. */
export function calcDayTime(gameTime: number): DayTimeInfo {
  const safeSeconds = Math.max(0, Number.isFinite(gameTime) ? gameTime : 0)
  const day = Math.floor(safeSeconds / DAY_DURATION_SECONDS) + 1
  const daySeconds = safeSeconds % DAY_DURATION_SECONDS
  const secondsLeftInDay = Math.max(0, DAY_DURATION_SECONDS - daySeconds)
  const progress = daySeconds / DAY_DURATION_SECONDS
  const progressPercent = Math.min(100, Math.round(progress * 100))

  const totalInGameMinutes = progress * 24 * 60
  const hour = Math.floor(totalInGameMinutes / 60) % 24
  const minute = Math.floor(totalInGameMinutes % 60)
  const second = Math.floor((progress * 24 * 3600) % 60)

  const pad = (n: number) => n.toString().padStart(2, '0')
  const timeString = `${pad(hour)}:${pad(minute)}`
  const timeStringFull = `${pad(hour)}:${pad(minute)}:${pad(second)}`
  const dayString = `Day ${day}`
  const display = `${dayString}, ${timeString}`

  let phase: DayPhase = 'NIGHT'
  if (hour >= 5 && hour < 12) phase = 'MORNING'
  else if (hour >= 12 && hour < 17) phase = 'AFTERNOON'
  else if (hour >= 17 && hour < 21) phase = 'EVENING'
  else phase = 'NIGHT'

  let cycle: DayCycle = 'NIGHT'
  if (hour >= 5 && hour < 8) cycle = 'DAWN'
  else if (hour >= 8 && hour < 18) cycle = 'DAY'
  else if (hour >= 18 && hour < 21) cycle = 'DUSK'
  else cycle = 'NIGHT'

  return {
    day,
    daySeconds,
    secondsLeftInDay,
    progress,
    progressPercent,
    hour,
    minute,
    second,
    timeString,
    timeStringFull,
    dayString,
    display,
    phase,
    cycle,
    totalSeconds: safeSeconds,
  }
}

/** Set the game to a specific day number (1-indexed). Optionally keeps current in-day time. */
export function setDay(state: GameState, day: number, keepTimeOfDay = true): GameState {
  if (!Number.isFinite(day) || day < 1) return state
  const currentDaySeconds = keepTimeOfDay ? state.gameTime % DAY_DURATION_SECONDS : 0
  const nextGameTime = (Math.floor(day) - 1) * DAY_DURATION_SECONDS + currentDaySeconds
  return setGameTime(state, nextGameTime)
}

/** Advance the game clock forward to 00:00 of the next day. */
export function advanceDay(state: GameState): GameState {
  const currentDay = Math.floor(state.gameTime / DAY_DURATION_SECONDS) + 1
  return setDay(state, currentDay + 1, false)
}

// ---- Victory and Defeat End State System ------------------------------------

/** Day count needed to achieve victory. */
export const VICTORY_DAY_THRESHOLD = 30

export type GameOutcome = 'playing' | 'victory' | 'defeat'

/**
 * Pure evaluator for simulation end-state:
 * - Defeat: Colony base health reaches 0% (health <= 0).
 * - Victory: Day 30 reached (day >= 30) and player hasn't opted to continue.
 * - Playing: Simulation in progress.
 */
export function checkGameOutcome(state: GameState): GameOutcome {
  if (state.resources.health <= 0) {
    return 'defeat'
  }
  const day = Math.floor(Math.max(0, state.gameTime) / DAY_DURATION_SECONDS) + 1
  if (day >= VICTORY_DAY_THRESHOLD && !state.continuedAfterVictory) {
    return 'victory'
  }
  return 'playing'
}

/** Reset simulation state to default starting state. */
export function resetGameState(state: GameState, now = Date.now()): GameState {
  const base = initialState(now)
  return {
    ...base,
    marketDelays: state.marketDelays,
  }
}

/** Continue playing after reaching victory without repeated popups. */
export function continueAfterVictory(state: GameState): GameState {
  return {
    ...state,
    continuedAfterVictory: true,
  }
}


