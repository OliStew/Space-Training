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
import type { MarketsSnapshot, Trade } from '../shared/types'
///When changing string keys, make sure to change the context section
const warningThreshold: Record<string, number> = {
  'health': 50,
  'oxygen': 40,
  'food/spaceGoop/Biomass': 20,
  'ammo': 25,
  'spaceBucks/money': 300
};
const criticalThreshold: Record<string, number> = {
  'health': 30,
  'oxygen': 10,
  'food/spaceGoop/Biomass': 20,
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
'OPTION_A', 
'OPTION_B', 
'OPTION_C'
]
///THe following need to be changed manually if we change the keys (resources) names
const REGULAR_ADVISOR = `
7. The user is currently in the home module.
8. VIBE EFFECTS:
    -If every resource is "STABLE" or "OPTIMAL", then suggest to the user to "PRACTICE_ALIEN_LANGUAGE" to prepare for events and trades
    -If a resource is "WARNING" or "CRITICAL" suggest purchasing that resource or producing that resource. 
    -These VIBE EFFECTS are not exhaustive.
9. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(REGULAR_ACTIONS)}`
const TRADE_ADVISOR = `
7. ACTIVE TRADE LOGIC:
    - The user is currently in the trade module.
    - The user can choose to buy or sell their supplies to Aliens that propose trades. 
    - Resources can be exchanged for money or money for resources.
    - Resources CANNOT be exchanged for other resources.
    - ONLY these ressouces can be exchanged: OXYGEN, AMMO, SPACE GOOP, SPACE BUCKS. No other resource can be exchanged.
    - The active trades can be seen in MARKET DATA and ACTIVE TRADE OFFERS.
    - Evaluate the offered items versus what you are giving up. 
    - Only recommend ACCEPT_TRADE if it addresses critical shortages or provides exceptional economic value without bankrupting the colony. Otherwise, recommend REJECT_TRADE.
9. PREVIOUS TRADES:
    -Take in account recent trades and compare prices to find the best deal.
    -Recent trades are NOT necessarily currently available trades. 
10. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
STRICT ACTION ALLOWLIST:
You can ONLY choose actions from this list: ${JSON.stringify(TRADE_ACTIONS)}`
const EVENT_ADVISOR = `
7. ACTIVE EVENT LOGIC:
    -The user is currently in the event module.
    -NEVER talk about the consequences/effects of the options. NEVER talk to the user about if it adds or subtracts OXYGEN, AMMO, SPACE GOOP, SPACE BUCKS, or HEALTH.
    -Evaluate the scenario consequences/effects versus what you are giving up.
    -Suggest best course of action, without talking about what the consequences/effects are.
    -DO NOT mention you will not talk about the effects, tell the user you do not know the consequences, but you have calculated the best cource of action.
9. NO-ISSUE STATE: If all resources are safely above their danger lines, set the action to 'NONE'. Do not invent problems when everything is fine.
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
No slurs, profanity, sexual content, or vulgar words are allowed. If someone's name is "Dick" that is the only exception. 
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
    -0 Space Goop will cause Health to go down.
    -0 Oxygen will cause Health to go down.
    -There is no way to gain Health.
    -0 Health means the colony has died.
`;

export function buildColonyPrompt(
  userMessage: string, 
  resources: Record<string, any>,
  tradeOffer?: any,
  incomingEvent?: any,
  marketSnapshot?: MarketsSnapshot,
  tradeHistory?: Trade[]
): string {
  let selectedModeAdvisor = REGULAR_ADVISOR;
  let moreContext = "";

  // Add market data context
  if (marketSnapshot && marketSnapshot.markets.length > 0 && !incomingEvent) {
    const marketInfo = marketSnapshot.markets.map(m => ({
      name: m.name,
      prices: m.prices
    }));
    moreContext += `\n[MARKET DATA]\nCurrent market prices: ${JSON.stringify(marketInfo)}`;
  }

  
  if (tradeHistory && tradeHistory.length > 0 && !tradeOffer) {
    const recentTrades = tradeHistory.slice(-10).map(t => ({
      id: t.id,
      from: t.fromName,
      to: t.toName,
      side: t.side,
      resource: t.resource,
      quantity: t.quantity,
      unitPrice: t.unitPrice,
      status: t.status
    }));
    moreContext += `\n[TRADE HISTORY]\nRecent trades: ${JSON.stringify(recentTrades)}`;
  }

  // Priority: Event taking place > Trade active > Regular gameplay
  if (incomingEvent) {
    selectedModeAdvisor = EVENT_ADVISOR;
    moreContext += `\n[INCOMING EVENT]\nEvent Details: ${JSON.stringify(incomingEvent)}`;
  } else if (tradeOffer) {
    selectedModeAdvisor = TRADE_ADVISOR;
    moreContext += `\n[ACTIVE TRADE OFFERS]\nTrade Details: ${JSON.stringify(tradeOffer)}`;
  }

  return `${BASE_ADVISOR}\n${selectedModeAdvisor}\n\n[COLONY STATUS]\nResources: ${JSON.stringify(resources)}${moreContext}\nPlayer Message: "${userMessage}"`;
}


export function parseColonyAdvice<T extends LowResourceGameReaction | TradeGameReaction | EventGameReaction>
(rawText: string): T {
  const cleanJson = rawText
    .replace(/```json|```/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()

  let parsed: any = {}
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
  } as T
}

export async function getColonyAdvice<T extends LowResourceGameReaction | TradeGameReaction | EventGameReaction>(
  env: any,
  userMessage: string,
  resources: Record<string, any>,
  tradeOffer?: any,     
  incomingEvent?: any,
  marketSnapshot?: MarketsSnapshot,
  tradeHistory?: Trade[]
): Promise<T> {
  const colonyStatusPayload = buildColonyPrompt(userMessage, resources, tradeOffer, incomingEvent, marketSnapshot, tradeHistory)

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
    } as T;
  }
}
