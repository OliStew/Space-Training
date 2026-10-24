import { describe, expect, it } from 'vitest'
import { AppMarketsRoom } from './markets'

function fakeState() {
  const data = new Map<string, unknown>()
  let alarm: number | null = null
  let ready: Promise<void> = Promise.resolve()
  const storage = {
    get: async (k: string) => data.get(k),
    put: async (k: string | Record<string, unknown>, v?: unknown) => {
      if (typeof k === 'string') data.set(k, v)
      else Object.entries(k).forEach(([a, b]) => data.set(a, b))
    },
    getAlarm: async () => alarm,
    setAlarm: async (t: number) => void (alarm = t),
  }
  // Like the runtime, hold every request until the constructor's init has finished.
  const state = { storage, blockConcurrencyWhile: (fn: () => Promise<void>) => void (ready = fn()) }
  return { state: state as unknown as DurableObjectState, ready: () => ready }
}

async function makeRoom() {
  const { state, ready } = fakeState()
  const room = new AppMarketsRoom(state, {})
  await ready()
  return room
}

const call = async (room: AppMarketsRoom, path: string, body?: unknown, method = body ? 'POST' : 'GET') => {
  const res = await room.fetch(new Request(`https://internal${path}`, { method, body: body ? JSON.stringify(body) : undefined }))
  return { status: res.status, body: (await res.json()) as any }
}

describe('AppMarketsRoom', () => {
  it('seeds markets with buy > sell and schedules the cycle', async () => {
    const room = await makeRoom()
    const { body } = await call(room, '/snapshot')
    expect(body.markets.length).toBeGreaterThan(1)
    const p = body.markets[0].prices.metal
    expect(p.buy).toBeGreaterThan(p.sell)
    expect(body.nextUpdateAt).toBeGreaterThan(Date.now())
  })

  it('executes orders at the current price and shifts prices by net volume at the cycle end', async () => {
    const room = await makeRoom()
    await call(room, '/markets', { name: 'T', prices: { metal: { buy: 11, sell: 9 } } })
    const order = (side: string, quantity: number, expectedPrice?: number) =>
      call(room, '/order', { side, market: 'T', resource: 'metal', quantity, expectedPrice })

    expect((await order('buy', 10, 11)).body.receipt).toMatchObject({ price: 11, total: 110 })
    await order('buy', 5)
    await order('sell', 5)
    // Immediate effect: none — prices are unchanged until the cycle ends.
    expect((await call(room, '/snapshot')).body.markets.find((m: any) => m.name === 'T').prices.metal.buy).toBe(11)
    // Net volume = +10 buys → +10%.
    await room.alarm()
    const prices = (await call(room, '/snapshot')).body.markets.find((m: any) => m.name === 'T').prices.metal
    expect(prices.buy).toBeCloseTo(12.1)
    expect(prices.sell).toBeCloseTo(9.9)
    // Volume was cleared: another cycle with no orders leaves prices alone.
    await room.alarm()
    expect((await call(room, '/snapshot')).body.markets.find((m: any) => m.name === 'T').prices.metal.buy).toBeCloseTo(12.1)
  })

  it('rejects stale prices and bad orders', async () => {
    const room = await makeRoom()
    await call(room, '/markets', { name: 'T', prices: { metal: { buy: 11, sell: 9 } } })
    const stale = await call(room, '/order', { side: 'buy', market: 'T', resource: 'metal', quantity: 1, expectedPrice: 10 })
    expect(stale).toMatchObject({ status: 409, body: { code: 'price_changed' } })
    for (const bad of [{ quantity: 0 }, { quantity: 1.5 }, { resource: 'money' }, { market: 'Nope' }, { side: 'x' }]) {
      const r = await call(room, '/order', { side: 'buy', market: 'T', resource: 'metal', quantity: 1, ...bad })
      expect(r.status).toBeGreaterThanOrEqual(400)
    }
  })

  it('updates config and reschedules when the interval changes', async () => {
    const room = await makeRoom()
    const r = await call(room, '/config', { batchInterval: 5, interest: 1 })
    expect(r.body.config).toMatchObject({ batchInterval: 5, interest: 1, effect: 1 })
    expect((await call(room, '/config', { batchInterval: 0 })).status).toBe(400)
    const snap = (await call(room, '/snapshot')).body
    expect(snap.nextUpdateAt - Date.now()).toBeLessThanOrEqual(5000)
  })
})
