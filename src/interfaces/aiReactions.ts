export type ColonyVibe = 'OPTIMAL' | 'STABLE' | 'WARNING' | 'CRITICAL';
export type LowResourceGameAction = 
'BUY_AMMO' 
  | 'BUY_SPACE_GOOP' 
  | 'BUY_OXYGEN' 
  | 'TRADE_FOR_SPACE_GOOP' 
  | 'TRADE_FOR_AMMO' 
  | 'TRADE_FOR_OXYGEN' 
  | 'PRODUCE_SPACE_GOOP' 
  | 'PRODUCE_AMMO' 
  | 'PRODUCE_OXYGEN' 
  | 'SELL_AMMO'
  | 'SELL_SPACE_GOOP'
  | 'SELL_OXYGEN'
  | 'EAT_SPACE_GOOP'
  | 'PRACTICE_ALIEN_LANGUAGE'
  | 'NONE';

// 2. The structure for a single recommendation step
export interface LowResourceRecommendation {
  stepNumber: number;
  action: LowResourceGameAction; // The AI MUST pick from your premade list
  reasoning: string;  // Why the AI chose it
}

// 3. The main reaction package returned to your game
export interface LowResourceGameReaction {
  text: string;
  vibe: ColonyVibe;
  actionChain: LowResourceRecommendation[]; // Multi-step plan decided by AI
}


export type EventGameAction =''; //none for now, when an event pops up, the user can choose to consult ai
export interface EventRecommendation{
  stepNumber: number;
  action: EventGameAction; // The AI MUST pick from your premade list
  reasoning: string;  // Why the AI chose it
}
export interface EventGameReaction {
  text: string;
  vibe: ColonyVibe;
  actionChain: EventRecommendation[]; // Multi-step plan decided by AI
}
  

export type TradeGameAction =''; //none for now, when going to trade, the user can choose to consult ai
export interface TradeRecommendation{
  stepNumber: number;
  action: TradeGameAction; // The AI MUST pick from your premade list
  reasoning: string;  // Why the AI chose it
}
export interface TradeGameReaction {
  text: string;
  vibe: ColonyVibe;
  actionChain: TradeRecommendation[]; // Multi-step plan decided by AI
}


