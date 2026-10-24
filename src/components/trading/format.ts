import type { ResourceKey } from '@/shared/types'

export const LABELS: Record<ResourceKey, string> = {
  money: 'Money',
  metal: 'Metal',
  ammo: 'Ammo',
  biomass: 'Biomass',
  oxygen: 'Oxygen',
  buildings: 'Buildings',
}

export const fmt = (n: number, digits = 2) => n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const seconds = (ms: number) => Math.max(0, Math.ceil(ms / 1000))
