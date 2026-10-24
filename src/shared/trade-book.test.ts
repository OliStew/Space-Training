import { describe, expect, it } from 'vitest'
import {
  ackTrade, acceptTrade, cancelTrade, createTrade, declineTrade, emptyBook, isFail,
  registerPlayer, tradeLegs, tradesFor,
} from './trade-book'
import { TRADE_TTL_MS } from './types'
import type { TradeRequestInput } from './types'

function setup() {
  const book = emptyBook()
  registerPlayer(book, 'u1', 'Alice', 'alice@x.com', 0)
  registerPlayer(book, 'u2', 'Bob', undefined, 0)
  return book
}
const req = (over: Partial<TradeRequestInput> = {}): TradeRequestInput => ({
  to: 'bob', side: 'sell', resource: 'metal', quantity: 10, unitPrice: 2.5, ...over,
})

describe('trade book', () => {
  it('creates a pending trade addressed by name or email, 15s window', () => {
    const book = setup()
    const r = createTrade(book, 'u1', req(), 'trade-001', 1000)
    if (isFail(r)) throw new Error(r.error)
    expect(r.value).toMatchObject({ to: 'u2', total: 25, status: 'pending', expiresAt: 1000 + TRADE_TTL_MS })
    expect(isFail(createTrade(book, 'u2', req({ to: 'ALICE@x.com' }), 'trade-002', 1000))).toBe(false)
  })

  it('rejects bad input, unknown players, and self-trades', () => {
    const book = setup()
    expect(isFail(createTrade(book, 'u1', req({ to: 'nobody' }), 'trade-xyz', 0))).toBe(true)
    expect(isFail(createTrade(book, 'u1', req({ to: 'alice' }), 'trade-xyz', 0))).toBe(true)
    expect(isFail(createTrade(book, 'u1', req({ quantity: 0 }), 'trade-xyz', 0))).toBe(true)
    expect(isFail(createTrade(book, 'u1', req({ quantity: 1.5 }), 'trade-xyz', 0))).toBe(true)
    expect(isFail(createTrade(book, 'u1', req({ unitPrice: -1 }), 'trade-xyz', 0))).toBe(true)
    expect(isFail(createTrade(book, 'u1', req({ resource: 'money' as never }), 'trade-xyz', 0))).toBe(true)
  })

  it('reports ambiguous names', () => {
    const book = setup()
    registerPlayer(book, 'u3', 'bob', undefined, 0)
    const r = createTrade(book, 'u1', req(), 'trade-xyz', 0)
    expect(isFail(r) && r.error).toMatch(/email/)
  })

  it('accepts once, only by the recipient, only within 15s', () => {
    const book = setup()
    createTrade(book, 'u1', req(), 'trade-001', 0)
    expect(isFail(acceptTrade(book, 'u1', 'trade-001', 1))).toBe(true)
    expect(isFail(acceptTrade(book, 'u2', 'trade-001', TRADE_TTL_MS + 1))).toBe(true)
    expect(book.trades['trade-001'].status).toBe('expired')

    createTrade(book, 'u1', req(), 'trade-002', 0)
    expect(isFail(acceptTrade(book, 'u2', 'trade-002', TRADE_TTL_MS))).toBe(false)
    expect(isFail(acceptTrade(book, 'u2', 'trade-002', TRADE_TTL_MS))).toBe(true)
  })

  it('lets the requester cancel and the recipient decline, but not after resolution', () => {
    const book = setup()
    createTrade(book, 'u1', req(), 'trade-aaa', 0)
    expect(isFail(cancelTrade(book, 'u2', 'trade-aaa', 1))).toBe(true)
    expect(isFail(cancelTrade(book, 'u1', 'trade-aaa', 1))).toBe(false)
    expect(isFail(acceptTrade(book, 'u2', 'trade-aaa', 2))).toBe(true)
    createTrade(book, 'u1', req(), 'trade-bbb', 0)
    expect(isFail(declineTrade(book, 'u2', 'trade-bbb', 1))).toBe(false)
  })

  it('shows outcomes until acked, then forgets them', () => {
    const book = setup()
    createTrade(book, 'u1', req(), 'trade-xyz', 0)
    expect(tradesFor(book, 'u2', 1)).toHaveLength(1)
    acceptTrade(book, 'u2', 'trade-xyz', 2)
    expect(tradesFor(book, 'u1', 3)).toHaveLength(1)
    expect(tradesFor(book, 'u2', 3)).toHaveLength(1)
    ackTrade(book, 'u1', 'trade-xyz', 4)
    expect(tradesFor(book, 'u1', 5)).toHaveLength(0)
    expect(tradesFor(book, 'u2', 5)).toHaveLength(1)
    ackTrade(book, 'u2', 'trade-xyz', 6)
    expect(book.trades['trade-xyz']).toBeUndefined()
  })

  it('only the requester hears about declined trades', () => {
    const book = setup()
    createTrade(book, 'u1', req(), 'trade-xyz', 0)
    declineTrade(book, 'u2', 'trade-xyz', 1)
    expect(tradesFor(book, 'u2', 2)).toHaveLength(0)
    expect(tradesFor(book, 'u1', 2)).toHaveLength(1)
  })

  it('computes legs for each side', () => {
    const sell = { side: 'sell', resource: 'metal', quantity: 10, total: 25 } as const
    expect(tradeLegs(sell, 'requester')).toEqual({ give: { metal: 10 }, receive: { money: 25 } })
    expect(tradeLegs(sell, 'recipient')).toEqual({ give: { money: 25 }, receive: { metal: 10 } })
    const buy = { ...sell, side: 'buy' } as const
    expect(tradeLegs(buy, 'requester')).toEqual({ give: { money: 25 }, receive: { metal: 10 } })
  })
})
