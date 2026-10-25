import { describe, expect, it } from 'vitest'
import { COMBAT_MULTI as M, ackAttack, attacksFor, combatDamage, createAttack, defendAttack, requiredDefense } from './combat'
import { emptyBook, registerPlayer } from './trade-book'

const book = () => {
  const b = emptyBook()
  registerPlayer(b, 'a', 'Alice', undefined, 0)
  registerPlayer(b, 'b', 'Bob', undefined, 0)
  return b
}

describe('combat math', () => {
  it('full defense takes no harm', () => {
    expect(requiredDefense(100)).toBe(80)
    expect(requiredDefense(19)).toBe(16) // 15.2 rounds up so the slider's end is a full defense
    expect(combatDamage(100, 80)).toBe(0)
    expect(combatDamage(7, 6)).toBe(0)
  })
  it('partial defense leaves damage, whole numbers, never negative', () => {
    expect(combatDamage(100, 0)).toBe(100 * M)
    expect(combatDamage(100, 40)).toBe(50 * M)
    expect(combatDamage(7, 5)).toBe(1 * M)
    expect(combatDamage(100, 500)).toBe(0)
  })
})

describe('damage vs required defense', () => {
  it('is zero once defense >= required, and at least 1 below it', () => {
    for (let a = 1; a <= 2000; a++) {
      const r = requiredDefense(a)
      expect(combatDamage(a, r)).toBe(0)
      expect(r).toBeGreaterThanOrEqual(a * 0.8 - 1e-6)
      if (r > 0) expect(combatDamage(a, r - 1)).toBeGreaterThan(0) // one short is never free
      for (let d = 0; d <= r; d += 7) {
        const dmg = combatDamage(a, d)
        expect(Number.isInteger(dmg) && dmg >= 0 && dmg <= a * M).toBe(true)
        if (d < r) expect(dmg).toBe(Math.max(1, Math.round(a - d * 1.25)) * M)
      }
    }
  })
})

describe('attack lifecycle', () => {
  it('resolves once, by the defender', () => {
    const b = book()
    const r = createAttack(b, 'a', { to: 'Bob', ammo: 10 }, 'attack-0001', 1000)
    expect(r.ok).toBe(true)
    expect(defendAttack(b, 'a', 'attack-0001', 5, 2000).ok).toBe(false)
    const d = defendAttack(b, 'b', 'attack-0001', 4, 2000)
    expect(d.ok && d.value.damage).toBe(5 * M)
    expect(defendAttack(b, 'b', 'attack-0001', 8, 3000).ok).toBe(false)
  })
  it('lands undefended after the window', () => {
    const b = book()
    createAttack(b, 'a', { to: 'Bob', ammo: 10 }, 'attack-0001', 1000)
    expect(defendAttack(b, 'b', 'attack-0001', 8, 1000 + 31_000).ok).toBe(false)
    const [a] = attacksFor(b, 'b', 1000 + 31_000)
    expect(a.damage).toBe(10 * M)
    ackAttack(b, 'b', a.id, 40_000)
    ackAttack(b, 'a', a.id, 40_000)
    expect(attacksFor(b, 'b', 40_000)).toHaveLength(0)
  })
})
