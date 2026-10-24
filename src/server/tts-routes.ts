import type { Hono } from 'hono'
import type { AppContext } from '../../worker.js'

export const DEFAULT_VOICE_ID = 'weA4Q36twV5kwSaTEL0Q' // Eva
export const DEFAULT_MODEL_ID = 'eleven_flash_v2_5'

export function registerTtsRoutes(app: Hono<AppContext>): void {
  app.post('/api/tts', async (c) => {
    const apiKey = c.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return c.json(
        {
          error:
            'ElevenLabs API key is not configured. Add ELEVENLABS_API_KEY to .dev.vars for local development or set it with `npx deepspace secrets set ELEVENLABS_API_KEY=...`.',
        },
        500,
      )
    }

    let body: { text?: string; voiceId?: string; modelId?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON request body' }, 400)
    }

    const { text, voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_MODEL_ID } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return c.json({ error: 'Text is required' }, 400)
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      },
    )

    if (!response.ok) {
      const errText = await response.text()
      return c.json(
        { error: `ElevenLabs request failed (${response.status}): ${errText}` },
        response.status as any,
      )
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  })
}
