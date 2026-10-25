import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCombat, useResources } from '@/game'
import { Badge } from '@/FancyComp/parts'
import { AutoRespondPopup } from './AutoRespondPopup'
import type { AutoResponse } from './AutoRespondPopup'

/** Send the automatic response this long before the window closes, so it reaches the server in time. */
const AUTO_RESPOND_LEAD_MS = 1500

/** The deadline the player actually has: the auto-response goes out before the attack window closes. */
const autoRespondIn = (msLeft: number) =>
  msLeft > AUTO_RESPOND_LEAD_MS ? `${Math.ceil((msLeft - AUTO_RESPOND_LEAD_MS) / 1000)}s to respond` : 'Responding now'

/** Ammo the player has picked on CombatPreview's sliders, by attack id. */
export const chosenDefense: Record<string, number> = {}

/**
 * Always mounted, so it works on every page: shows a notification for each incoming attack
 * (until dismissed or no longer pending) and sends the response when time is nearly up.
 * The auto-response uses the slider's value if set, else the full defence, capped at your ammo.
 */
export function AttackPopup() {
  const { incoming, defend } = useCombat()
  const { ammo } = useResources()
  const autoSent = useRef(new Set<string>())
  const [autoResponses, setAutoResponses] = useState<AutoResponse[]>([])
  const closeAutoResponse = (id: string) => setAutoResponses((list) => list.filter((r) => r.id !== id))
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    for (const a of incoming) {
      if (a.msLeft > AUTO_RESPOND_LEAD_MS || autoSent.current.has(a.id)) continue
      autoSent.current.add(a.id)
      const amount = Math.min(chosenDefense[a.id] ?? a.requiredDefense, Math.floor(ammo))
      const response = { id: a.id, fromName: a.fromName, amount, requiredDefense: a.requiredDefense }
      defend(a.id, amount)
        .then(() => setAutoResponses((list) => [...list, response]))
        .catch((err) => {
          console.warn('Auto-respond failed:', err)
          setAutoResponses((list) => [...list, { ...response, error: err instanceof Error ? err.message : String(err) }])
        })
    }
  })

  return (
    <>
      {autoResponses.map((r) => (
        <AutoRespondPopup key={r.id} response={r} onClose={() => closeAutoResponse(r.id)} />
      ))}
      {incoming.filter((a) => !dismissed.has(a.id)).map((a) => (
        <div className="rc-popup crit" role="alert" key={a.id}>
          <div className="rc-popup-head">
            <Badge kind="crit">INCOMING ATTACK</Badge>
            <button className="rc-x" onClick={() => setDismissed(new Set(dismissed).add(a.id))} aria-label="Dismiss">×</button>
          </div>
          <p style={{ margin: '4px 0', color: '#ff4d4d' }}>{a.fromName} attacked you with {a.ammo} ammo</p>
          <p className="rc-muted" style={{ margin: '0 0 8px' }}>
            {autoRespondIn(a.msLeft)}. Defend with {a.requiredDefense} ammo to take no harm.
          </p>
          <Link to="/combat">RESPOND ▶</Link>
        </div>
      ))}
    </>
  )
}
