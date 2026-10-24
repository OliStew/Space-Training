import { getColonyAdvice } from '../ai/gameAdvisor'
import type { LowResourceGameReaction } from '../interfaces/aiReactions'

export async function askSpaceAI(
  userCommand: string,
  resources: Record<string, any>,
  gameTime: number
): Promise<LowResourceGameReaction> {
  // Calls getColonyAdvice from your gameAdvisor.ts file
  return await getColonyAdvice(null, userCommand, resources, gameTime);
}