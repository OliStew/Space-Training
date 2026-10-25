import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ATTACK_ARRIVAL_TIME, useCombat, useResources } from '@/game'
import { useAttempt } from '@/components/trading/util'
import { CombatPreview } from './CombatPreview'

/** The /combat page: attack another player with ammo, and respond to attacks on you. */
export default function Combat() {
  const { players, outgoing, attack } = useCombat()
  const { ammo, health } = useResources()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('1')
  const [message, attempt] = useAttempt()

  return (
    <div style={{ padding: '1rem', fontFamily: 'monospace' }}>
      <p><Link to="/trade">← Dashboard</Link></p>
      <h1>Combat</h1>
      <p>Health: {Math.round(health)} | Ammo: {Math.floor(ammo)}</p>

      <hr />
      <h2>Attack a player</h2>
      <p>
        Player: <input list="combat-players" size={Math.max(20, to.length + 2)} value={to} onChange={(e) => setTo(e.target.value)} />
        <datalist id="combat-players">{players.map((p) => <option key={p} value={p} />)}</datalist>{' '}
        Ammo: <input type="number" min="1" step="1" size={5} value={amount} onChange={(e) => setAmount(e.target.value)} />{' '}
        <button onClick={() => attempt(() => attack(to, Number(amount)), `Attack sent. They have ${ATTACK_ARRIVAL_TIME}s to respond.`)}>Attack</button>
      </p>
      {message && <p>{message}</p>}

      <h3>Your attacks awaiting a response</h3>
      {outgoing.length === 0 && <p>None.</p>}
      <ul>
        {outgoing.map((a) => (
          <li key={a.id}>To {a.toName}: {a.ammo} ammo - {a.secondsLeft}s left</li>
        ))}
      </ul>

      <hr />
      <CombatPreview />
    </div>
  )
}
