/**
 * The trading engine: everything a player can do with markets and other
 * players, independent of any UI. Owns the polling of server state and keeps
 * the persisted GameStore consistent with it.
 *
 * Money safety model (balances are client-side, the server only arbitrates):
 *  - Anything promised is deducted *first* (market orders, trade holds) and
 *    refunded if the server definitively refuses.
 *  - Trades use holds (see state.ts) so each outcome is applied exactly once,
 *    and ambiguous network failures never refund early.
 */

import { round2 } from '../shared/pricing'
import { tradeLegs, validateRequest } from '../shared/trade-book'
import { TRADE_TTL_MS } from '../shared/types'
import type { MarketEntry, MarketPrice, MarketsConfig, OrderReceipt, TradableKey, Trade, TradeRequestInput } from '../shared/types'
import { ApiError } from './api'
import type { GameApi } from './api'
import { Observable } from './observable'
import { addHistory, applyDelta, assignMarketDelays, cancelDelivery, isPlayerTradable, placeDelivery, placeHold, releaseHold, resolveHold, spend } from './state'
import type { Delivery, Hold } from './state'
import type { GameStore } from './store'

export interface NetState {
  markets: MarketEntry[]
  config: MarketsConfig | null
  /** Epoch ms (server clock) of the next price update. */
  nextUpdateAt: number | null
  /** serverTime - clientTime; add to Date.now() to get server time. */
  clockSkew: number
  /** Pending trade requests other players sent to you. */
  incoming: Trade[]
  /** Your pending trade requests. */
  outgoing: Trade[]
  /** Names of players you can trade with. */
  players: string[]
  error: string | null
}

export interface Profile {
  /** The signed-in user's id. */
  id: string
  name: string
  email?: string
}

/** A hold older than this with no sign of its trade on the server is refunded. */
const ORPHAN_HOLD_MS = TRADE_TTL_MS * 4

export class TradingEngine {
  readonly net = new Observable<NetState>({
    markets: [],
    config: null,
    nextUpdateAt: null,
    clockSkew: 0,
    incoming: [],
    outgoing: [],
    players: [],
    error: null,
  })

  private timers: ReturnType<typeof setInterval>[] = []
  private syncing: Promise<void> | null = null

  constructor(
    private store: GameStore,
    private api: GameApi,
    private profile: () => Profile,
    private now: () => number = Date.now,
    private newId: () => string = () => crypto.randomUUID(),
  ) {}

  // ---- Lifecycle ----------------------------------------------------------

  start(marketsEveryMs = 3000, tradesEveryMs = 2000): () => void {
    this.stop()
    void this.refreshMarkets()
    void this.syncTrades()
    this.timers = [
      setInterval(() => void this.refreshMarkets(), marketsEveryMs),
      setInterval(() => void this.syncTrades(), tradesEveryMs),
    ]
    return () => this.stop()
  }

  stop() {
    this.timers.forEach(clearInterval)
    this.timers = []
  }

  private patch(p: Partial<NetState>) {
    this.net.set({ ...this.net.get(), ...p })
  }

  // ---- Markets ------------------------------------------------------------

  async refreshMarkets(): Promise<void> {
    try {
      const snap = await this.api.snapshot()
      this.patch({
        markets: snap.markets,
        config: snap.config,
        nextUpdateAt: snap.nextUpdateAt,
        clockSkew: snap.serverTime - this.now(),
        error: null,
      })
      this.store.update((s) => assignMarketDelays(s, snap.markets.map((m) => m.name)))
    } catch (e) {
      this.patch({ error: message(e) })
    }
  }

  priceOf(market: string, resource: TradableKey): MarketPrice | undefined {
    return this.net.get().markets.find((m) => m.name === market)?.prices[resource]
  }

  buyFromMarket(market: string, resource: TradableKey, quantity: number): Promise<OrderReceipt> {
    return this.marketOrder('buy', market, resource, quantity)
  }

  sellToMarket(market: string, resource: TradableKey, quantity: number): Promise<OrderReceipt> {
    return this.marketOrder('sell', market, resource, quantity)
  }

  private async marketOrder(side: 'buy' | 'sell', market: string, resource: TradableKey, quantity: number): Promise<OrderReceipt> {
    if (!isPlayerTradable(resource)) throw new Error(`${resource} cannot be traded`)
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Quantity must be a whole number of at least 1')
    const price = this.priceOf(market, resource)
    if (!price) throw new Error(`${market} does not trade ${resource}`)
    const unit = side === 'buy' ? price.buy : price.sell
    const money = round2(unit * quantity)
    // The paying side leaves now; the other side arrives after this market's travel time.
    const give = side === 'buy' ? { money } : { [resource]: quantity }
    const receive = side === 'buy' ? { [resource]: quantity } : { money }
    const delaySeconds = this.store.get().marketDelays[market] ?? 0
    const created = this.now()
    const delivery: Delivery = {
      id: this.newId(),
      market,
      side,
      resource,
      quantity,
      unitPrice: unit,
      total: money,
      createdAt: created,
      completesAt: created + delaySeconds * 1000,
      receive,
    }
    // Check affordability and reserve in one step so rapid clicks can't overspend.
    if (!this.store.tryUpdate((s) => placeDelivery(s, give, delivery))) {
      throw new Error(side === 'buy' ? `Not enough money (need ${money.toFixed(2)})` : `Not enough ${resource}`)
    }
    let receipt: OrderReceipt
    try {
      receipt = await this.api.order(side, market, resource, quantity, unit)
    } catch (e) {
      this.store.update((s) => cancelDelivery(s, delivery.id, give))
      if (e instanceof ApiError && e.code === 'price_changed') {
        void this.refreshMarkets()
        throw new Error('Prices just changed — review the new price and try again')
      }
      throw e
    }
    this.store.update((s) =>
      addHistory(
        s,
        `${side === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${resource} ${side === 'buy' ? 'from' : 'to'} ${market} @ ${unit.toFixed(2)} (${money.toFixed(2)}); ${side === 'buy' ? 'arrives' : 'paid'} in ${delaySeconds}s`,
        this.now(),
      ),
    )
    this.patch({ nextUpdateAt: receipt.nextUpdateAt ?? this.net.get().nextUpdateAt })
    return receipt
  }

  // ---- Player-to-player trades -----------------------------------------------

  /** Send a trade request. Your side is reserved until it resolves. */
  async sendTrade(input: TradeRequestInput): Promise<Trade> {
    const invalid = validateRequest(input)
    if (invalid) throw new Error(invalid)
    if (!isPlayerTradable(input.resource)) throw new Error(`${input.resource} cannot be traded`)
    const total = round2(input.quantity * input.unitPrice)
    const id = this.newId()
    const { give, receive } = tradeLegs({ ...input, total }, 'requester')
    const hold: Hold = {
      tradeId: id,
      role: 'requester',
      give,
      receive,
      createdAt: this.now(),
      summary: { ...pick(input), total, counterparty: input.to.trim() },
    }
    if (!this.store.tryUpdate((s) => placeHold(s, hold))) {
      throw new Error(input.side === 'sell' ? `Not enough ${input.resource} to offer` : `Not enough money (need ${total.toFixed(2)})`)
    }
    try {
      const trade = await this.api.sendTrade(id, input)
      void this.syncTrades()
      return trade
    } catch (e) {
      // Only a definite refusal releases the hold; if the request may have
      // reached the server, sync resolves it from the trade's actual state.
      if (e instanceof ApiError) this.store.update((s) => releaseHold(s, id))
      throw e
    }
  }

  /** Accept an incoming request. Needs to afford your side and be inside the 15s window. */
  async acceptTrade(id: string): Promise<void> {
    const trade = this.net.get().incoming.find((t) => t.id === id)
    if (!trade) throw new Error('That trade request is no longer available')
    if (!isPlayerTradable(trade.resource)) throw new Error(`${trade.resource} cannot be traded`)
    if (this.serverNow() > trade.expiresAt) throw new Error('This trade request expired')
    const { give, receive } = tradeLegs(trade, 'recipient')
    const hold: Hold = {
      tradeId: id,
      role: 'recipient',
      give,
      receive,
      createdAt: this.now(),
      summary: { ...pick(trade), counterparty: trade.fromName },
    }
    if (!this.store.tryUpdate((s) => placeHold(s, hold))) {
      throw new Error(give.money ? `You can't afford this (need ${trade.total.toFixed(2)})` : `You don't have ${trade.quantity} ${trade.resource}`)
    }
    try {
      await this.api.acceptTrade(id)
    } catch (e) {
      if (e instanceof ApiError) {
        this.store.update((s) => resolveHold(s, id, false, this.now(), 'expired or withdrawn'))
        void this.syncTrades()
      }
      throw e
    }
    this.store.update((s) => resolveHold(s, id, true, this.now()))
    this.dropLocal(id)
    void this.api.ackTrade(id).catch(() => {})
  }

  async declineTrade(id: string): Promise<void> {
    await this.api.declineTrade(id)
    this.dropLocal(id)
  }

  /** Withdraw your own pending request; your reserved resources come back on the next sync. */
  async cancelTrade(id: string): Promise<void> {
    await this.api.cancelTrade(id)
    await this.syncTrades()
  }

  serverNow(): number {
    return this.now() + this.net.get().clockSkew
  }

  /** Poll the server and settle any trade whose outcome is known. Calls overlap safely. */
  syncTrades(): Promise<void> {
    this.syncing ??= this.doSync().finally(() => (this.syncing = null))
    return this.syncing
  }

  private async doSync(): Promise<void> {
    const me = this.profile()
    if (!me.id || !me.name) return
    let result
    try {
      result = await this.api.syncTrades(me)
    } catch (e) {
      this.patch({ error: message(e) })
      return
    }
    const now = this.now()
    const seen = new Set(result.trades.map((t) => t.id))

    for (const trade of result.trades) {
      if (trade.status === 'pending') continue
      const hold = this.store.get().holds[trade.id]
      if (hold) {
        const note = trade.status === 'expired' ? 'expired' : trade.status
        this.store.update((s) => resolveHold(s, trade.id, trade.status === 'accepted', now, note))
      }
      // Whatever its outcome, we have now applied it (or never had a stake): stop hearing about it.
      void this.api.ackTrade(trade.id).catch(() => {})
    }
    // Holds whose trade the server no longer knows about (lost request) are refunded.
    for (const hold of Object.values(this.store.get().holds)) {
      if (!seen.has(hold.tradeId) && now - hold.createdAt > ORPHAN_HOLD_MS) {
        this.store.update((s) => resolveHold(s, hold.tradeId, false, now, 'not delivered'))
      }
    }

    const pending = result.trades.filter((t) => t.status === 'pending')
    const holds = this.store.get().holds
    this.patch({
      incoming: pending.filter((t) => t.to === me.id && !holds[t.id]),
      outgoing: pending.filter((t) => t.from === me.id),
      players: result.players,
      clockSkew: result.serverTime - now,
      error: null,
    })
  }

  private dropLocal(id: string) {
    const n = this.net.get()
    this.patch({ incoming: n.incoming.filter((t) => t.id !== id) })
  }
}

const pick = (t: Pick<Trade, 'side' | 'resource' | 'quantity' | 'unitPrice'> & { total?: number }) => ({
  side: t.side,
  resource: t.resource,
  quantity: t.quantity,
  unitPrice: t.unitPrice,
  total: t.total ?? round2(t.quantity * t.unitPrice),
})

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))
