/**
 * Simulation page — resource depletion tracking.
 * Plain text only; no styled UI.
 */

import { useGame } from '@/game/GameProvider'
import { isHealthRegenerating, useDayTime } from '@/game'
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
  const isRegen = isHealthRegenerating(state.resources)
  const isOxyZero = state.resources.oxygen <= 0
  const isBioZero = state.resources.biomass <= 0
  const curHealth = state.resources.health

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
        <div className="rc-row" style={{ display: 'block', borderTop: '1px solid var(--dim)', paddingTop: 10, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>
              COLONY BASE HEALTH: <strong style={{ color: curHealth <= 20 ? '#ff4d4d' : curHealth <= 50 ? '#ffb000' : 'var(--hi)' }}>{fmt(curHealth, 1)}%</strong>{' '}
              <span className="rc-muted">
                {isOxyZero && isBioZero
                  ? '(-1.50%/s O2 & BIO ZERO)'
                  : isOxyZero
                  ? '(-1.00%/s OXYGEN ZERO)'
                  : isBioZero
                  ? '(-0.50%/s BIOMASS ZERO)'
                  : isRegen
                  ? '(+1.00%/5s REGENERATING)'
                  : curHealth >= 100
                  ? '(100% OPTIMAL)'
                  : '(NO REGEN - BIO/O2 ≤ 50)'}
              </span>
            </span>
            <Badge kind={curHealth <= 0 ? 'crit' : curHealth <= 20 ? 'crit' : curHealth <= 50 ? 'warn' : 'out'}>
              {curHealth <= 0 ? 'CRITICAL ZERO' : curHealth <= 20 ? 'CRITICAL' : curHealth <= 50 ? 'WARNING' : 'STABLE'}
            </Badge>
          </div>
          <Meter value={curHealth} max={100} />
        </div>
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

