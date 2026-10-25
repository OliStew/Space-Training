/**
 * THE UI API — everything a UI needs, as plain hooks. Import from '@/game'.
 *
 * Rules of thumb:
 *  - Hooks return plain numbers / arrays / objects. Re-render happens for you.
 *  - Action functions (buy, send, accept, ...) return a Promise and THROW an
 *    Error with a human-readable message if the action is refused (can't
 *    afford, price changed, trade expired, ...). Catch it and show `e.message`.
 *  - All balances are your own and live in this browser. All rules (holds,
 *    refunds, 15s expiry, depletion) are enforced in the engine, not the UI.
 *
 *  useResources()    your money / metal / ammo / biomass / oxygen / buildings
 *  useGameTime()     the shared game clock (seconds since the game began)
 *  useDepletion()    how fast biomass and oxygen drain, and a setter
 *  useMarkets()      market prices, travel times, in-transit deliveries + buy() / sell()
 *  usePlayerTrades() send / accept / decline / cancel trades with other players
 *  useHistory()      log of what happened
 *  useDebugResources() add()/remove() any resource (temporary cheat buttons)
 */

import { useCallback, useMemo } from 'react'
import { useGame, useNow } from './GameProvider'
import {
  advanceDay,
  applyDelta,
  calcDayTime,
  calculateHealthRegen,
  checkGameOutcome,
  continueAfterVictory,
  DAY_DURATION_SECONDS,
  DEPLETING_KEYS,
  HEALTH_REGEN_INTERVAL_SECONDS,
  HEALTH_REGEN_RATE,
  HEALTH_REGEN_THRESHOLD,
  isHealthRegenerating,
  MAX_HEALTH,
  PLAYER_TRADABLE_KEYS,
  resetGameState,
  setDay,
  setDepletion,
  setGameTime,
  VICTORY_DAY_THRESHOLD,
} from './state'
import type {
  DayCycle,
  DayPhase,
  DayTimeInfo,
  DepletingKey,
  GameOutcome,
  HistoryEntry,
} from './state'
import { tradeLegs } from '../shared/trade-book'
import type { Delta, MarketEntry, OrderReceipt, ResourceKey, TradableKey, Trade, TradeRequestInput } from '../shared/types'

export { RESOURCE_KEYS, TRADE_TTL_MS } from '../shared/types'
export {
  advanceDay,
  calcDayTime,
  calculateHealthRegen,
  checkGameOutcome,
  continueAfterVictory,
  DAY_DURATION_SECONDS,
  DEPLETING_KEYS,
  HEALTH_REGEN_INTERVAL_SECONDS,
  HEALTH_REGEN_RATE,
  HEALTH_REGEN_THRESHOLD,
  isHealthRegenerating,
  MAX_HEALTH,
  PLAYER_TRADABLE_KEYS,
  resetGameState,
  setDay,
  setGameTime,
  VICTORY_DAY_THRESHOLD,
}
export type {
  DayCycle,
  DayPhase,
  DayTimeInfo,
  Delta,
  DepletingKey,
  GameOutcome,
  HistoryEntry,
  MarketEntry,
  OrderReceipt,
  ResourceKey,
  TradableKey,
  TradeRequestInput,
}

// ---- Resources --------------------------------------------------------------

type VisibleResourceKey = Exclude<ResourceKey, 'metal' | 'buildings'>
/** `{ money, ammo, biomass, oxygen, health }` — current amounts (excludes metal and buildings). */
export function useResources(): Record<VisibleResourceKey, number> {
  const resources = useGame().state.resources
  const { buildings, metal, ...visible } = resources
  return visible
}

// ---- Day and Time System --------------------------------------------------------

export interface DayTime extends DayTimeInfo {
  /** Set total game time in seconds. */
  setTime: (seconds: number) => void
  /** Jump to a specific day number (e.g. `setDay(2)`). */
  setDay: (day: number, keepTimeOfDay?: boolean) => void
  /** Fast-forward to 00:00 of the next day. */
  advanceDay: () => void
}

/**
 * Access the 120-second day and 24-hour time system anywhere in the project.
 * Returns day number, formatted time, hour/minute/second, phase, and controls.
 */
export function useDayTime(): DayTime {
  const { state, store } = useGame()
  const info = useMemo(() => calcDayTime(state.gameTime), [state.gameTime])
  const setTime = useCallback((seconds: number) => store.update((s) => setGameTime(s, seconds)), [store])
  const setDayAction = useCallback((day: number, keepTime?: boolean) => store.update((s) => setDay(s, day, keepTime)), [store])
  const advanceDayAction = useCallback(() => store.update((s) => advanceDay(s)), [store])

  return {
    ...info,
    setTime,
    setDay: setDayAction,
    advanceDay: advanceDayAction,
  }
}

// ---- Game time ------------------------------------------------------------------

export interface GameTime extends DayTime {
  /**
   * The game clock in seconds, e.g. 125.4. Starts at 0, ticks about once a
   * second, is saved with the player, and every component sees the same value.
   * (Round it for display: `Math.floor(seconds)`.)
   */
  seconds: number
  /** Jump the clock, e.g. `set(0)` to restart a scenario. */
  set: (seconds: number) => void
}

export function useGameTime(): GameTime {
  const dayTime = useDayTime()
  return {
    ...dayTime,
    seconds: dayTime.totalSeconds,
    set: dayTime.setTime,
  }
}

// ---- Game Outcome (End-State System) ----------------------------------------

export interface GameOutcomeInfo {
  outcome: GameOutcome
  isVictory: boolean
  isDefeat: boolean
  isOver: boolean
  resetGame: () => void
  continueSimulation: () => void
}

/**
 * Hook to access and respond to the simulation's end states (Victory / Defeat).
 * - Victory occurs on reaching Day 30 of simulation.
 * - Defeat occurs if colony base health reaches 0%.
 */
export function useGameOutcome(): GameOutcomeInfo {
  const { state, store } = useGame()
  const outcome = useMemo(() => checkGameOutcome(state), [state])
  const resetGame = useCallback(() => {
    store.update((s) => resetGameState(s, Date.now()))
  }, [store])
  const continueSimulation = useCallback(() => {
    store.update((s) => continueAfterVictory(s))
  }, [store])

  return {
    outcome,
    isVictory: outcome === 'victory',
    isDefeat: outcome === 'defeat',
    isOver: outcome !== 'playing',
    resetGame,
    continueSimulation,
  }
}

// ---- Depletion ----------------------------------------------------------------

export interface Depletion {
  /** Units lost per second, per resource: `{ biomass: 0.05, oxygen: 0.1 }`. */
  rates: Record<DepletingKey, number>
  /** `setRate('oxygen', 0.2)` — 0 turns depletion off for that resource. */
  setRate: (resource: DepletingKey, perSecond: number) => void
}

export function useDepletion(): Depletion {
  const { state, store } = useGame()
  return {
    rates: state.depletion,
    setRate: (resource, perSecond) => store.update((s) => setDepletion(s, resource, perSecond)),
  }
}

// ---- Markets ------------------------------------------------------------------

/** A market plus how far away it is for YOU (random per player: 20, 40 or 60 seconds). */
export interface MarketView extends MarketEntry {
  delaySeconds: number
}

/** A market trade on its way. Buy: you already paid, goods arrive. Sell: you already gave the goods, money arrives. */
export interface DeliveryView {
  id: string
  market: string
  side: 'buy' | 'sell'
  resource: TradableKey
  quantity: number
  /** Price locked in when you ordered. */
  unitPrice: number
  /** What arrives: `{ metal: 5 }` for a buy, `{ money: 52.5 }` for a sell. */
  receive: Delta
  secondsLeft: number
}

export interface Markets {
  /**
   * Every market: `{ name, delaySeconds, prices: { metal: { buy, sell }, ... } }`.
   * `buy` = what you PAY per unit to buy; `sell` = what you GET per unit when selling.
   * Empty until the first load finishes.
   */
  markets: MarketView[]
  /** Your market trades still in transit (completed ones disappear and show up in useHistory). */
  deliveries: DeliveryView[]
  /** Resources that can be traded (buildings are excluded). */
  resources: TradableKey[]
  /** Seconds until prices next update (every ~30s), or null if unknown. */
  secondsUntilUpdate: number | null
  /** Last network error, or null. */
  error: string | null
  /** `buy('Ceres Station', 'metal', 5)` — pays the (locked-in) buy price now; goods arrive after the market's delay. */
  buy: (market: string, resource: TradableKey, quantity: number) => Promise<OrderReceipt>
  /** `sell('Ceres Station', 'metal', 5)` — gives the goods now; money arrives after the market's delay. */
  sell: (market: string, resource: TradableKey, quantity: number) => Promise<OrderReceipt>
}

export function useMarkets(): Markets {
  const { net, engine, state } = useGame()
  const now = useNow(500)
  return {
    markets: net.markets.map((m) => ({ ...m, delaySeconds: state.marketDelays[m.name] ?? 0 })),
    deliveries: Object.values(state.deliveries)
      .sort((a, b) => a.completesAt - b.completesAt)
      .map((d) => ({
        id: d.id,
        market: d.market,
        side: d.side,
        resource: d.resource,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        receive: d.receive,
        secondsLeft: Math.max(0, Math.ceil((d.completesAt - now) / 1000)),
      })),
    resources: PLAYER_TRADABLE_KEYS,
    secondsUntilUpdate: net.nextUpdateAt === null ? null : Math.max(0, Math.ceil((net.nextUpdateAt - (now + net.clockSkew)) / 1000)),
    error: net.error,
    buy: (market, resource, quantity) => engine.buyFromMarket(market, resource, quantity),
    sell: (market, resource, quantity) => engine.sellToMarket(market, resource, quantity),
  }
}

// ---- Player-to-player trades ---------------------------------------------------

/** A trade plus things the UI usually wants to show. */
export interface TradeView extends Trade {
  /** Whole seconds left to accept (0 when expired). */
  secondsLeft: number
  /** What YOU hand over and receive if it completes, e.g. `{ money: 50 }` / `{ metal: 10 }`. */
  youGive: Delta
  youReceive: Delta
}

export interface PlayerTrades {
  /** Names you can type into `send({ to })` (emails also work). */
  players: string[]
  /** Requests other players sent you that are still open. Show Accept / Decline / Counter. */
  incoming: TradeView[]
  /** Requests you sent that are still open. Show Cancel. */
  outgoing: TradeView[]
  /**
   * Ask another player to trade. `side: 'sell'` = you give goods for money;
   * `'buy'` = you give money for goods. `unitPrice` is per unit. Your side is
   * held immediately; it comes back if they decline or it expires (15s).
   */
  send: (request: TradeRequestInput) => Promise<void>
  /** Accept an incoming request (fails if you can't afford it or it expired). */
  accept: (tradeId: string) => Promise<void>
  decline: (tradeId: string) => Promise<void>
  /** Withdraw one of your own open requests. */
  cancel: (tradeId: string) => Promise<void>
  /**
   * Counteroffer = decline, then `send` a new request back. This does the
   * decline and returns a request you can edit and pass to `send` — the same
   * goods, reversed direction, to the original sender.
   */
  counter: (tradeId: string) => Promise<TradeRequestInput>
}

export function usePlayerTrades(): PlayerTrades {
  const { net, engine } = useGame()
  const now = useNow(500)
  const view = (t: Trade, role: 'requester' | 'recipient'): TradeView => {
    const { give, receive } = tradeLegs(t, role)
    return { ...t, secondsLeft: Math.max(0, Math.ceil((t.expiresAt - (now + net.clockSkew)) / 1000)), youGive: give, youReceive: receive }
  }
  const counter = useCallback(
    async (tradeId: string) => {
      const t = engine.net.get().incoming.find((x) => x.id === tradeId)
      if (!t) throw new Error('That trade request is no longer available')
      await engine.declineTrade(tradeId)
      return { to: t.fromName, side: t.side === 'sell' ? 'buy' : 'sell', resource: t.resource, quantity: t.quantity, unitPrice: t.unitPrice } as TradeRequestInput
    },
    [engine],
  )
  return {
    players: net.players,
    incoming: net.incoming.map((t) => view(t, 'recipient')),
    outgoing: net.outgoing.map((t) => view(t, 'requester')),
    send: async (request) => void (await engine.sendTrade(request)),
    accept: (id) => engine.acceptTrade(id),
    decline: (id) => engine.declineTrade(id),
    cancel: (id) => engine.cancelTrade(id),
    counter,
  }
}

// ---- History & debug ------------------------------------------------------------

/** Oldest first: `{ id, at (epoch ms), text }`. */
export function useHistory(): HistoryEntry[] {
  return useGame().state.history
}

export interface DebugResources {
  add: (resource: ResourceKey, amount: number) => void
  /** Stops at zero. */
  remove: (resource: ResourceKey, amount: number) => void
}

export function useDebugResources(): DebugResources {
  const { store } = useGame()
  return {
    add: (resource, amount) => store.update((s) => applyDelta(s, { [resource]: amount })),
    remove: (resource, amount) => store.update((s) => applyDelta(s, { [resource]: amount }, -1)),
  }
}
