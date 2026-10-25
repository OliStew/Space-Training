import type { LowResourceGameReaction } from '../interfaces/aiReactions'
import { getAuthToken } from 'deepspace'
import { buildColonyPrompt, parseColonyAdvice } from '../ai/gameAdvisor'

export async function askResourceAI(
  envOrCommand: any,
  userCommandOrResources?: any,
  resourcesOrScenario?: any,
  scenarioObj?: any,
): Promise<LowResourceGameReaction> {
  const token = await getAuthToken()
  if (!token) {
    throw new Error('Not authenticated. Please log in.')
  }

  let command = ''
  let resourcesObj: Record<string, any> = {}
  let activeScenario: any = null

  if (typeof envOrCommand === 'string') {
    command = envOrCommand
    resourcesObj = typeof userCommandOrResources === 'object' ? userCommandOrResources : {}
    activeScenario = resourcesOrScenario ?? null
  } else {
    command =
      typeof userCommandOrResources === 'string'
        ? userCommandOrResources
        : String(userCommandOrResources || '')
    resourcesObj = typeof resourcesOrScenario === 'object' ? resourcesOrScenario : {}
    activeScenario = scenarioObj ?? null
  }

  const payload = buildColonyPrompt(command, resourcesObj, activeScenario)

  
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


  return parseColonyAdvice(data.text ?? '')
}