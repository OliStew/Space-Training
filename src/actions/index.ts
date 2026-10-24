import type { ActionHandler, ActionResult } from 'deepspace/worker'
import { generateResponse } from '../ai/generate.js'
import type { Env } from '../../worker'

/** Fetch the Markets Durable Object stub (single instance per app). */
function getMarketsStub(env: Env) {
  return env.MARKET_ROOMS.get(env.MARKET_ROOMS.idFromName('default'))
}

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

  // ---- Market actions -----------------------------------------------------

  marketBuy: async ({ params, env }): Promise<ActionResult> => {
    const market = params.market as string | undefined
    const resource = params.resource as string | undefined
    if (!market || typeof market !== 'string') {
      return { success: false, error: '"market" is required' }
    }
    if (!resource || typeof resource !== 'string') {
      return { success: false, error: '"resource" is required' }
    }
    const stub = getMarketsStub(env)
    const res = await stub.fetch('/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market, resource }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
    return { success: true, data }
  },

  marketSell: async ({ params, env }): Promise<ActionResult> => {
    const market = params.market as string | undefined
    const resource = params.resource as string | undefined
    if (!market || typeof market !== 'string') {
      return { success: false, error: '"market" is required' }
    }
    if (!resource || typeof resource !== 'string') {
      return { success: false, error: '"resource" is required' }
    }
    const stub = getMarketsStub(env)
    const res = await stub.fetch('/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ market, resource }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
    return { success: true, data }
  },

  marketList: async ({ params, env }): Promise<ActionResult> => {
    const stub = getMarketsStub(env)
    const res = await stub.fetch('/markets')
    const data = await res.json()
    if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
    return { success: true, data }
  },

  marketCreate: async ({ params, env }): Promise<ActionResult> => {
    const name = params.name as string | undefined
    const prices = params.prices as Record<string, number> | undefined
    if (!name || typeof name !== 'string') {
      return { success: false, error: '"name" is required' }
    }
    if (!prices || typeof prices !== 'object') {
      return { success: false, error: '"prices" object is required' }
    }
    const stub = getMarketsStub(env)
    const res = await stub.fetch('/markets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, prices }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
    return { success: true, data }
  },

  marketConfig: async ({ params, env }): Promise<ActionResult> => {
    const stub = getMarketsStub(env)
    // If any config fields are provided, update; otherwise just read
    const hasConfig =
      typeof params.batchInterval === 'number' ||
      typeof params.interest === 'number' ||
      typeof params.effect === 'number' ||
      typeof params.impact === 'number'

    if (hasConfig) {
      const res = await stub.fetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchInterval: params.batchInterval,
          interest: params.interest,
          effect: params.effect,
          impact: params.impact,
        }),
      })
      const data = await res.json()
      if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
      return { success: true, data }
    } else {
      const res = await stub.fetch('/config')
      const data = await res.json()
      if (!res.ok) return { success: false, error: (data as { error?: string }).error ?? 'Request failed' }
      return { success: true, data }
    }
  },
}
