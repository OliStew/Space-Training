/**
 * Trades Durable Object (single instance per app).
 *
 * Holds the player directory and pending player-to-player trade requests.
 * Every call carries the caller's verified `userId` (set by the action layer,
 * never by the browser). Logic lives in shared/trade-book.ts.
 */

import {
  ackTrade,
  acceptTrade,
  cancelTrade,
  createTrade,
  declineTrade,
  emptyBook,
  isFail,
  playerNames,
  registerPlayer,
  tradesFor,
} from '../shared/trade-book'
import type { BookResult, TradeBookState } from '../shared/trade-book'
import type { TradeRequestInput, TradeSyncResult } from '../shared/types'

const json = (body: unknown, status = 200) => Response.json(body, { status })

export class AppTradesRoom {
  private storage: DurableObjectStorage
  private book: TradeBookState = emptyBook()

  constructor(state: DurableObjectState, _env: unknown) {
    this.storage = state.storage
    state.blockConcurrencyWhile(async () => {
      this.book = (await this.storage.get<TradeBookState>('book')) ?? emptyBook()
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const userId = typeof body.userId === 'string' ? body.userId : ''
    if (!userId) return json({ error: 'userId required' }, 400)
    const now = Date.now()
    const id = typeof body.id === 'string' ? body.id : ''

    // The DO is single-threaded and these handlers never await between reading
    // and writing `book`, so each operation is atomic.
    let result: BookResult<unknown>
    switch (url.pathname) {
      case '/sync': {
        const name = typeof body.name === 'string' ? body.name : ''
        const email = typeof body.email === 'string' ? body.email : undefined
        registerPlayer(this.book, userId, name, email, now)
        const value: TradeSyncResult & { players: string[] } = {
          trades: tradesFor(this.book, userId, now),
          serverTime: now,
          players: playerNames(this.book, userId),
        }
        result = { ok: true, value }
        break
      }
      case '/send':
        result = createTrade(this.book, userId, (body.trade && typeof body.trade === 'object' ? body.trade : {}) as TradeRequestInput, id, now)
        break
      case '/accept':
        result = acceptTrade(this.book, userId, id, now)
        break
      case '/decline':
        result = declineTrade(this.book, userId, id, now)
        break
      case '/cancel':
        result = cancelTrade(this.book, userId, id, now)
        break
      case '/ack':
        ackTrade(this.book, userId, id, now)
        result = { ok: true, value: {} }
        break
      default:
        return json({ error: 'Not Found' }, 404)
    }

    await this.storage.put('book', this.book)
    return isFail(result) ? json({ error: result.error }, 400) : json({ data: result.value })
  }
}
