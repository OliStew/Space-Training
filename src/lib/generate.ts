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
