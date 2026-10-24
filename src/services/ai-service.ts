import type { LowResourceGameReaction } from '../interfaces/aiReactions'
import { getAuthToken } from 'deepspace'
import type { Env } from '../../worker'

export async function askResourceAI(
  envOrCommand: any,
  userCommandOrResources?: any,
  resourcesOrGameTime?: any,
  gameTimeParam?: number
): Promise<LowResourceGameReaction> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated. Please log in.')
  }

  // 1. Normalize parameters so order mismatch never corrupts data
  let command = ''
  let resourcesObj: Record<string, any> = {}
  let timeVal = 0

  if (typeof envOrCommand === 'string') {
    // Called as: askResourceAI(inputText, resources, gameTime)
    command = envOrCommand
    resourcesObj = typeof userCommandOrResources === 'object' ? userCommandOrResources : {}
    timeVal = typeof resourcesOrGameTime === 'number' ? resourcesOrGameTime : 0
  } else {
    // Called as: askResourceAI(env, inputText, resources, gameTime)
    command = typeof userCommandOrResources === 'string' ? userCommandOrResources : String(userCommandOrResources || '')
    resourcesObj = typeof resourcesOrGameTime === 'object' ? resourcesOrGameTime : {}
    timeVal = typeof gameTimeParam === 'number' ? gameTimeParam : 0
  }

  // 2. Format the payload string sent to the backend endpoint
  const payload = `Command: ${command}\nResources: ${JSON.stringify(resourcesObj)}\nGame Time: ${timeVal}s`

  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt: payload }),
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(String(errorBody.error || `API error: ${response.status}`))
  }

  const data = (await response.json()) as { text?: string; error?: string }
  if (data.error) {
    throw new Error(data.error)
  }

  const rawText = data.text ?? ''
  const cleanJson = rawText.replace(/```json|```/g, '').trim()

  let parsed: Partial<LowResourceGameReaction> = {}
  try {
    parsed = JSON.parse(cleanJson)
  } catch {
    parsed = { text: rawText }
  }

  return {
    text: parsed.text || rawText || 'Tactical update received.',
    vibe: parsed.vibe || 'STABLE',
    actionChain: Array.isArray(parsed.actionChain) ? parsed.actionChain : [],
  }
}


//export async function askEventAI(eventDetails: { title: string; description: string; riskLevel: string }, resources: Record<string, any>): Promise<>
// export async function askTradeAI(tradeOffer: { offering: string; asking: string }, resources: Record<string, any>) {
//   return await getTradeAdvice(null, tradeOffer, resources);
// }
