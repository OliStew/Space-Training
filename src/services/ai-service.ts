import type { LowResourceGameReaction } from '../interfaces/aiReactions'

export async function askResourceAI(
  userCommand: string,
  resources: Record<string, any>,
  gameTime: number
): Promise<LowResourceGameReaction> {
  const response = await fetch('/api/colony-advice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: userCommand,
      resources,
      gameTime,
    }),
  })

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(String(errorBody.error || `API error: ${response.status}`))
  }

  return response.json() as Promise<LowResourceGameReaction>
}


//export async function askEventAI(eventDetails: { title: string; description: string; riskLevel: string }, resources: Record<string, any>): Promise<>
// export async function askTradeAI(tradeOffer: { offering: string; asking: string }, resources: Record<string, any>) {
//   return await getTradeAdvice(null, tradeOffer, resources);
// }
