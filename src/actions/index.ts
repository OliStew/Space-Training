import type { ActionHandler, ActionResult } from 'deepspace/worker'
import { generateResponse } from '../ai/generate.js'
import type { Env } from '../../worker'

type Params = Record<string, unknown>

/** Call the Markets Durable Object (single instance per app). */
async function markets(env: Env, path: string, init?: { method?: string; body?: Params }): Promise<ActionResult> {
  const stub = env.MARKET_ROOMS.get(env.MARKET_ROOMS.idFromName('default'))
  return relay(await stub.fetch(`https://internal${path}`, toInit(init)))
}

/** Call the Trades Durable Object, always stamping the verified caller. */
async function trades(env: Env, userId: string, path: string, body: Params = {}): Promise<ActionResult> {
  const stub = env.TRADE_ROOMS.get(env.TRADE_ROOMS.idFromName('default'))
  return relay(await stub.fetch(`https://internal${path}`, toInit({ method: 'POST', body: { ...body, userId } })))
}

function toInit(init?: { method?: string; body?: Params }): RequestInit {
  return {
    method: init?.method ?? (init?.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  }
}

/** DO responses are `{ error }` on failure; otherwise the body is the data. */
async function relay(res: Response): Promise<ActionResult> {
  const payload = (await res.json()) as Params
  if (!res.ok) return { success: false, error: String(payload.error ?? 'Request failed'), code: typeof payload.code === 'string' ? payload.code : undefined }
  return { success: true, data: 'data' in payload ? payload.data : payload }
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Market administration is limited to the app owner. */
const ownerOnly = (userId: string, env: Env): ActionResult | null =>
  userId === env.OWNER_USER_ID ? null : { success: false, error: 'Only the app owner can do that' }

export const actions: Record<string, ActionHandler<Env>> = {
  generate: async ({ params, env }): Promise<ActionResult> => {
    const prompt = params.prompt as string | undefined
    if (!prompt || typeof prompt !== 'string') {
      return { success: false, error: 'Prompt is required' }
    }
    const model = typeof params.model === 'string' ? params.model : undefined
    const text = await generateResponse(env, prompt, { model })
    return { success: true, data: { text } }
  },

  // ---- Markets ------------------------------------------------------------

  /** Current markets, config, and when prices next update. */
  marketSnapshot: ({ env }) => markets(env, '/snapshot'),

  /** { market, resource, quantity, expectedPrice? } — executes at the current price. */
  marketBuy: ({ params, env }) =>
    markets(env, '/order', { body: { side: 'buy', market: params.market, resource: params.resource, quantity: params.quantity, expectedPrice: params.expectedPrice } }),

  marketSell: ({ params, env }) =>
    markets(env, '/order', { body: { side: 'sell', market: params.market, resource: params.resource, quantity: params.quantity, expectedPrice: params.expectedPrice } }),

  /** Owner: create/replace a market. prices: { metal: 10 } or { metal: { buy: 11, sell: 9 } }. */
  marketCreate: async ({ params, env, userId }) =>
    ownerOnly(userId, env) ?? markets(env, '/markets', { body: { name: params.name, prices: params.prices } }),

  marketRemove: async ({ params, env, userId }) =>
    ownerOnly(userId, env) ??
    markets(env, `/markets?name=${encodeURIComponent(str(params.name))}`, { method: 'DELETE' }),

  /** Read config; with any config field set (owner only), update it. */
  marketConfig: async ({ params, env, userId }) => {
    const fields = ['batchInterval', 'interest', 'effect', 'impact', 'maxShift', 'spread', 'minPrice']
    const update = Object.fromEntries(fields.filter((f) => f in params).map((f) => [f, params[f]]))
    if (Object.keys(update).length === 0) return markets(env, '/config')
    return ownerOnly(userId, env) ?? markets(env, '/config', { body: update })
  },

  // ---- Player-to-player trades ---------------------------------------------

  /** Heartbeat: registers { name, email } and returns this player's open trades + known names. */
  tradeSync: ({ params, env, userId }) =>
    trades(env, userId, '/sync', { name: str(params.name), email: str(params.email) || undefined }),

  /** { id (client-chosen), trade: { to, side, resource, quantity, unitPrice } } */
  tradeSend: ({ params, env, userId }) => trades(env, userId, '/send', { id: params.id, trade: params.trade }),
  tradeAccept: ({ params, env, userId }) => trades(env, userId, '/accept', { id: params.id }),
  tradeDecline: ({ params, env, userId }) => trades(env, userId, '/decline', { id: params.id }),
  tradeCancel: ({ params, env, userId }) => trades(env, userId, '/cancel', { id: params.id }),
  /** Report that this client applied the trade's final outcome. */
  tradeAck: ({ params, env, userId }) => trades(env, userId, '/ack', { id: params.id }),
}
