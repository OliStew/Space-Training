import { DEPLETING_KEYS, HEALTH_REGEN_RATE, isHealthRegenerating, MAX_HEALTH } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { Meter } from './parts'

/** Resources visible in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

/** Shared by Dashboard and Trades (was two copies of the same <pre>). Meter maxes are cosmetic. */
export function ResourceTiles({ state }: { state: { resources: Record<string, number>; depletion: Record<string, number> } }) {
  const isRegen = isHealthRegenerating(state.resources)

  return (
    <div className="rc-tiles">
      {VISIBLE_RESOURCE_KEYS.map((k) => {
        const v = state.resources[k]
        const rate = (DEPLETING_KEYS as readonly string[]).includes(k) ? state.depletion[k] : null
        return (
          <div className="rc-tile" key={k}>
            <small>{LABELS[k].toUpperCase()}</small>
            <b>{k === 'money' ? `$${fmt(v)}` : fmt(v, 1)}</b>
            <Meter value={v} max={k === 'money' ? 2000 : 100} />
            {rate !== null && <em>-{fmt(rate, 2)}/s</em>}
            {k === 'health' && isRegen && <em style={{ color: 'var(--hi)' }}>+1%/5s (REGEN)</em>}
            {k === 'health' && !isRegen && v >= MAX_HEALTH && <em>100% (OPTIMAL)</em>}
            {k === 'health' && !isRegen && v < MAX_HEALTH && v > 0 && (
              <em style={{ opacity: 0.65 }}>NO REGEN (&le;50 BIO/O2)</em>
            )}
          </div>
        )
      })}
    </div>
  )
}
