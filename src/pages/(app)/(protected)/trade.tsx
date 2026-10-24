/**
 * Trading page — plain layout. Each panel is an independent component in
 * src/components/trading/ that talks to the game only through the hooks in
 * src/game/hooks.ts (read the comment at the top of each file). Rewrite any
 * panel, or rearrange them here, without touching game logic.
 */

import { AIPanel } from '@/components/aiLogicAndVisual/AiPanel'
import { DebugPanel } from '@/components/trading/DebugPanel'
import { HistoryPanel } from '@/components/trading/HistoryPanel'
import { MarketsPanel } from '@/components/trading/MarketsPanel'
import { PlayerTradePanel } from '@/components/trading/PlayerTradePanel'

import { VoiceAssistantPanel } from '@/components/trading/VoiceAssistantPanel'
import { ResourcesPanel } from '@/components/trading/ResourcesPanel'
import { ScenarioPanel } from '@/components/trading/ScenarioPanel'

export default function TradePage() {
  return (
    <div style={{ padding: 16 }}>
      <ResourcesPanel />
      <hr />
      <ScenarioPanel />
      <hr />
      <MarketsPanel />
      <hr />
      <PlayerTradePanel />
      <hr />
      <HistoryPanel />
      <hr />
      <AIPanel />
      <hr />
      <DebugPanel />
      <VoiceAssistantPanel />
    </div>
  )
}
