// import {useResources} from '@/game'
// const resources = useResources();

import { generateResponse } from './generate'

import type { 
  LowResourceGameReaction, 
  LowResourceGameAction,
  TradeGameAction,
  TradeGameReaction,
  EventGameAction,
  EventGameReaction
} from '../interfaces/aiReactions'
import { List } from 'lucide-react'
///When changing string keys, make sure to change the context section
const warningThreshold: Record<string, number> = {
  'health': 50,
  'oxygen': 40,
  'food/spaceGoop': 20,
  'ammo': 25,
  'spaceBucks/money': 300
};
const criticalThreshold: Record<string, number> = {
  'health': 30,
  'oxygen': 10,
  'food/spaceGoop': 20,
  'ammo': 10,
  'spaceBucks/money': 300
};

const keys = Object.keys(warningThreshold);

const REGULAR_ACTIONS: LowResourceGameAction[] = [
  'BUY_AMMO',
  'BUY_SPACE_GOOP',
  'BUY_OXYGEN',
  'PRODUCE_SPACE_GOOP',
  'PRODUCE_AMMO',
  'PRODUCE_OXYGEN',
  'SELL_AMMO',
  'SELL_SPACE_GOOP',
  'SELL_OXYGEN',
  'PRACTICE_ALIEN_LANGUAGE',
  'NONE'
]

const TRADE_ACTIONS: TradeGameAction[] = [
    'BUY_AMMO',
    'BUY_SPACE_GOOP',
    'BUY_OXYGEN',
    'ACCEPT_TRADE',
    'REJECT_TRADE',
    'SELL_AMMO',
    'SELL_SPACE_GOOP',
    'SELL_OXYGEN',
    'NONE'
]

const EVENT_ACTIONS: EventGameAction[] = [
'NONE'
]
///THe following need to be changed manually if we change the keys (resources) names
const REGULAR_ADVISOR = `
7. VIBE EFFECTS:
    -If every resource is "STABLE" or "OPTIMAL", then suggest to the user to "PRACTICE_ALIEN_LANGUAGE" to prepare for events and trades
    -If a resource is "WARNING" or "CRITICAL" suggest purchasing that resource or producing that resource. 
    -These VIBE EFFECTS are not exhaustive.
8. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(REGULAR_ACTIONS)}`
const TRADE_ADVISOR = `
7. ACTIVE TRADE LOGIC:
- The user is currently in the trade module.
- The user can choose to buy or sell their supplies to Aliens that propose trades. 
- Resources can be exchanged for money or money for resources.
- Resources CANNOT be exchanged for other resources.
- ONLY these ressouces can be exchanged: OXYGEN, AMMO, SPACE GOOP, SPACE BUCKS. No other resource can be exchanged.
- Evaluate the offered items versus what you are giving up. 
- Only recommend ACCEPT_TRADE if it addresses critical shortages or provides exceptional economic value without bankrupting the colony. Otherwise, recommend REJECT_TRADE.
8. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(TRADE_ACTIONS)}`
const EVENT_ADVISOR = `
7.
8. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(EVENT_ACTIONS)}
`


//NOTE, threshold stuff definitely needs to be changed
const BASE_ADVISOR = `
You are the central life-support and resource advisor AI for a space colony.
Your name is CORA, for Colony Organizer Runtime Administrator
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
3. "WARNING": Set to "WARNING" when resources start dropping below stated thresholds:
    -${JSON.stringify(keys[0])} < ${JSON.stringify(warningThreshold[keys[0]])}
    -${JSON.stringify(keys[1])} < ${JSON.stringify(warningThreshold[keys[1]])}
    -${JSON.stringify(keys[2])} < ${JSON.stringify(warningThreshold[keys[2]])}
    -${JSON.stringify(keys[3])} < ${JSON.stringify(warningThreshold[keys[3]])}
    -${JSON.stringify(keys[4])} < ${JSON.stringify(warningThreshold[keys[4]])}
4. "CRITICAL": Set to "CRITICAL" during the following severe emergencies when the following drop below threshold:
    -${JSON.stringify(keys[0])} < ${JSON.stringify(criticalThreshold[keys[0]])}
    -${JSON.stringify(keys[1])} < ${JSON.stringify(criticalThreshold[keys[1]])}
    -${JSON.stringify(keys[2])} < ${JSON.stringify(criticalThreshold[keys[2]])}
    -${JSON.stringify(keys[3])} < ${JSON.stringify(criticalThreshold[keys[3]])}
    -${JSON.stringify(keys[4])} < ${JSON.stringify(criticalThreshold[keys[4]])}
5. SAFE ZONE: 
    - If resource is not "CRITICAL" or "WARNING", do NOT panic about that resource. 
6. CONTEXT:
    -IMPORTANCE OF RESOURCES: Health > Oxygen > Space Goop > Money > Ammo
    -Only one resource can be produced at a time. 
    -0 Space Goop will cause Health to go down
    -0 Oxygen will cause Health to go down
    -There is no way to gain Health
    -0 Health will end the Colony
`;

export function buildColonyPrompt(userMessage: string, resources: Record<string, any>): string {
  return `${BASE_ADVISOR}\n\n[COLONY STATUS]\nResources: ${JSON.stringify(resources)}\nPlayer Message: "${userMessage}"`
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
