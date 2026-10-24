import { useState } from 'react'
import { PLAYER_TRADABLE_KEYS, TRADE_TTL_MS, usePlayerTrades } from '@/game'
import type { TradeRequestInput } from '@/game'
import { describe, fmt, useAttempt } from './util'

/**
 * Trade with other players.
 *
 * Uses usePlayerTrades():
 *   players                      names you can trade with
 *   send({ to, side, resource, quantity, unitPrice })   side: 'sell' = you give goods for money, 'buy' = you give money for goods
 *   incoming  [TradeView]        requests for you: accept(id) / decline(id) / counter(id)
 *   outgoing  [TradeView]        your open requests: cancel(id)
 *   TradeView: fromName, toName, resource, quantity, unitPrice, total, secondsLeft, youGive, youReceive
 *
 * A counteroffer is `counter(id)` (declines, returns a reversed request) followed by `send(editedRequest)`.
 */
export function PlayerTradePanel() {
  const { players, incoming, outgoing, send, accept, decline, cancel, counter } = usePlayerTrades()
  const [message, attempt] = useAttempt()
  const [form, setForm] = useState({ to: '', side: 'sell', resource: 'ammo', quantity: '1', unitPrice: '10' })
  const set = (field: string) => (e: { target: { value: string } }) => setForm({ ...form, [field]: e.target.value })

  const request = (): TradeRequestInput => ({
    to: form.to,
    side: form.side as 'buy' | 'sell',
    resource: form.resource as TradeRequestInput['resource'],
    quantity: Number(form.quantity),
    unitPrice: Number(form.unitPrice),
  })

  // Counteroffer: decline, then load the reversed request into the form to edit.
  const startCounter = async (id: string) => {
    const r = await counter(id)
    setForm({ to: r.to, side: r.side, resource: r.resource, quantity: String(r.quantity), unitPrice: String(r.unitPrice) })
  }

  return (
    <section>
      <h2>Trade with players</h2>
      <p>
        Player: <input list="players" size={14} value={form.to} onChange={set('to')} />
        <datalist id="players">{players.map((p) => <option key={p} value={p} />)}</datalist>{' '}
        I <select value={form.side} onChange={set('side')}><option value="sell">sell</option><option value="buy">buy</option></select>{' '}
        <input type="number" min="1" step="1" size={5} value={form.quantity} onChange={set('quantity')} />{' '}
        <select value={form.resource} onChange={set('resource')}>
          {PLAYER_TRADABLE_KEYS.map((r) => <option key={r}>{r}</option>)}
        </select>{' '}
        at $<input type="number" min="0" step="0.01" size={6} value={form.unitPrice} onChange={set('unitPrice')} /> each{' '}
        <button onClick={() => attempt(() => send(request()), `Request sent. They have ${TRADE_TTL_MS / 1000}s to accept.`)}>Send request</button>
      </p>
      {message && <p>{message}</p>}

      <h3>Requests for you</h3>
      {incoming.length === 0 && <p>None.</p>}
      <ul>
        {incoming.map((t) => (
          <li key={t.id}>
            {t.fromName} offers you {describe(t.youReceive)} for {describe(t.youGive)} ({fmt(t.unitPrice)} each) - {t.secondsLeft}s left{' '}
            <button onClick={() => attempt(() => accept(t.id), 'Trade completed')}>Accept</button>{' '}
            <button onClick={() => attempt(() => startCounter(t.id))}>Counter</button>{' '}
            <button onClick={() => attempt(() => decline(t.id))}>Decline</button>
          </li>
        ))}
      </ul>

      <h3>Your open requests</h3>
      {outgoing.length === 0 && <p>None.</p>}
      <ul>
        {outgoing.map((t) => (
          <li key={t.id}>
            To {t.toName}: you give {describe(t.youGive)} for {describe(t.youReceive)} - {t.secondsLeft}s left{' '}
            <button onClick={() => attempt(() => cancel(t.id))}>Cancel</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
