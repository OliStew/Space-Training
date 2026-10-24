/**
 * App Worker — explicit assembly for DeepSpace app routes and Durable Objects.
 *
 * Route implementations live under src/server. Keep their registration order
 * here: specific API and WebSocket handlers must precede the SPA fallback.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  armCronRoom,
  CanvasRoom,
  CronRoom,
  JobRoom,
  PresenceRoom,
  RecordRoom,
  resolveAppRole,
  workerErrorHandler,
  YjsRoom,
} from 'deepspace/worker'
import type { DOBindings, DOManifest, Job, JobContext } from 'deepspace/worker'
import { AI_CHATS_SCHEMA } from 'deepspace/schema'
import { registerAgent } from './src/ai/agent.js'
import { buildTools } from './src/ai/tools.js'
import { tasks as cronTasks, runTask as runCronTask } from './src/cron.js'
import { runJob } from './src/jobs.js'
import { schemas } from './src/schemas.js'
import { registerActionRoutes } from './src/server/action-routes.js'
import {
  registerAuthAndIntegrationRoutes,
  registerPlatformProxyRoutes,
  registerStaticRoutes,
  resolveAuth,
} from './src/server/http-routes.js'
import { registerRealtimeRoutes } from './src/server/realtime-routes.js'

// Dynamic deploy reads this manifest to create the app's DO bindings.
export const __DO_MANIFEST__ = [
  { binding: 'RECORD_ROOMS', className: 'AppRecordRoom', sqlite: true },
  { binding: 'YJS_ROOMS', className: 'AppYjsRoom', sqlite: true },
  { binding: 'CANVAS_ROOMS', className: 'AppCanvasRoom', sqlite: true },
  { binding: 'PRESENCE_ROOMS', className: 'AppPresenceRoom', sqlite: true },
  { binding: 'CRON_ROOMS', className: 'AppCronRoom', sqlite: true },
  { binding: 'JOB_ROOMS', className: 'AppJobRoom', sqlite: true },
  { binding: 'MARKET_ROOMS', className: 'AppMarketsRoom', sqlite: true },
] as const satisfies DOManifest

export class AppRecordRoom extends RecordRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, schemas, { ownerUserId: env.OWNER_USER_ID })
  }
}

export class AppYjsRoom extends YjsRoom<Env> {}
export class AppCanvasRoom extends CanvasRoom<Env> {}
export class AppPresenceRoom extends PresenceRoom<Env> {}

/** Runs the scheduled tasks defined in src/cron.ts. */
export class AppCronRoom extends CronRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tasks: cronTasks })
  }

  protected async onTask(taskName: string): Promise<void> {
    await runCronTask(taskName, this.env)
  }
}

/** Runs durable background work defined in src/jobs.ts. */
export class AppJobRoom extends JobRoom<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, {
      authorizeWrite: async (user) => {
        if (user.userId.startsWith('anon-')) return false
        const role = await resolveAppRole(env, user.userId)
        return role === 'member' || role === 'admin'
      },
    })
  }

  protected async onJob(job: Job, context: JobContext): Promise<unknown> {
    return await runJob(job, context, this.env)
  }
}

// ---------------------------------------------------------------------------
// Markets Durable Object
// ---------------------------------------------------------------------------

/** A single pending buy or sell order. */
interface PendingOrder {
  /** Market name */
  market: string
  /** Resource name within the market */
  resource: string
  /** "buy" or "sell" */
  type: 'buy' | 'sell'
  /** Timestamp when the order was placed */
  ts: number
}

/** One market entry: name + per-resource prices. */
interface MarketEntry {
  name: string
  prices: Record<string, number>
}

/** Configuration for the Markets Durable Object. */
interface MarketsConfig {
  /** Seconds between batch processing cycles (default 30). */
  batchInterval: number
  /** Percentage to increment all prices by each cycle (default 0). */
  interest: number
  /** Percentage to increase price per buy order (default 1). */
  effect: number
  /** Percentage to decrease price per sell order (default 1). */
  impact: number
}

const DEFAULT_MARKETS_CONFIG: MarketsConfig = {
  batchInterval: 30,
  interest: 0,
  effect: 1,
  impact: 1,
}

/**
 * Persistent server-side market with batched order processing.
 *
 * Stores a list of markets, each with per-resource prices. Clients submit
 * buy/sell orders that accumulate in a queue. Every `batchInterval` seconds
 * the queue is processed: first all prices rise by `interest`%, then each
 * buy raises the resource price by `effect`% and each sell lowers it by
 * `impact`%.
 */
export class AppMarketsRoom {
  private storage: DurableObjectStorage
  private config: MarketsConfig

  constructor(state: DurableObjectState, env: Env) {
    this.storage = state.storage
    state.blockConcurrencyWhile(async () => {
      this.config = (await this.storage.get('config')) ?? DEFAULT_MARKETS_CONFIG
    })
  }

  // ---- HTTP API -----------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    switch (url.pathname) {
      case '/buy':
        return this.handleOrder(request, 'buy')
      case '/sell':
        return this.handleOrder(request, 'sell')
      case '/markets':
        if (request.method === 'GET') return this.handleGetMarkets()
        if (request.method === 'POST') return this.handleCreateMarket(request)
        return new Response('Method Not Allowed', { status: 405 })
      case '/config':
        if (request.method === 'GET') return this.handleGetConfig()
        if (request.method === 'POST') return this.handleSetConfig(request)
        return new Response('Method Not Allowed', { status: 405 })
      default:
        return new Response('Not Found', { status: 404 })
    }
  }

  // ---- Alarm (batch processing) -------------------------------------------

  async alarm(): Promise<void> {
    await this.processOrders()
    // Re-arm the alarm
    const ms = this.config.batchInterval * 1000
    this.storage.setAlarm(Date.now() + ms)
  }

  // ---- Order handling -----------------------------------------------------

  private async handleOrder(request: Request, type: 'buy' | 'sell'): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>
    const market = body.market as string | undefined
    const resource = body.resource as string | undefined

    if (!market || !resource) {
      return Response.json(
        { error: 'Missing "market" or "resource" field' },
        { status: 400 },
      )
    }

    // Queue the order
    const queue: PendingOrder[] = (await this.storage.get('queue')) ?? []
    queue.push({ market, resource, type, ts: Date.now() })
    await this.storage.put('queue', queue)

    // Arm the alarm if not already armed
    const nextAlarm = await this.storage.getAlarm()
    if (!nextAlarm || nextAlarm < Date.now() + this.config.batchInterval * 1000) {
      const ms = this.config.batchInterval * 1000
      this.storage.setAlarm(Date.now() + ms)
    }

    return Response.json({ queued: true, pending: queue.length })
  }

  // ---- Market listing -----------------------------------------------------

  private async handleGetMarkets(): Promise<Response> {
    const markets: MarketEntry[] = (await this.storage.get('markets')) ?? []
    return Response.json({ markets })
  }

  private async handleCreateMarket(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>
    const name = body.name as string | undefined
    const prices = body.prices as Record<string, number> | undefined

    if (!name || typeof name !== 'string') {
      return Response.json({ error: '"name" is required' }, { status: 400 })
    }
    if (!prices || typeof prices !== 'object') {
      return Response.json({ error: '"prices" object is required' }, { status: 400 })
    }

    const entry = await this.upsertMarket(name, prices)
    return Response.json({ market: entry })
  }

  // ---- Config CRUD --------------------------------------------------------

  private async handleGetConfig(): Promise<Response> {
    return Response.json({ config: this.config })
  }

  private async handleSetConfig(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>
    const partial: Partial<MarketsConfig> = {}
    if (typeof body.batchInterval === 'number') partial.batchInterval = body.batchInterval as number
    if (typeof body.interest === 'number') partial.interest = body.interest as number
    if (typeof body.effect === 'number') partial.effect = body.effect as number
    if (typeof body.impact === 'number') partial.impact = body.impact as number

    this.config = { ...this.config, ...partial }
    await this.storage.put('config', this.config)
    return Response.json({ config: this.config })
  }

  // ---- Batch processing ---------------------------------------------------

  private async processOrders(): Promise<void> {
    const queue: PendingOrder[] = (await this.storage.get('queue')) ?? []
    if (queue.length === 0) return

    const markets: MarketEntry[] = (await this.storage.get('markets')) ?? []

    // Aggregate orders by market + resource
    const buys: Record<string, Record<string, number>> = {}
    const sells: Record<string, Record<string, number>> = {}

    for (const order of queue) {
      const key = `${order.market}:${order.resource}`
      if (order.type === 'buy') {
        if (!buys[order.market]) buys[order.market] = {}
        buys[order.market][order.resource] = (buys[order.market][order.resource] ?? 0) + 1
      } else {
        if (!sells[order.market]) sells[order.market] = {}
        sells[order.market][order.resource] = (sells[order.market][order.resource] ?? 0) + 1
      }
    }

    // Process each market
    for (const market of markets) {
      // Step 1: Apply interest to all prices
      for (const resource of Object.keys(market.prices)) {
        market.prices[resource] *= 1 + this.config.interest / 100
      }

      // Step 2: Apply buy effects
      const marketBuys = buys[market.name] ?? {}
      for (const [resource, count] of Object.entries(marketBuys)) {
        if (market.prices[resource] !== undefined) {
          market.prices[resource] *= Math.pow(1 + this.config.effect / 100, count)
        }
      }

      // Step 3: Apply sell impacts
      const marketSells = sells[market.name] ?? {}
      for (const [resource, count] of Object.entries(marketSells)) {
        if (market.prices[resource] !== undefined) {
          market.prices[resource] *= Math.pow(1 - this.config.impact / 100, count)
        }
      }
    }

    await this.storage.put('markets', markets)
    await this.storage.put('queue', [])
  }

  // ---- Market management --------------------------------------------------

  /** Create or update a market with initial prices. */
  async upsertMarket(name: string, prices: Record<string, number>): Promise<MarketEntry> {
    const markets: MarketEntry[] = (await this.storage.get('markets')) ?? []
    const idx = markets.findIndex((m) => m.name === name)
    const entry: MarketEntry = { name, prices }
    if (idx >= 0) {
      markets[idx] = entry
    } else {
      markets.push(entry)
    }
    await this.storage.put('markets', markets)
    return entry
  }

  /** Remove a market by name. */
  async removeMarket(name: string): Promise<boolean> {
    const markets: MarketEntry[] = (await this.storage.get('markets')) ?? []
    const filtered = markets.filter((m) => m.name !== name)
    if (filtered.length === markets.length) return false
    await this.storage.put('markets', filtered)
    return true
  }
}

export interface Env extends DOBindings<typeof __DO_MANIFEST__> {
  ASSETS: Fetcher
  /**
   * Platform service binding in production; deepspace dev supplies the URL
   * fallback. Standard app files use the platform's shared, app-scoped R2
   * bucket rather than a local binding.
   */
  PLATFORM_WORKER?: Fetcher
  PLATFORM_WORKER_URL?: string
  /**
   * HMAC app credential minted on first deploy. Proxy routes omit identity
   * headers when it is absent so upstream services fail closed.
   */
  APP_IDENTITY_TOKEN?: string
  /** API service binding in production with a deepspace-dev URL fallback. */
  API_WORKER?: Fetcher
  API_WORKER_URL?: string
  AUTH_JWT_PUBLIC_KEY: string
  AUTH_JWT_ISSUER: string
  AUTH_WORKER_URL: string
  /** Comma-separated exact Expo/native callback URIs (for example, myapp://auth/callback). */
  NATIVE_AUTH_REDIRECT_URIS?: string
  APP_NAME: string
  /** Immutable record-scope and platform identity. */
  DEEPSPACE_APP_ID: string
  OWNER_USER_ID: string
  /**
   * Long-lived owner JWT used for developer-billed server calls. User-billed
   * calls always forward the signed-in caller's JWT instead.
   */
  APP_OWNER_JWT: string
  /**
   * Enables /api/debug/* only when exactly "true". The route still requires
   * an authenticated app owner/admin. deepspace dev/test set it locally.
   */
  ALLOW_DEBUG_ROUTES?: string
}

export type AppContext = { Bindings: Env }

const app = new Hono<AppContext>()
app.use('/api/*', cors())
// A Durable Object exists only once something fetches it, and the CronRoom
// arms its alarm in that first fetch — so wake it from the request path, or a
// deployed schedule waits for a visitor. Once per isolate; no-op without tasks.
app.use('*', async (c, next) => {
  armCronRoom(c.executionCtx, c.env.CRON_ROOMS, `app:${c.env.DEEPSPACE_APP_ID}`, cronTasks)
  await next()
})

// Registration order is part of the worker contract. The wildcard auth route
// follows its special cases, AI precedes platform proxies, and static is last.
registerAuthAndIntegrationRoutes(app)
registerRealtimeRoutes(app)
registerActionRoutes(app, resolveAuth)
// Every scaffold exposes selected tools through HTTP, MCP and browser tools.
// Only copilot owns the collections needed for the in-app chat UI.
registerAgent(app, {
  tools: buildTools,
  inApp: schemas.some((schema) => schema.name === AI_CHATS_SCHEMA.name),
})
registerPlatformProxyRoutes(app)
registerStaticRoutes(app)

// Hono registers ONE error handler (last onError wins), and its default is
// `console.error(err)` — whose message Workers Logs drops, keeping only the
// stack frames. workerErrorHandler logs the string form instead (message
// first, frames and bounded cause chain, method + path for context), keeps a
// response-bearing error's (HTTPException — auth 401s, upload 413s) own
// answer, and returns a generic 500 for the rest.
app.onError(workerErrorHandler('error'))

export default app
