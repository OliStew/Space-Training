import { getAuthToken } from 'deepspace'
import { callAction } from './actions'

const MODEL = 'claude-haiku-5-5'

export async function generate(prompt: string): Promise<string> {
  const result = await callAction('generate', { prompt, model: MODEL })
  const r = result as { success: boolean; error?: string; data?: { text: string } }
  if (!r.success) {
    throw new Error(r.error ?? 'Generate failed')
  }
  return r.data.text
}

/**
 * Stream text chunks directly from the AI model in real-time.
 *
 * @param prompt Prompt to generate
 * @param onChunk Callback called with each chunk and the accumulated text so far
 * @param options Model or abort signal
 * @returns The full accumulated text
 */
export async function streamGenerate(
  prompt: string,
  onChunk: (chunk: string, accumulated: string) => void,
  options?: { model?: string; signal?: AbortSignal },
): Promise<string> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const res = await fetch('/api/generate-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, model: options?.model ?? MODEL }),
    signal: options?.signal,
  })

  if (!res.ok || !res.body) {
    const errorText = await res.text().catch(() => '')
    throw new Error(errorText || `Streaming failed with status ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) {
      accumulated += chunk
      onChunk(chunk, accumulated)
    }
  }

  return accumulated
}

/**
 * Helper to smoothly stream text in a typewriter fashion (useful for fallbacks or simulated streams).
 */
export async function streamTextSmoothly(
  fullText: string,
  onUpdate: (accumulated: string) => void,
  delayMs: number = 16,
): Promise<void> {
  let current = ''
  for (let i = 0; i < fullText.length; i++) {
    current += fullText[i]
    onUpdate(current)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}
