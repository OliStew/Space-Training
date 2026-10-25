import { useState } from 'react'
import { useCombat } from '@/game'
import { useAttempt } from '@/components/trading/util'

/**
 * Attacks ordered on you. Pick how much ammo to defend with using the slider
 * and send it before the timer runs out; otherwise the attack lands undefended.
 */
export function CombatPreview() {
  const { incoming, defend } = useCombat()
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [message, attempt] = useAttempt()

  return (
    <section>
      <h2>Attacks on you</h2>
      {message && <p>{message}</p>}
      {incoming.length === 0 && <p>None.</p>}
      <ul>
        {incoming.map((a) => {
          const value = chosen[a.id] ?? a.requiredDefense
          return (
            <li key={a.id}>
              {a.fromName} attacked you with {a.ammo} ammo - {a.secondsLeft}s left to respond. Defend with {a.requiredDefense} ammo to take no harm.
              <br />
              <input
                type="range"
                min={0}
                max={a.requiredDefense}
                step={1}
                value={value}
                onChange={(e) => setChosen({ ...chosen, [a.id]: Number(e.target.value) })}
              />{' '}
              {value} / {a.requiredDefense} ammo{' '}
              <button onClick={() => attempt(() => defend(a.id, value), 'Response sent')}>Respond</button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
