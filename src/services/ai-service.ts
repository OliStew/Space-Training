import { getColonyAdvice, getEventAdvice, getTradeAdvice} from '../ai/gameAdvisor'
import type { LowResourceGameReaction } from '../interfaces/aiReactions'


export async function askResourceAI(command: string, resources: Record<string, any>, gameTime: number) {
  return await getColonyAdvice(null, command, resources, gameTime);
}

export async function askEventAI(eventDetails: { title: string; description: string; riskLevel: string }, resources: Record<string, any>) {
  return await getEventAdvice(null, eventDetails, resources);
}

export async function askTradeAI(tradeOffer: { offering: string; asking: string }, resources: Record<string, any>) {
  return await getTradeAdvice(null, tradeOffer, resources);
}
