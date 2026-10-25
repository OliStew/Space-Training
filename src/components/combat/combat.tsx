import { useState } from 'react'
import { ATTACK_ARRIVAL_TIME, useCombat, useResources } from '@/game'
import { useAttempt } from '@/components/trading/util'
import { Badge, Meter, Panel } from '@/FancyComp/parts'
import { CombatPreview } from './CombatPreview'

/** The /combat page: attack another player with ammo, and respond to attacks on you. */
export default function Combat() {
  const { players, outgoing, attack } = useCombat()
  const { ammo, health } = useResources()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('1')
  const [message, attempt] = useAttempt()

  return (
    <>
      <Panel title="COMBAT STATUS">
        <div className="rc-row" style={{ display: 'block' }}>
          <span>HEALTH: {Math.round(health)}</span>
          <Meter value={health} max={100} />
        </div>
        <div className="rc-row"><span>AMMO</span>{Math.floor(ammo)}</div>
      </Panel>

      <Panel title="ATTACK A PLAYER">
        <div className="rc-form">
          <label>TARGET PLAYER
            <input list="combat-players" value={to} onChange={(e) => setTo(e.target.value)} />
            <datalist id="combat-players">{players.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
          <label>AMMO
            <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button className="danger" onClick={() => attempt(() => attack(to, Number(amount)), `Attack sent. They have ${ATTACK_ARRIVAL_TIME}s to respond.`)}>ATTACK ▶</button>
        </div>
        {message && <p className="rc-muted" style={{ marginTop: 10 }}>{message}</p>}
      </Panel>

      <Panel title="ATTACKS AWAITING RESPONSE" right={`${outgoing.length} ACTIVE`}>
        {outgoing.length === 0 && <p className="rc-muted">None.</p>}
        {outgoing.map((a) => (
          <div className="rc-row" key={a.id}>
            <span>TO {a.toName}: {a.ammo} ammo</span>
            <Badge kind="warn">{a.secondsLeft}s LEFT</Badge>
          </div>
        ))}
      </Panel>

      <CombatPreview />
    </>
  )
}
