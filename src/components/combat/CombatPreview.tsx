import { useEffect, useRef, useState } from 'react'
import { useCombat, useResources } from '@/game'
import { combatDamage } from '@/shared/combat'
import { useAttempt } from '@/components/trading/util'

/** Send the automatic response this long before the window closes, so it reaches the server in time. */
const AUTO_RESPOND_LEAD_MS = 1500

/**
 * Attacks ordered on you. Pick how much ammo to defend with using the slider
 * and send it before the timer runs out. When time is nearly up, the slider's
 * current value is sent for you (all your ammo, if you have less than that).
 */
export function CombatPreview() {
  const { incoming, defend } = useCombat()
  const { ammo } = useResources()
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [message, attempt] = useAttempt()
  const autoSent = useRef(new Set<string>())
  const owned = Math.floor(ammo)

  useEffect(() => {
    for (const a of incoming) {
      if (a.msLeft > AUTO_RESPOND_LEAD_MS || autoSent.current.has(a.id)) continue
      autoSent.current.add(a.id)
      const amount = Math.min(chosen[a.id] ?? a.requiredDefense, owned)
      void attempt(() => defend(a.id, amount), `Time ran out: responded to ${a.fromName} with ${amount} ammo`)
    }
  })

  return (
    <section>
      <h2>Attacks on you</h2>
      {message && <p>{message}</p>}
      {incoming.length === 0 && <p>None.</p>}
      <ul>
        {incoming.map((a) => {
          const value = chosen[a.id] ?? a.requiredDefense
          const loss = combatDamage(a.ammo, value)
          return (
            <li key={a.id}>
              <span style={{ color: 'red' }}>
                {a.fromName} attacked you with {a.ammo} ammo - <strong>{a.secondsLeft}s</strong> left to respond.
              </span>{' '}
              Defend with {a.requiredDefense} ammo to take no harm.
              <div style={{ marginTop: '0.75rem' }}>
              <input
                type="range"
                min={0}
                max={a.requiredDefense}
                step={1}
                value={value}
                onChange={(e) => setChosen({ ...chosen, [a.id]: Number(e.target.value) })}
              />{' '}
              {value} / {a.requiredDefense} ammo{' '}
              <button
                onClick={() =>
                  attempt(async () => {
                    if (value > owned) throw new Error(`Not enough ammo: you chose ${value} but have ${owned}`)
                    await defend(a.id, value)
                  }, 'Response sent')
                }
              >
                Respond (lose {loss} health)
              </button>
              {value > owned && <> Not enough ammo: you have {owned}.</>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
