/**
 * Simple AI generation route — calls generateResponse directly.
 *
 * POST /api/generate
 * Body: { prompt: string, model?: string }
 * Response: { text: string } | { error: string }
 */

import type { Hono } from 'hono'
import { generateResponse } from '../ai/generate.js'
import { resolveAuth } from './http-routes.js'
import type { AppContext } from '../../worker.js'

export function registerGenerateRoutes(app: Hono<AppContext>): void {
  app.post('/api/generate', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json().catch(() => ({}))
    const prompt = body.prompt
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return c.json({ error: 'Prompt is required' }, 400)
    }

    const model = typeof body.model === 'string' ? body.model : undefined
    const text = await generateResponse(c.env, prompt, { model })
    return c.json({ text })
  })
}
