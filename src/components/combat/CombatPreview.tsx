import { useState } from 'react'
import { useCombat, useResources } from '@/game'
import { combatDamage } from '@/shared/combat'
import { useAttempt } from '@/components/trading/util'
import { Badge, Panel } from '@/FancyComp/parts'
import { chosenDefense } from './AttackPopup'

/**
 * Attacks ordered on you. Pick how much ammo to defend with using the slider
 * and send it before the timer runs out. When time is nearly up, the slider's
 * current value is sent for you (see AttackPopup, which does this on every page).
 */
export function CombatPreview() {
  const { incoming, defend } = useCombat()
  const { ammo } = useResources()
  const [chosen, setChosen] = useState<Record<string, number>>({})
  const [message, attempt] = useAttempt()
  const owned = Math.floor(ammo)

  return (
    <Panel title="ATTACKS ON YOU" right={incoming.length ? <Badge kind="crit">{incoming.length} INCOMING</Badge> : '0 INCOMING'}>
      {message && <p className="rc-muted">{message}</p>}
      {incoming.length === 0 && <p className="rc-muted">None.</p>}
      {incoming.map((a) => {
        const value = chosen[a.id] ?? a.requiredDefense
        const loss = combatDamage(a.ammo, value)
        return (
          <div className="rc-row" key={a.id} style={{ display: 'block', padding: '10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#ff4d4d' }}>{a.fromName} attacked you with {a.ammo} ammo</span>
              <Badge kind="crit">{a.secondsLeft}s LEFT</Badge>
            </div>
            <p className="rc-muted" style={{ margin: '4px 0 8px' }}>Defend with {a.requiredDefense} ammo to take no harm.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="range"
                min={0}
                max={a.requiredDefense}
                step={1}
                value={value}
                style={{ flex: 1, minWidth: 140 }}
                onChange={(e) => {
                  chosenDefense[a.id] = Number(e.target.value)
                  setChosen({ ...chosen, [a.id]: Number(e.target.value) })
                }}
              />
              <span>{value} / {a.requiredDefense} AMMO</span>
              <button
                className="danger"
                onClick={() =>
                  attempt(async () => {
                    if (value > owned) throw new Error(`Not enough ammo: you chose ${value} but have ${owned}`)
                    await defend(a.id, value)
                  }, 'Response sent')
                }
              >
                RESPOND (-{loss} HP)
              </button>
            </div>
            {value > owned && <p style={{ color: '#ffb000', margin: '6px 0 0' }}>Not enough ammo: you have {owned}.</p>}
          </div>
        )
      })}
    </Panel>
  )
}
