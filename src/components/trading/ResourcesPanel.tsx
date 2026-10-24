import { DEPLETING_KEYS, RESOURCE_KEYS, useDepletion, useResources } from '@/game'
import type { DepletingKey } from '@/game'
import { fmt } from './util'

/** Resources visible to the player in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

/**
 * Shows your resources and lets you change how fast biomass/oxygen drain.
 *
 * Uses:
 *   useResources()  -> { money, metal, ammo, biomass, oxygen, buildings }
 *   useDepletion()  -> { rates: { biomass, oxygen }, setRate(resource, perSecond) }
 */
export function ResourcesPanel() {
  const resources = useResources()
  const { rates, setRate } = useDepletion()

  return (
    <section>
      <h2>Resources</h2>
      <ul>
        {VISIBLE_RESOURCE_KEYS.map((key) => (
          <li key={key}>
            {key}: {fmt(resources[key], key === 'money' ? 2 : 1)}
            {(DEPLETING_KEYS as readonly string[]).includes(key) && (
              <>
                {' '}(drains{' '}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  size={5}
                  defaultValue={rates[key as DepletingKey]}
                  onChange={(e) => e.target.value !== '' && setRate(key as DepletingKey, Number(e.target.value))}
                />{' '}
                per second)
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
