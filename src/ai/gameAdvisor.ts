// import {useResources} from '@/game'
// const resources = useResources();

import { generateResponse } from './generate'

import type { 
  LowResourceGameReaction, 
  LowResourceGameAction,
} from '../interfaces/aiReactions'

const ALLOWED_ACTIONS: LowResourceGameAction[] = [
  'BUY_AMMO',
  'BUY_SPACE_GOOP',
  'BUY_OXYGEN',
  'PRODUCE_SPACE_GOOP',
  'PRODUCE_AMMO',
  'PRODUCE_OXYGEN',
  'SELL_AMMO',
  'SELL_SPACE_GOOP',
  'SELL_OXYGEN',
  'EAT_SPACE_GOOP',
  'PRACTICE_ALIEN_LANGUAGE',
  'NONE'
]
//NOTE, threshold stuff definitely needs to be changed
const GAME_ADVISOR_SYSTEM_PROMPT = `
You are the central life-support and resource advisor AI for a space colony.
Analyze the colony's current resource state and the player's input. 

You MUST return ONLY a raw JSON object matching this exact TypeScript structure:
{
  "text": "1-2 sentences of in-character advisor commentary.",
  "vibe": "OPTIMAL" | "STABLE" | "WARNING" | "CRITICAL",
  "actionChain": [
    {
      "stepNumber": 1,
      "action": "ONE_ALLOWED_ACTION_HERE",
      "reasoning": "Short explanation why."
    }
  ]
}

FORMATTING CONSTRAINTS:
Do NOT use bolding (**), italics (*), or markdown bullet points in "text" or "reasoning". You may use spacing only to format text. Otherwise, provide plain unformatted text. 
STRICT VIBE AND THRESHOLD RULES:
1. "OPTIMAL": Set to "OPTIMAL" only when everything is exceptionally high (all resources are over 90 and money is over 2000).
2. "STABLE": Set to "STABLE" when resources are safe and above danger lines, but not at peak optimal levels. 
3. "WARNING": Set to "WARNING" when resources start dropping below 30.
4. "CRITICAL": Set to "CRITICAL" during severe emergencies (Oxygen < 15).
5. SAFE ZONE BUFFER: 
   - If Oxygen is 15 or higher, do NOT trigger emergency oxygen actions. Treat it as safe.
   - If Space Goop is 10 or higher, do NOT panic about food/goop.
6. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(ALLOWED_ACTIONS)}
`;

export function buildColonyPrompt(userMessage: string, resources: Record<string, any>): string {
  return `${GAME_ADVISOR_SYSTEM_PROMPT}\n\n[COLONY STATUS]\nResources: ${JSON.stringify(resources)}\nPlayer Message: "${userMessage}"`
}

/* CHANGED: Exported standalone response parser that strips markdown bolding and formats reactions */
export function parseColonyAdvice(rawText: string): LowResourceGameReaction {
  const cleanJson = rawText
    .replace(/```json|```/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()

  let parsed: Partial<LowResourceGameReaction> = {}
  try {
    parsed = JSON.parse(cleanJson)
  } catch {
    parsed = { text: cleanJson }
  }

  const sanitize = (str?: string) => (str || '').replace(/\*\*/g, '').replace(/\*/g, '')

  return {
    text: sanitize(parsed.text || cleanJson || 'Tactical update received.'),
    vibe: parsed.vibe || 'STABLE',
    actionChain: Array.isArray(parsed.actionChain)
      ? parsed.actionChain.map((step: any) => ({
          ...step,
          reasoning: sanitize(step.reasoning)
        }))
      : [],
  }
}

/* CHANGED: Simplified getColonyAdvice signature and updated parsing logic using parseColonyAdvice */
export async function getColonyAdvice(
  env: any,
  userMessage: string,
  resources: Record<string, any>,
): Promise<LowResourceGameReaction> {
  const colonyStatusPayload = buildColonyPrompt(userMessage, resources)

  try {
    const rawResponseText = await generateResponse(
      env,
      colonyStatusPayload
    )

    return parseColonyAdvice(rawResponseText)

  } catch (error) {
    console.error("AI parsing failed:", error);
    return {
      text: "Subroutine stutter detected. Systems operating on fallback.",
      vibe: "WARNING",
      actionChain: [{ stepNumber: 1, action: "NONE", reasoning: "System error." }]
    };
  }
}