// import {useResources} from '@/game'
// const resources = useResources();

import { generateResponse } from './generate'

import type { 
  LowResourceGameReaction, 
  LowResourceGameAction,
} from '../interfaces/aiReactions'
import { List } from 'lucide-react'

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

const warningKeys = Object.keys(warningThreshold);
const criticalKeys = Object.keys(warningThreshold);

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
3. "WARNING": Set to "WARNING" when resources start dropping below stated thresholds:
    -${JSON.stringify(warningKeys[0])} < ${JSON.stringify(warningThreshold[warningKeys[0]])}
    -${JSON.stringify(warningKeys[1])} < ${JSON.stringify(warningThreshold[warningKeys[0]])}
    -${JSON.stringify(warningKeys[2])} < ${JSON.stringify(warningThreshold[warningKeys[0]])}
    -${JSON.stringify(warningKeys[3])} < ${JSON.stringify(warningThreshold[warningKeys[0]])}
    -${JSON.stringify(warningKeys[4])} < ${JSON.stringify(warningThreshold[warningKeys[0]])}
4. "CRITICAL": Set to "CRITICAL" during the following severe emergencies when the following drop below threshold:
    -${JSON.stringify(criticalKeys[0])} < ${JSON.stringify(criticalThreshold[criticalKeys[0]])}
    -${JSON.stringify(criticalKeys[1])} < ${JSON.stringify(criticalThreshold[criticalKeys[0]])}
    -${JSON.stringify(criticalKeys[2])} < ${JSON.stringify(criticalThreshold[criticalKeys[0]])}
    -${JSON.stringify(criticalKeys[3])} < ${JSON.stringify(criticalThreshold[criticalKeys[0]])}
    -${JSON.stringify(criticalKeys[4])} < ${JSON.stringify(criticalThreshold[criticalKeys[0]])}
5. SAFE ZONE: 
   - If resource is not "CRITICAL" or "WARNING", do NOT panic about that resource. 
7. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(ALLOWED_ACTIONS)}
`;

export function buildColonyPrompt(
  userMessage: string,
  resources: Record<string, any>,
  scenario?: any,
): string {
  let scenarioSection = '[ACTIVE CRISIS SCENARIO]\nNone currently active.'
  if (scenario && scenario.name) {
    const optionsSummary = (scenario.options || [])
      .map((opt: any) => {
        const effects = opt.effects
          ? Object.entries(opt.effects)
              .filter(([_, v]) => v !== undefined && v !== 0)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ')
          : 'None'
        return `  - Option ${opt.key}: "${opt.label}" (Impact: ${effects})`
      })
      .join('\n')

    scenarioSection = `[ACTIVE CRISIS SCENARIO]
Event: "${scenario.name}"
Situation: "${scenario.description}"
Available Decisions:
${optionsSummary}

CRISIS ADVICE INSTRUCTION:
If the commander asks about the active scenario or what option to choose, evaluate the consequences of Option A, B, and C relative to the colony's current resource levels and recommend the best choice.`
  }

  return `${GAME_ADVISOR_SYSTEM_PROMPT}\n\n${scenarioSection}\n\n[COLONY STATUS]\nResources: ${JSON.stringify(resources)}\nPlayer Message: "${userMessage}"`
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
  scenario?: any,
): Promise<LowResourceGameReaction> {
  const colonyStatusPayload = buildColonyPrompt(userMessage, resources, scenario)

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