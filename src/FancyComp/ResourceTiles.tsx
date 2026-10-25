import {
  BIOMASS_STARVATION_HEALTH_DRAIN,
  DEPLETING_KEYS,
  isHealthRegenerating,
  MAX_HEALTH,
  OXYGEN_STARVATION_HEALTH_DRAIN,
} from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from '@/components/trading/format'
import { Meter } from './parts'

/** Resources visible in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

/** Shared by Dashboard and Trades (was two copies of the same <pre>). Meter maxes are cosmetic. */
export function ResourceTiles({ state }: { state: { resources: Record<string, number>; depletion: Record<string, number> } }) {
  const isRegen = isHealthRegenerating(state.resources)
  const isOxyZero = state.resources.oxygen <= 0
  const isBioZero = state.resources.biomass <= 0

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
            {rate !== null && v > 0 && <em>-{fmt(rate, 2)}/s</em>}
            {k === 'oxygen' && v <= 0 && (
              <em style={{ color: '#ff4d4d' }}>DEPLETED (-{OXYGEN_STARVATION_HEALTH_DRAIN}%/s HP)</em>
            )}
            {k === 'biomass' && v <= 0 && (
              <em style={{ color: '#ffb000' }}>DEPLETED (-{BIOMASS_STARVATION_HEALTH_DRAIN}%/s HP)</em>
            )}
            {k === 'health' && isOxyZero && isBioZero && (
              <em style={{ color: '#ff4d4d' }}>CRITICAL: -1.5%/s (O2 &amp; BIO 0)</em>
            )}
            {k === 'health' && isOxyZero && !isBioZero && (
              <em style={{ color: '#ff4d4d' }}>CRITICAL: -{OXYGEN_STARVATION_HEALTH_DRAIN}%/s (O2 0)</em>
            )}
            {k === 'health' && !isOxyZero && isBioZero && (
              <em style={{ color: '#ffb000' }}>WARNING: -{BIOMASS_STARVATION_HEALTH_DRAIN}%/s (BIO 0)</em>
            )}
            {k === 'health' && !isOxyZero && !isBioZero && isRegen && (
              <em style={{ color: 'var(--hi)' }}>+1%/5s (REGEN)</em>
            )}
            {k === 'health' && !isOxyZero && !isBioZero && !isRegen && v >= MAX_HEALTH && (
              <em>100% (OPTIMAL)</em>
            )}
            {k === 'health' && !isOxyZero && !isBioZero && !isRegen && v < MAX_HEALTH && v > 0 && (
              <em style={{ opacity: 0.65 }}>NO REGEN (&le;50 BIO/O2)</em>
            )}
          </div>
        )
      })}
    </div>
  )
}
