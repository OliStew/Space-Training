/**
 * Simulation page — resource depletion tracking.
 * Plain text only; no styled UI.
 */

import { useGame } from '@/game/GameProvider'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { Badge, Meter, Panel } from '@/FancyComp/parts'
import { depletionRows, sumResources } from '@/FancyComp/sim'


export default function SimulationPage() {
  const { state } = useGame()
  return (
    <>
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
        {RESOURCE_KEYS.map((k) => (
          <div className="rc-row" key={k}><span>{LABELS[k]}</span>{k === 'money' ? `$${fmt(state.resources[k])}` : fmt(state.resources[k], 1)}</div>
        ))}
      </Panel>
    </>
  )
}
