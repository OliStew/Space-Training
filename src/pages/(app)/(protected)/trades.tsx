/**
 * Full trades page — markets, player trades, history, and voice assistant.
 * Plain text only; no styled UI.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGame, useNow, useGameState } from '@/game/GameProvider'
import { useToast } from '@/components/ui'
import { PLAYER_TRADABLE_KEYS } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'
import { TRADE_TTL_MS } from '@/shared/types'
import { tradeLegs } from '@/shared/trade-book'
import type { TradableKey, Trade } from '@/shared/types'
import { fmt, LABELS, seconds } from '@/components/trading/format'
import { DEPLETING_KEYS, setDepletion } from '@/game/state'
import type { DepletingKey } from '@/game/state'
import { VoiceAssistantPanel } from '@/components/trading/VoiceAssistantPanel'

export default function TradesPage() {
  const { state, net, engine, store } = useGame()
  const { error, success } = useToast()
  const now = useNow()
  const serverNow = now + net.clockSkew

  return (
    <div style={{ padding: '1rem', fontFamily: 'monospace' }}>
      <p><Link to="/trade">← Dashboard</Link></p>
      <h1>Trades</h1>

      <hr />
      <h2>Resources</h2>
      <ResourcesTable state={state} store={store} />

      <hr />
      <h2>Markets</h2>
      <MarketsSection net={net} engine={engine} now={now} serverNow={serverNow} error={error} success={success} />

      <hr />
      <h2>Player Trades</h2>
      <PlayerTradesSection net={net} engine={engine} now={now} serverNow={serverNow} error={error} success={success} />

      <hr />
      <h2>Activity</h2>
      <HistorySection />

      <hr />
      <h2 id="voice">Voice Assistant</h2>
      <VoiceAssistantPanel />
    </div>
  )
}

function ResourcesTable({ state, store }: { state: { resources: Record<string, number>; depletion: Record<string, number> }; store: { update: (fn: (s: any) => any) => void } }) {
  return (
    <pre>
      {RESOURCE_KEYS.map((k) => {
        const val = state.resources[k]
        const line = k === 'money' ? `  ${LABELS[k]}: $${fmt(val)}` : `  ${LABELS[k]}: ${fmt(val, 1)}`
        const depleting = DEPLETING_KEYS.includes(k as any)
        const rate = depleting ? state.depletion[k as 'biomass' | 'oxygen'] : null
        return `${line}${rate !== null ? ` (-${fmt(rate, 2)}/s)` : ''}\n`
      })}
    </pre>
  )
}

function MarketsSection({ net, engine, now, serverNow, error, success }: {
  net: any
  engine: any
  now: number
  serverNow: number
  error: (title: string, msg: string) => void
  success: (title: string, msg?: string) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const market = net.markets.find((m: any) => m.name === selected) ?? net.markets[0]
  const untilUpdate = net.nextUpdateAt ? seconds(net.nextUpdateAt - serverNow) : null

  async function trade(side: 'buy' | 'sell', resource: TradableKey) {
    const quantity = Number(qty[resource] ?? 1)
    setBusy(true)
    try {
      const r = side === 'buy'
        ? await engine.buyFromMarket(market.name, resource, quantity)
        : await engine.sellToMarket(market.name, resource, quantity)
      success(`${side === 'buy' ? 'Bought' : 'Sold'} ${r.quantity} ${LABELS[resource]}`, `$${fmt(r.total)}`)
    } catch (e) {
      error('Order failed', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (net.markets.length === 0) {
    return <p>{net.error ?? 'Loading markets…'}</p>
  }

  return (
    <div>
      <p>Markets: {net.markets.map((m: any) => (
        <span key={m.name}>
          <a href="#" onClick={(e) => { e.preventDefault(); setSelected(m.name) }} style={{ color: m.name === market.name ? 'blue' : 'inherit', textDecoration: m.name === market.name ? 'underline' : 'none' }}>
            {m.name}
          </a>{' '}
        </span>
      ))}</p>
      {untilUpdate !== null && <p>Prices update in {untilUpdate}s</p>}
      <pre>
        {PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k]).map((k) => {
          const p = market.prices[k]!
          return `  ${LABELS[k]}: buy ${fmt(p.buy)} / sell ${fmt(p.sell)}\n`
        })}
      </pre>
      <p>Trade with market:</p>
      <form onSubmit={(e) => e.preventDefault()}>
        {PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k]).map((k) => (
          <div key={k}>
            <label>
              {LABELS[k]}: qty{' '}
              <input
                type="number"
                min="1"
                defaultValue={qty[k] ?? '1'}
                onChange={(e) => setQty({ ...qty, [k]: e.target.value })}
                style={{ width: '60px' }}
              />{' '}
              <button disabled={busy} onClick={() => trade('buy', k)}>Buy</button>{' '}
              <button disabled={busy} onClick={() => trade('sell', k)}>Sell</button>
            </label>
          </div>
        ))}
      </form>
    </div>
  )
}

function PlayerTradesSection({ net, engine, now, serverNow, error, success }: {
  net: any
  engine: any
  now: number
  serverNow: number
  error: (title: string, msg: string) => void
  success: (msg: string) => void
}) {
  const [draft, setDraft] = useState({ to: '', side: 'sell' as 'buy' | 'sell', resource: 'metal' as TradableKey, quantity: '1', unitPrice: '10' })
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try {
      await fn()
      if (ok) success(ok)
    } catch (e) {
      error('Trade failed', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const send = () =>
    run(
      () => engine.sendTrade({ to: draft.to, side: draft.side, resource: draft.resource, quantity: Number(draft.quantity), unitPrice: Number(draft.unitPrice) }),
      `Request sent to ${draft.to} — they have ${TRADE_TTL_MS / 1000}s to accept`,
    )

  const counter = (t: Trade) => {
    void engine.declineTrade(t.id).catch(() => {})
    setDraft({ to: t.fromName, side: t.side === 'sell' ? 'buy' : 'sell', resource: t.resource, quantity: String(t.quantity), unitPrice: String(t.unitPrice) })
  }

  const total = Math.round(Number(draft.quantity) * Number(draft.unitPrice) * 100) / 100

  return (
    <div>
      <p>Send trade request:</p>
      <form onSubmit={(e) => { e.preventDefault(); send() }}>
        <div>
          <label>Player: <input list="trade-players" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="Name or email" /></label>
          <datalist id="trade-players">{net.players.map((p: string) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label>Side:{' '}
            <select value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value as 'buy' | 'sell' })}>
              <option value="sell">I sell</option>
              <option value="buy">I buy</option>
            </select>
          </label>
        </div>
        <div>
          <label>Resource:{' '}
            <select value={draft.resource} onChange={(e) => setDraft({ ...draft, resource: e.target.value as TradableKey })}>
              {PLAYER_TRADABLE_KEYS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
            </select>
          </label>
        </div>
        <div>
          <label>Qty: <input type="number" min="1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} style={{ width: '60px' }} /></label>
        </div>
        <div>
          <label>Price/unit: <input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })} style={{ width: '80px' }} /></label>
        </div>
        <p>Total: ${fmt(total)}. Your side is held until they answer.</p>
        <button type="submit" disabled={busy || !draft.to.trim()}>Send request</button>
      </form>

      {net.incoming.length > 0 && (
        <div>
          <h3>Requests for you</h3>
          <pre>
            {net.incoming.map((t: Trade) => {
              const left = seconds(t.expiresAt - serverNow)
              const { give, receive } = tradeLegs(t, 'recipient')
              const desc = (d: Record<string, number>) => Object.entries(d).map(([rk, v]) => (rk === 'money' ? `$${fmt(v)}` : `${v} ${LABELS[rk as keyof typeof LABELS]}`)).join(', ')
              return `  ${t.fromName} offers ${desc(receive)} for ${desc(give)} (${fmt(t.unitPrice)} each, ${left}s left)\n    [Accept] [Counter] [Decline]\n`
            })}
          </pre>
          <div>
            {net.incoming.map((t: Trade) => {
              const left = seconds(t.expiresAt - serverNow)
              return (
                <div key={t.id} style={{ marginBottom: '0.5rem' }}>
                  <span>{t.fromName}: </span>
                  <button disabled={busy || left <= 0} onClick={() => run(() => engine.acceptTrade(t.id), 'Trade completed')}>Accept</button>{' '}
                  <button disabled={busy} onClick={() => counter(t)}>Counter</button>{' '}
                  <button disabled={busy} onClick={() => run(() => engine.declineTrade(t.id))}>Decline</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {net.outgoing.length > 0 && (
        <div>
          <h3>Your pending requests</h3>
          <pre>
            {net.outgoing.map((t: Trade) => {
              const { give, receive } = tradeLegs(t, 'requester')
              const desc = (d: Record<string, number>) => Object.entries(d).map(([rk, v]) => (rk === 'money' ? `$${fmt(v)}` : `${v} ${LABELS[rk as keyof typeof LABELS]}`)).join(', ')
              return `  To ${t.toName}: give ${desc(give)} for ${desc(receive)} (${seconds(t.expiresAt - serverNow)}s left)\n`
            })}
          </pre>
          {net.outgoing.map((t: Trade) => (
            <div key={t.id} style={{ marginBottom: '0.5rem' }}>
              <span>To {t.toName}: </span>
              <button disabled={busy} onClick={() => run(() => engine.cancelTrade(t.id))}>Cancel</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistorySection() {
  const { history } = useGameState()
  if (history.length === 0) return <p>Nothing yet.</p>
  return (
    <pre>
      {[...history].reverse().slice(0, 20).map((h) =>
        `  [${new Date(h.at).toLocaleTimeString()}] ${h.text}\n`
      )}
    </pre>
  )
}
