/** Display helpers for resource formatting. */

export const fmt = (n: number, digits = 2) => n.toFixed(digits)

export const LABELS: Record<string, string> = {
  money: 'Money',
  biomass: 'Biomass',
  oxygen: 'Oxygen',
  metal: 'Metal',
  ammo: 'Ammo',
  health: 'Health',
  buildings: 'Buildings',
}

export function seconds(ms: number): number {
  return Math.max(0, Math.ceil(ms / 1000))
}
