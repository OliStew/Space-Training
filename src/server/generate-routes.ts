/**
 * Simple AI generation route — calls generateResponse directly.
 *
 * POST /api/generate
 * Body: { prompt: string, model?: string }
 * Response: { text: string } | { error: string }
 *
 * Colony advisor route — full game-aware AI advice.
 *
 * POST /api/colony-advice
 * Body: { userMessage: string, resources: object, gameTime: number }
 * Response: { text: string, vibe: string, actionChain: array } | { error: string }
 */

import type { Hono } from 'hono'
import { generateResponse } from '../ai/generate.js'
import { getColonyAdvice } from '../ai/gameAdvisor.js'
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

  app.post('/api/colony-advice', async (c) => {
    const auth = await resolveAuth(c.req.raw, c.env)
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)

    const body = await c.req.json().catch(() => ({}))
    const userMessage = body.userMessage
    const resources = body.resources
    const gameTime = body.gameTime

    if (typeof userMessage !== 'string' || !userMessage.trim()) {
      return c.json({ error: 'userMessage is required' }, 400)
    }
    if (typeof resources !== 'object' || resources === null) {
      return c.json({ error: 'resources is required' }, 400)
    }
    if (typeof gameTime !== 'number') {
      return c.json({ error: 'gameTime is required' }, 400)
    }

    try {
      const advice = await getColonyAdvice(c.env, userMessage, resources)
      return c.json(advice)
    } catch (error) {
      console.error('Colony advice error:', error)
      return c.json({
        text: 'Subroutine stutter detected. Systems operating on fallback.',
        vibe: 'WARNING',
        actionChain: [{ stepNumber: 1, action: 'NONE', reasoning: 'System error.' }]
      })
    }
  })
}
