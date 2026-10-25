import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import type { GameApi } from './api'
import { TradingEngine } from './engine'
import { GameStore } from './store'
import { tick } from './state'
import {
  ackTrade, acceptTrade, cancelTrade, createTrade, declineTrade, emptyBook, isFail,
  playerNames, registerPlayer, tradesFor,
} from '../shared/trade-book'
import type { BookResult } from '../shared/trade-book'
import { DEFAULT_MARKETS_CONFIG } from '../shared/types'
import type { MarketEntry } from '../shared/types'

/** In-memory stand-in for the worker, backed by the real trade book. */
function fakeServer(clock: { now: number }) {
  const book = emptyBook()
  const markets: MarketEntry[] = [{ name: 'M', prices: { metal: { buy: 11, sell: 9 } } }]
  const volumes: { side: string; qty: number }[] = []
  const unwrap = <T>(r: BookResult<T>): T => {
    if (isFail(r)) throw new ApiError(r.error)
    return r.value
  }
  const apiFor = (userId: string): GameApi & { dropNext?: boolean } => {
    const api: GameApi & { dropNext?: boolean } = {
      async snapshot() {
        return { markets: structuredClone(markets), config: DEFAULT_MARKETS_CONFIG, nextUpdateAt: clock.now + 30000, serverTime: clock.now }
      },
      async order(side, market, resource, quantity, expected) {
        const price = side === 'buy' ? markets[0].prices.metal.buy : markets[0].prices.metal.sell
        if (Math.abs(price - expected) > 1e-6) throw new ApiError('Price has changed', 'price_changed')
        volumes.push({ side, qty: quantity })
        return { side, market, resource, quantity, price, total: price * quantity, nextUpdateAt: null }
      },
      async syncTrades(p) {
        registerPlayer(book, userId, p.name, p.email, clock.now)
        return { trades: tradesFor(book, userId, clock.now), serverTime: clock.now, players: playerNames(book, userId) }
      },
      async sendTrade(id, trade) {
        const t = unwrap(createTrade(book, userId, trade, id, clock.now))
        if (api.dropNext) {
          api.dropNext = false
          throw new TypeError('network down') // request reached the server, response lost
        }
        return t
      },
      acceptTrade: async (id) => unwrap(acceptTrade(book, userId, id, clock.now)),
      declineTrade: async (id) => unwrap(declineTrade(book, userId, id, clock.now)),
      cancelTrade: async (id) => unwrap(cancelTrade(book, userId, id, clock.now)),
      ackTrade: async (id) => ackTrade(book, userId, id, clock.now),
    }
    return api
  }
  return { apiFor, volumes, markets, book }
}

function setup() {
  const clock = { now: 1_000_000 }
  const server = fakeServer(clock)
  let n = 0
  const make = (id: string, name: string) => {
    const store = new GameStore(null, `k-${id}`, () => clock.now)
    const api = server.apiFor(id)
    const engine = new TradingEngine(store, api, () => ({ id, name }), () => clock.now, () => `trade-${id}-${++n}00000`)
    return { store, engine, api }
  }
  return { clock, server, alice: make('u1', 'Alice'), bob: make('u2', 'Bob') }
}
const res = (p: { store: GameStore }) => p.store.get().resources

describe('depletion', () => {
  it('drains biomass and oxygen at the configured rate, never below zero', () => {
    const { clock, alice } = setup()
    const s = alice.store.get()
    const later = tick({ ...s, depletion: { biomass: 1, oxygen: 2 } }, clock.now + 10_000)
    expect(later.resources.biomass).toBeCloseTo(90)
    expect(later.resources.oxygen).toBeCloseTo(80)
    expect(tick({ ...s, depletion: { biomass: 1000, oxygen: 0 } }, clock.now + 10_000).resources.biomass).toBe(0)
  })
})

describe('game time', () => {
  it('starts at 0 and advances with the clock', () => {
    const { clock, alice } = setup()
    expect(alice.store.get().gameTime).toBe(0)
    alice.store.update((s) => tick(s, clock.now + 5_500))
    expect(alice.store.get().gameTime).toBeCloseTo(5.5)
  })
})

describe('market orders', () => {
  /** Let every in-transit trade arrive. */
  const arrive = (a: ReturnType<typeof setup>, p: { store: GameStore }) => {
    a.clock.now += 61_000
    p.store.update((s) => tick(s, a.clock.now))
  }

  it('assigns one market each of 60s / 40s / 20s per player, and keeps it', async () => {
    for (let i = 0; i < 20; i++) {
      const a = setup()
      a.server.markets.push({ name: 'N', prices: { metal: { buy: 11, sell: 9 } } }, { name: 'O', prices: { metal: { buy: 11, sell: 9 } } })
      await a.alice.engine.refreshMarkets()
      expect(Object.values(a.alice.store.get().marketDelays).sort()).toEqual([20, 40, 60])
      const before = { ...a.alice.store.get().marketDelays }
      await a.alice.engine.refreshMarkets()
      expect(a.alice.store.get().marketDelays).toEqual(before)
    }
  })

  it('buy: money leaves now, goods arrive after the delay at the locked price', async () => {
    const a = setup()
    await a.alice.engine.refreshMarkets()
    const delay = a.alice.store.get().marketDelays.M
    await a.alice.engine.buyFromMarket('M', 'metal', 10)
    expect(res(a.alice).money).toBeCloseTo(1000 - 110)
    expect(res(a.alice).metal).toBe(100) // not yet
    expect(Object.keys(a.alice.store.get().deliveries)).toHaveLength(1)
    a.server.markets[0].prices.metal = { buy: 50, sell: 45 } // price move can't affect it
    a.clock.now += delay * 1000 - 1
    a.alice.store.update((s) => tick(s, a.clock.now))
    expect(res(a.alice).metal).toBe(100)
    a.clock.now += 1
    a.alice.store.update((s) => tick(s, a.clock.now))
    expect(res(a.alice)).toMatchObject({ metal: 110 })
    expect(res(a.alice).money).toBeCloseTo(890)
    a.alice.store.update((s) => tick(s, a.clock.now + 1000)) // paid exactly once
    expect(res(a.alice).metal).toBe(110)
    expect(Object.keys(a.alice.store.get().deliveries)).toHaveLength(0)
  })

  it('sell: goods leave now, money arrives after the delay', async () => {
    const a = setup()
    await a.alice.engine.refreshMarkets()
    await a.alice.engine.sellToMarket('M', 'metal', 20)
    expect(res(a.alice).metal).toBe(80)
    expect(res(a.alice).money).toBe(1000)
    arrive(a, a.alice)
    expect(res(a.alice).money).toBeCloseTo(1180)
  })

  it('records volume immediately', async () => {
    const a = setup()
    await a.alice.engine.refreshMarkets()
    await a.alice.engine.buyFromMarket('M', 'metal', 10)
    await a.alice.engine.sellToMarket('M', 'metal', 20)
    expect(a.server.volumes).toEqual([{ side: 'buy', qty: 10 }, { side: 'sell', qty: 20 }])
  })

  it('refuses unaffordable orders and refunds when the price moved', async () => {
    const { server, alice } = setup()
    await alice.engine.refreshMarkets()
    await expect(alice.engine.buyFromMarket('M', 'metal', 1000)).rejects.toThrow(/Not enough money/)
    await expect(alice.engine.sellToMarket('M', 'metal', 1000)).rejects.toThrow(/Not enough metal/)
    server.markets[0].prices.metal = { buy: 20, sell: 18 }
    await expect(alice.engine.buyFromMarket('M', 'metal', 1)).rejects.toThrow(/changed/)
    expect(res(alice).money).toBe(1000)
    expect(Object.keys(alice.store.get().deliveries)).toHaveLength(0)
  })

  it('cannot spend the same money twice while a delivery is pending', async () => {
    const a = setup()
    await a.alice.engine.refreshMarkets()
    await a.alice.engine.buyFromMarket('M', 'metal', 90) // 990
    await expect(a.alice.engine.buyFromMarket('M', 'metal', 5)).rejects.toThrow(/Not enough money/)
  })
})

describe('buildings', () => {
  it('cannot be traded client-side', async () => {
    const { alice } = setup()
    await alice.engine.syncTrades()
    await expect(alice.engine.sendTrade({ to: 'bob', side: 'sell', resource: 'buildings', quantity: 1, unitPrice: 1 })).rejects.toThrow(/cannot be traded/)
    await expect(alice.engine.buyFromMarket('M', 'buildings', 1)).rejects.toThrow(/cannot be traded/)
  })
})

describe('player trades', () => {
  async function offer(a: ReturnType<typeof setup>, side: 'buy' | 'sell' = 'sell') {
    await a.alice.engine.syncTrades()
    await a.bob.engine.syncTrades()
    await a.alice.engine.sendTrade({ to: 'bob', side, resource: 'metal', quantity: 10, unitPrice: 5 })
    await a.bob.engine.syncTrades()
  }

  it('moves resources both ways when accepted (requester sells)', async () => {
    const a = setup()
    await offer(a)
    expect(res(a.alice).metal).toBe(90) // reserved
    expect(a.bob.engine.net.get().incoming).toHaveLength(1)
    await a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)
    await a.alice.engine.syncTrades()
    expect(res(a.alice)).toMatchObject({ metal: 90, money: 1050 })
    expect(res(a.bob)).toMatchObject({ metal: 110, money: 950 })
    // Settled exactly once, however often we sync.
    await a.alice.engine.syncTrades()
    await a.alice.engine.syncTrades()
    expect(res(a.alice)).toMatchObject({ metal: 90, money: 1050 })
    expect(Object.keys(a.alice.store.get().holds)).toHaveLength(0)
  })

  it('works when the requester buys', async () => {
    const a = setup()
    await offer(a, 'buy')
    expect(res(a.alice).money).toBe(950)
    await a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)
    await a.alice.engine.syncTrades()
    expect(res(a.alice)).toMatchObject({ metal: 110, money: 950 })
    expect(res(a.bob)).toMatchObject({ metal: 90, money: 1050 })
  })

  it('refuses to send what the requester cannot afford', async () => {
    const a = setup()
    await a.alice.engine.syncTrades()
    await a.bob.engine.syncTrades()
    await expect(a.alice.engine.sendTrade({ to: 'bob', side: 'sell', resource: 'metal', quantity: 101, unitPrice: 1 })).rejects.toThrow(/Not enough metal/)
    await expect(a.alice.engine.sendTrade({ to: 'bob', side: 'buy', resource: 'metal', quantity: 10, unitPrice: 101 })).rejects.toThrow(/Not enough money/)
    expect(res(a.alice)).toMatchObject({ metal: 100, money: 1000 })
  })

  it('refuses acceptance the recipient cannot afford, leaving the offer open', async () => {
    const a = setup()
    await a.alice.engine.syncTrades()
    await a.bob.engine.syncTrades()
    await a.alice.engine.sendTrade({ to: 'bob', side: 'sell', resource: 'metal', quantity: 1, unitPrice: 5000 })
    await a.bob.engine.syncTrades()
    await expect(a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)).rejects.toThrow(/afford/)
    expect(res(a.bob).money).toBe(1000)
  })

  it('refunds the requester when the trade expires after 15s', async () => {
    const a = setup()
    await offer(a)
    a.clock.now += 16_000
    await expect(a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)).rejects.toThrow(/expired/)
    await a.alice.engine.syncTrades()
    expect(res(a.alice).metal).toBe(100)
    expect(Object.keys(a.alice.store.get().holds)).toHaveLength(0)
  })

  it('rolls back the recipient if the server rejects a late accept', async () => {
    const a = setup()
    await offer(a)
    a.clock.now += 16_000
    // Bob's local view of time lags; the server is the judge.
    a.bob.engine.net.set({ ...a.bob.engine.net.get(), clockSkew: -60_000 })
    await expect(a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)).rejects.toThrow(/expired/)
    expect(res(a.bob)).toMatchObject({ money: 1000, metal: 100 })
  })

  it('refunds on decline and cancel', async () => {
    const a = setup()
    await offer(a)
    await a.bob.engine.declineTrade(a.bob.engine.net.get().incoming[0].id)
    await a.alice.engine.syncTrades()
    expect(res(a.alice).metal).toBe(100)

    await a.alice.engine.sendTrade({ to: 'bob', side: 'buy', resource: 'metal', quantity: 1, unitPrice: 10 })
    expect(res(a.alice).money).toBe(990)
    await a.alice.engine.syncTrades()
    await a.alice.engine.cancelTrade(a.alice.engine.net.get().outgoing[0].id)
    expect(res(a.alice).money).toBe(1000)
  })

  it('does not refund on a lost response; sync settles from the real outcome', async () => {
    const a = setup()
    await a.alice.engine.syncTrades()
    await a.bob.engine.syncTrades()
    a.alice.api.dropNext = true
    await expect(a.alice.engine.sendTrade({ to: 'bob', side: 'sell', resource: 'metal', quantity: 10, unitPrice: 5 })).rejects.toThrow()
    expect(res(a.alice).metal).toBe(90) // still reserved
    await a.bob.engine.syncTrades()
    await a.bob.engine.acceptTrade(a.bob.engine.net.get().incoming[0].id)
    await a.alice.engine.syncTrades()
    expect(res(a.alice)).toMatchObject({ metal: 90, money: 1050 })
  })

  it('rejects unknown recipients and gives the reserved funds back', async () => {
    const a = setup()
    await a.alice.engine.syncTrades()
    await expect(a.alice.engine.sendTrade({ to: 'nobody', side: 'sell', resource: 'metal', quantity: 1, unitPrice: 1 })).rejects.toThrow(/No player/)
    expect(res(a.alice).metal).toBe(100)
  })
})
