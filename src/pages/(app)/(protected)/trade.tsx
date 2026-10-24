/**
 * Trading UI. A thin layer over src/game — swap the components freely; all
 * rules live in the game layer (GameProvider / engine / store).
 */

import { DebugPanel } from '@/components/trading/DebugPanel'
import { HistoryLog } from '@/components/trading/HistoryLog'
import { MarketsPanel } from '@/components/trading/MarketsPanel'
import { PlayerTradePanel } from '@/components/trading/PlayerTradePanel'
import { ResourceBar } from '@/components/trading/ResourceBar'
import { VoiceAssistantPanel } from '@/components/trading/VoiceAssistantPanel'

export default function TradePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <ResourceBar />
      <div className="grid gap-4 lg:grid-cols-2">
        <MarketsPanel />
        <PlayerTradePanel />
      </div>
      <HistoryLog />
      <DebugPanel />
      <VoiceAssistantPanel />
    </div>
  )
}
