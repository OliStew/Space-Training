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
 *  useCombat()       attack players with ammo, respond to attacks aimed at you
 *  useHistory()      log of what happened
 *  useDebugResources() add()/remove() any resource (temporary cheat buttons)
 */

import { useCallback } from 'react'
import { useGame, useNow } from './GameProvider'
import { applyDelta, DEPLETING_KEYS, PLAYER_TRADABLE_KEYS, setDepletion, setGameTime } from './state'
import type { DepletingKey, HistoryEntry } from './state'
import { requiredDefense } from '../shared/combat'
import { tradeLegs } from '../shared/trade-book'
import type { Attack, Delta, MarketEntry, OrderReceipt, ResourceKey, TradableKey, Trade, TradeRequestInput } from '../shared/types'

export { RESOURCE_KEYS, TRADE_TTL_MS } from '../shared/types'
export { ATTACK_ARRIVAL_TIME } from '../shared/types'
export { DEPLETING_KEYS, PLAYER_TRADABLE_KEYS }
export type { Delta, DepletingKey, HistoryEntry, MarketEntry, OrderReceipt, ResourceKey, TradableKey, TradeRequestInput }

// ---- Resources --------------------------------------------------------------

type VisibleResourceKey = Exclude<ResourceKey, 'metal' | 'buildings'>
/** `{ money, ammo, biomass, oxygen, health }` — current amounts (excludes metal and buildings). */
export function useResources(): Record<VisibleResourceKey, number> {
  const resources = useGame().state.resources
  const { buildings, metal, ...visible } = resources
  return visible
}

// ---- Game time ------------------------------------------------------------------

export interface GameTime {
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
  const { state, store } = useGame()
  return { seconds: state.gameTime, set: (seconds) => store.update((s) => setGameTime(s, seconds)) }
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

// ---- Combat ---------------------------------------------------------------------

export interface AttackView extends Attack {
  /** Whole seconds left to respond (0 when the attack has landed). */
  secondsLeft: number
  /** Ammo that fully defends against it (no harm taken). */
  requiredDefense: number
}

export interface Combat {
  /** Names you can attack (emails also work). */
  players: string[]
  /** Attacks aimed at you that you can still respond to. */
  incoming: AttackView[]
  /** Your attacks still waiting for a response. */
  outgoing: AttackView[]
  /** Spend `ammo` to attack a player. Throws if you lack the ammo or the player is unknown. */
  attack: (to: string, ammo: number) => Promise<void>
  /** Respond to an attack with `ammo` (0 = take it). Resolves it immediately. */
  defend: (attackId: string, ammo: number) => Promise<void>
}

export function useCombat(): Combat {
  const { net, engine } = useGame()
  const now = useNow(500)
  const view = (a: Attack): AttackView => ({
    ...a,
    secondsLeft: Math.max(0, Math.ceil((a.expiresAt - (now + net.clockSkew)) / 1000)),
    requiredDefense: requiredDefense(a.ammo),
  })
  return {
    players: net.players,
    incoming: net.incomingAttacks.map(view),
    outgoing: net.outgoingAttacks.map(view),
    attack: async (to, ammo) => void (await engine.attack(to, ammo)),
    defend: async (id, ammo) => void (await engine.defend(id, ammo)),
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
