/**
 * Simple AI generation — sends a prompt to the LLM and returns the response.
 *
 * Uses DeepSpace's platform-managed AI proxy so no API key is needed.
 * The default model is `claude-haiku-5-5` (fast, low-cost), but you can
 * override it per-call.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI, DEEPSPACE_AI_DEFAULTS } from 'deepspace/worker'
import type { Env } from '../../worker'

const defaultModel = DEEPSPACE_AI_DEFAULTS.summarization // claude-haiku-5-5

/**
 * Generate a text response from an AI model.
 *
 * @param env - The worker environment (provides the AI proxy binding)
 * @param prompt - The user prompt to send to the model
 * @param options - Optional overrides
 * @param options.model - Model ID (defaults to claude-haiku-5-5)
 * @returns The generated text response
 */
export async function generateResponse(
  env: Env,
  prompt: string,
  options?: { model?: string },
): Promise<string> {
  const modelId = options?.model ?? defaultModel
  const provider = 'anthropic'
  const ai = createDeepSpaceAI(env, provider)
  const model = ai(modelId)

  const result = await generateText({
    model,
    prompt,
  })

  return result.text
}
