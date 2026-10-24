import { getColonyAdvice} from '../ai/gameAdvisor'
import type { LowResourceGameReaction } from '../interfaces/aiReactions'
import type { Env } from '../../worker'

export async function askResourceAI(
    env: Env,
    userCommand: string,
    resources: Record<string, any>,
    gameTime: number
): Promise<LowResourceGameReaction> {
  return await getColonyAdvice(env, userCommand, resources, gameTime);
}


//export async function askEventAI(eventDetails: { title: string; description: string; riskLevel: string }, resources: Record<string, any>): Promise<>
// export async function askTradeAI(tradeOffer: { offering: string; asking: string }, resources: Record<string, any>) {
//   return await getTradeAdvice(null, tradeOffer, resources);
// }
