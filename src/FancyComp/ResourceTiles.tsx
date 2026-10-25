import { DEPLETING_KEYS } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { Meter } from './parts'

/** Shared by Dashboard and Trades (was two copies of the same <pre>). Meter maxes are cosmetic. */
export function ResourceTiles({ state }: { state: { resources: Record<string, number>; depletion: Record<string, number> } }) {
  return (
    <div className="rc-tiles">
      {RESOURCE_KEYS.map((k) => {
        const v = state.resources[k]
        const rate = (DEPLETING_KEYS as readonly string[]).includes(k) ? state.depletion[k] : null
        return (
          <div className="rc-tile" key={k}>
            <small>{LABELS[k].toUpperCase()}</small>
            <b>{k === 'money' ? `$${fmt(v)}` : fmt(v, 1)}</b>
            <Meter value={v} max={k === 'money' ? 2000 : 100} />
            {rate !== null && <em>-{fmt(rate, 2)}/s</em>}
          </div>
        )
      })}
    </div>
  )
}
