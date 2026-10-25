/**
 * Simulation page — resource depletion tracking.
 * Plain text only; no styled UI.
 */

import { useGame } from '@/game/GameProvider'
import { useDayTime } from '@/game'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { ResourcesPanel } from '@/components/trading/ResourcesPanel'
import { ScenarioPanel } from '@/components/trading/ScenarioPanel'
import { Badge, Meter, Panel } from '@/FancyComp/parts'
import { depletionRows, sumResources } from '@/FancyComp/sim'

/** Resources visible in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

export default function SimulationPage() {
  const { state } = useGame()
  const dayTime = useDayTime()
  return (
    <>
      <Panel
        title="COLONY CALENDAR & TIME CYCLE"
        right={<Badge kind="out">DAY {dayTime.day} &middot; {dayTime.phase}</Badge>}
      >
        <div className="rc-row">
          <span>STATION CLOCK: {dayTime.timeStringFull}</span>
          <span>{Math.round(dayTime.secondsLeftInDay)}S REMAINING IN DAY</span>
        </div>
        <Meter value={dayTime.progressPercent} max={100} />
      </Panel>

      <Panel title="CURRENT RESOURCES">
        <ResourcesPanel />
      </Panel>

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

      <Panel title="SCENARIO SIMULATOR">
        <ScenarioPanel />
      </Panel>

      <Panel title="ALL RESOURCES" right={`TOTAL $${sumResources(state).toLocaleString()}`}>
        {VISIBLE_RESOURCE_KEYS.map((k) => (
          <div className="rc-row" key={k}><span>{LABELS[k]}</span>{k === 'money' ? `$${fmt(state.resources[k])}` : fmt(state.resources[k], 1)}</div>
        ))}
      </Panel>
    </>
  )
}

