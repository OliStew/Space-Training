import { callAction } from '@/lib/actions'
import type {
  MarketsSnapshot,
  OrderReceipt,
  Trade,
  TradeRequestInput,
  TradeSyncResult,
  TradableKey,
} from '../shared/types'

/** A request the server answered with a definite refusal. */
export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
  }
}

/** The server calls the engine depends on (swappable in tests). */
export interface GameApi {
  snapshot(): Promise<MarketsSnapshot>
  order(side: 'buy' | 'sell', market: string, resource: TradableKey, quantity: number, expectedPrice: number): Promise<OrderReceipt>
  syncTrades(profile: { name: string; email?: string }): Promise<TradeSyncResult & { players: string[] }>
  sendTrade(id: string, trade: TradeRequestInput): Promise<Trade>
  acceptTrade(id: string): Promise<Trade>
  declineTrade(id: string): Promise<Trade>
  cancelTrade(id: string): Promise<Trade>
  ackTrade(id: string): Promise<void>
}

async function call<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = (await callAction(name, params)) as { success?: boolean; data?: T; error?: string; code?: string }
  if (!res.success) throw new ApiError(res.error ?? `${name} failed`, res.code)
  return res.data as T
}

export const serverApi: GameApi = {
  snapshot: () => call('marketSnapshot'),
  order: async (side, market, resource, quantity, expectedPrice) =>
    (await call<{ receipt: OrderReceipt }>(side === 'buy' ? 'marketBuy' : 'marketSell', { market, resource, quantity, expectedPrice })).receipt,
  syncTrades: (profile) => call('tradeSync', profile),
  sendTrade: (id, trade) => call('tradeSend', { id, trade }),
  acceptTrade: (id) => call('tradeAccept', { id }),
  declineTrade: (id) => call('tradeDecline', { id }),
  cancelTrade: (id) => call('tradeCancel', { id }),
  ackTrade: async (id) => void (await call('tradeAck', { id })),
}
