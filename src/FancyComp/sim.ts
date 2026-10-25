import { DEPLETING_KEYS } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'

type Snapshot = { resources: Record<string, number>; depletion: Record<string, number> }

/** Resources visible in the UI — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')

export const sumResources = (s: Snapshot) => VISIBLE_RESOURCE_KEYS.reduce((t, k) => t + s.resources[k], 0)

/** One place for the time-left / status maths (it was duplicated in two pages). */
export function depletionRows(s: Snapshot) {
  return DEPLETING_KEYS.map((key) => {
    const amount = s.resources[key]
    const rate = s.depletion[key]
    const left = rate > 0 ? Math.ceil(amount / rate) : Infinity
    const status = left < 60 ? 'CRITICAL' : left < 300 ? 'WARNING' : 'STABLE'
    return { key, amount, rate, left, status } as const
  })
}
