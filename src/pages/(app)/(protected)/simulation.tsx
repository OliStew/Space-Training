/**
 * Simulation page — resource depletion tracking.
 * Plain text only; no styled UI.
 */

import { Link } from 'react-router-dom'
import { useGame } from '@/game/GameProvider'
import { DEPLETING_KEYS } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { ScenarioPanel } from '@/components/trading/ScenarioPanel'
import {ResourcesPanel} from "@/components/trading/ResourcesPanel";

export default function SimulationPage() {
  const { state } = useGame()

  return (
    <div style={{ padding: '1rem', fontFamily: 'monospace' }}>
      <p><Link to="/trade">← Dashboard</Link></p>
      <h1>Simulation</h1>

      <hr />
        <ResourcesPanel />
        <hr />
      <h2>Resource Depletion</h2>
      <pre>
        {DEPLETING_KEYS.map((k) => {
          const amount = state.resources[k]
          const rate = state.depletion[k]
          const timeLeft = rate > 0 ? Math.ceil(amount / rate) : Infinity
          const status = timeLeft < 60 ? 'CRITICAL' : timeLeft < 300 ? 'WARNING' : 'Stable'
          const leftStr = timeLeft === Infinity ? '∞' : `${timeLeft}s`
          return `  ${LABELS[k]}: ${fmt(amount, 1)} (depleting at ${fmt(rate, 2)}/s, ${leftStr} left) [${status}]\n`
        })}
      </pre>

      <hr />
        <ScenarioPanel />
    </div>

  )
}
