/**
 * Pure combat logic. Attacks live in the Trades Durable Object's book next to
 * trades (see trade-book.ts) and follow the same model: balances live on the
 * clients, the server only arbitrates state (who attacked whom, the response
 * window, and the single resolution of each attack).
 */

import { findPlayer, isFail } from './trade-book'
import type { BookResult, TradeBookState } from './trade-book'
import type { Attack } from './types'
import { ATTACK_ARRIVAL_TIME } from './types'

/** The attacker's ammo is multiplied by this to get the ammo a defender needs to fully defend. */
export const ATTACKER_DISADVANTAGE = 0.8
/** Defender ammo is multiplied by this when working out the damage that gets through. */
export const DEFENDER_ADVANTAGE = 1.25

const MAX_AMMO = 1_000_000
const RETENTION_MS = 60 * 60 * 1000

const fail = (error: string): BookResult<never> => ({ ok: false, error })
const ok = <T>(value: T): BookResult<T> => ({ ok: true, value })

/** Ammo a defender must commit to take no harm. */
export function requiredDefense(
  attackAmmo: number,
  attackerDisadvantage = ATTACKER_DISADVANTAGE,
): number {
  return Math.round(attackAmmo * attackerDisadvantage)
}

/** Health lost by the defender. Whole number, never negative. */
export function combatDamage(
  attackAmmo: number,
  defenseAmmo: number,
  attackerDisadvantage = ATTACKER_DISADVANTAGE,
  defenderAdvantage = DEFENDER_ADVANTAGE,
): number {
  if (defenseAmmo >= requiredDefense(attackAmmo, attackerDisadvantage)) return 0
  return Math.max(0, Math.round(attackAmmo - defenseAmmo * defenderAdvantage))
}

const attacksOf = (state: TradeBookState): Record<string, Attack> => (state.attacks ??= {})

/** Resolve overdue attacks with no defense, and drop old finished ones. */
export function sweepAttacks(state: TradeBookState, now: number): void {
  const attacks = attacksOf(state)
  for (const a of Object.values(attacks)) {
    if (a.status === 'pending' && now > a.expiresAt) {
      a.status = 'resolved'
      a.defenseAmmo = 0
      a.damage = combatDamage(a.ammo, 0)
      a.resolvedAt = a.expiresAt
    }
    if (a.status === 'resolved') {
      const settled = a.ackedBy.includes(a.from) && a.ackedBy.includes(a.to)
      if (settled || now - (a.resolvedAt ?? a.createdAt) > RETENTION_MS) delete attacks[a.id]
    }
  }
}

export function createAttack(
  state: TradeBookState,
  userId: string,
  input: { to: string; ammo: number },
  id: string,
  now: number,
): BookResult<Attack> {
  sweepAttacks(state, now)
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return fail('Invalid attack id')
  if (attacksOf(state)[id]) return fail('Duplicate attack id')
  if (!Number.isInteger(input.ammo) || input.ammo < 1 || input.ammo > MAX_AMMO) {
    return fail(`Ammo must be a whole number from 1 to ${MAX_AMMO}`)
  }
  const attacker = state.players[userId]
  if (!attacker) return fail('Your player profile is not registered yet — try again in a moment')
  const target = findPlayer(state, String(input.to ?? ''), userId)
  if (isFail(target)) return target
  const attack: Attack = {
    id,
    from: userId,
    fromName: attacker.name,
    to: target.value.id,
    toName: target.value.name,
    ammo: input.ammo,
    createdAt: now,
    expiresAt: now + ATTACK_ARRIVAL_TIME * 1000,
    status: 'pending',
    ackedBy: [],
  }
  attacksOf(state)[id] = attack
  return ok(attack)
}

/** Defender commits ammo. Succeeds at most once, and only inside the window. */
export function defendAttack(
  state: TradeBookState,
  userId: string,
  id: string,
  defenseAmmo: number,
  now: number,
): BookResult<Attack> {
  sweepAttacks(state, now)
  const attack = attacksOf(state)[id]
  if (!attack) return fail('Attack not found')
  if (attack.to !== userId) return fail('This attack was not aimed at you')
  if (attack.status !== 'pending') return fail('The window to respond to this attack has closed')
  if (!Number.isInteger(defenseAmmo) || defenseAmmo < 0 || defenseAmmo > MAX_AMMO) {
    return fail('Defense ammo must be a whole number of 0 or more')
  }
  attack.status = 'resolved'
  attack.defenseAmmo = defenseAmmo
  attack.damage = combatDamage(attack.ammo, defenseAmmo)
  attack.resolvedAt = now
  return ok(attack)
}

export function ackAttack(state: TradeBookState, userId: string, id: string, now: number): void {
  const attack = attacksOf(state)[id]
  if (attack && attack.status === 'resolved' && (attack.from === userId || attack.to === userId) && !attack.ackedBy.includes(userId)) {
    attack.ackedBy.push(userId)
  }
  sweepAttacks(state, now)
}

/**
 * Attacks the user still needs to know about: anything pending, plus resolved
 * ones they have not acked (the defender applies the damage, the attacker
 * just hears the outcome).
 */
export function attacksFor(state: TradeBookState, userId: string, now: number): Attack[] {
  sweepAttacks(state, now)
  return Object.values(attacksOf(state))
    .filter((a) => (a.from === userId || a.to === userId) && (a.status === 'pending' || !a.ackedBy.includes(userId)))
    .sort((a, b) => a.createdAt - b.createdAt)
}
