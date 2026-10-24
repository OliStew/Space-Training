import type { LowResourceGameReaction } from '../interfaces/aiReactions'
import type { Env } from '../../worker'

export async function askResourceAI(
    env: Env,
    userCommand: string,
    resources: Record<string, any>,
    gameTime: number
): Promise<LowResourceGameReaction> {
<<<<<<< HEAD
<<<<<<< HEAD
  return await getColonyAdvice(env, userCommand, resources, gameTime);
=======
=======
  return await getColonyAdvice(env, userCommand, resources, gameTime);
>>>>>>> d0916dae14347a2a5a3a690d384678bc53039b79
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
<<<<<<< HEAD
>>>>>>> d784a1440254fe7654d2416167e818e78b8b95cb
=======
>>>>>>> d0916dae14347a2a5a3a690d384678bc53039b79
}


//export async function askEventAI(eventDetails: { title: string; description: string; riskLevel: string }, resources: Record<string, any>): Promise<>
// export async function askTradeAI(tradeOffer: { offering: string; asking: string }, resources: Record<string, any>) {
//   return await getTradeAdvice(null, tradeOffer, resources);
// }
