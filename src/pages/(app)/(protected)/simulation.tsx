/**
 * Simulation page — resource depletion tracking.
 * Plain text only; no styled UI.
 */

import { Link } from 'react-router-dom'
import { useGame } from '@/game/GameProvider'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { ScenarioPanel } from '@/components/trading/ScenarioPanel'
import { ResourcesPanel } from "@/components/trading/ResourcesPanel"
import { Badge, Meter, Panel } from '@/FancyComp/parts'
import { depletionRows, sumResources } from '@/FancyComp/sim'
import { DEPLETING_KEYS } from '@/game/state'

/** Resources visible in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

export default function SimulationPage() {
  const { state } = useGame()
  return (
    <>
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

      <Panel title="RESOURCE DEPLETION">
        {depletionRows(state).map((d) => (
          <div className="rc-row" key={d.key} style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span>{LABELS[d.key]}: {fmt(d.amount, 1)} <span className="rc-muted">(-{fmt(d.rate, 2)}/s, {d.left === Infinity ? '∞' : `${d.left}s`} left)</span></span>
              <Badge kind={d.status === 'CRITICAL' ? 'crit' : d.status === 'WARNING' ? 'warn' : 'out'}>{d.status}</Badge>
            </div>
            <Meter value={d.amount} max={100} />
          </div>
        ))}
      </Panel>

      <Panel title="ALL RESOURCES" right={`TOTAL $${sumResources(state).toLocaleString()}`}>
        {VISIBLE_RESOURCE_KEYS.map((k) => (
          <div className="rc-row" key={k}><span>{LABELS[k]}</span>{k === 'money' ? `$${fmt(state.resources[k])}` : fmt(state.resources[k], 1)}</div>
        ))}
      </Panel>
    </>
  )
}

