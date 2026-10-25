import type { LowResourceGameReaction, TradeGameReaction, EventGameReaction } from '../interfaces/aiReactions'
import { getAuthToken } from 'deepspace'
import { buildColonyPrompt, parseColonyAdvice } from '../ai/gameAdvisor'

export async function askResourceAI<T extends LowResourceGameReaction | TradeGameReaction | EventGameReaction>(
  envOrCommand: any,
  userCommandOrResources?: any,
  resources?: any,
  tradeOffer?: any,    
  incomingEvent?: any
): Promise<T> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated. Please log in.')
  }

 
  let command = ''
  let resourcesObj: Record<string, any> = {}

  if (typeof envOrCommand === 'string') {
    
    command = envOrCommand
    resourcesObj = typeof userCommandOrResources === 'object' ? userCommandOrResources : {}
  } else {    
    command = typeof userCommandOrResources === 'string' ? userCommandOrResources : String(userCommandOrResources || '')
    resourcesObj = typeof resources === 'object' ? resources : {}
  }

  
  const payload = buildColonyPrompt(command, resourcesObj, tradeOffer, incomingEvent)

  
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt: payload }),
  })

if (!response.ok) {
  const rawErrorText = await response.text();
  console.error('Server 500 Response Body:', rawErrorText);
  throw new Error(`API error: ${response.status} - ${rawErrorText}`);
}

  const data = (await response.json()) as { text?: string; error?: string }
  if (data.error) {
    throw new Error(data.error)
  }


  return parseColonyAdvice<T>(data.text ?? '')
}