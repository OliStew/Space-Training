/**
 * Full trades page — markets, player trades, history, and voice assistant.
 * Plain text only; no styled UI.
 */

import { useState } from 'react'
import { useGame, useNow, useGameState } from '@/game/GameProvider'
import { useToast } from '@/components/ui'
import { PLAYER_TRADABLE_KEYS } from '@/game/state'
import { TRADE_TTL_MS } from '@/shared/types'
import type { TradableKey, Trade } from '@/shared/types'
import { tradeLegs } from '@/shared/trade-book'
import { fmt, LABELS, seconds } from '@/components/trading/format'
import { VoiceAssistantPanel } from '@/components/trading/VoiceAssistantPanel'
import { Panel } from '@/FancyComp/parts'
import { ResourceTiles } from '@/FancyComp/ResourceTiles'

const describe = (d: Record<string, number>) =>
  Object.entries(d).map(([k, v]) => (k === 'money' ? `$${fmt(v)}` : `${v} ${LABELS[k as keyof typeof LABELS]}`)).join(', ')

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function TradesPage() {
  const { state, net, engine } = useGame()
  const { error, success } = useToast()
  const serverNow = useNow() + net.clockSkew

  return (
    <>
      <Panel title="RESOURCES"><ResourceTiles state={state} /></Panel>
      <Panel title="STATION MARKETS" right={net.nextUpdateAt ? `PRICES UPDATE IN ${seconds(net.nextUpdateAt - serverNow)}S` : undefined}>
        <MarketsSection net={net} engine={engine} state={state} error={error} success={success} />
      </Panel>
      <Panel title="PLAYER TRADES NETWORK">
        <PlayerTradesSection net={net} engine={engine} serverNow={serverNow} error={error} success={success} />
      </Panel>
      <Panel title="RECENT ACTIVITY"><HistorySection /></Panel>
      <Panel title="VOICE ASSISTANT"><VoiceAssistantPanel /></Panel>
    </>
  )
}

function MarketsSection({ net, engine, error, success, state }: { net: any; engine: any; state: any; error: (t: string, m: string) => void; success: (t: string, m?: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (net.markets.length === 0) return <p className="rc-muted">{net.error ?? 'Loading markets…'}</p>
  const market = net.markets.find((m: any) => m.name === selected) ?? net.markets[0]
  const keys = PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k])

  async function trade(side: 'buy' | 'sell', resource: TradableKey) {
    setBusy(true)
    try {
      const n = Number(qty[resource] ?? 1)
      const r = side === 'buy' ? await engine.buyFromMarket(market.name, resource, n) : await engine.sellToMarket(market.name, resource, n)
      success(`${side === 'buy' ? 'Bought' : 'Sold'} ${r.quantity} ${LABELS[resource]}`, `$${fmt(r.total)}`)
    } catch (e) { error('Order failed', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="rc-tabs">
        {net.markets.map((m: any) => {
          const delay = state.marketDelays[m.name] ?? 0
          return (
            <button key={m.name} className={m.name === market.name ? '' : 'ghost'} onClick={() => setSelected(m.name)}>
              {m.name} ({delay}s away)
            </button>
          )
        })}
      </div>
      {keys.map((k) => (
        <div className="rc-row" key={k}>
          <span>{LABELS[k]}: buy {fmt(market.prices[k]!.buy)} / sell {fmt(market.prices[k]!.sell)}</span>
          <input type="number" min="1" value={qty[k] ?? '1'} onChange={(e) => setQty({ ...qty, [k]: e.target.value })} style={{ width: 70 }} aria-label={`${LABELS[k]} quantity`} />
          <button type="button" disabled={busy} onClick={() => trade('buy', k)}>BUY</button>
          <button type="button" className="ghost" disabled={busy} onClick={() => trade('sell', k)}>SELL</button>
        </div>
      ))}
    </>
  )
}

function PlayerTradesSection({ net, engine, serverNow, error, success }: { net: any; engine: any; serverNow: number; error: (t: string, m: string) => void; success: (m: string) => void }) {
  const [draft, setDraft] = useState({ to: '', side: 'sell' as 'buy' | 'sell', resource: 'metal' as TradableKey, quantity: '1', unitPrice: '10' })
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<typeof draft>) => setDraft({ ...draft, ...p })

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    try { await fn(); if (ok) success(ok) } catch (e) { error('Trade failed', errMsg(e)) } finally { setBusy(false) }
  }

  const send = () => run(
    () => engine.sendTrade({ to: draft.to, side: draft.side, resource: draft.resource, quantity: Number(draft.quantity), unitPrice: Number(draft.unitPrice) }),
    `Request sent to ${draft.to} — they have ${TRADE_TTL_MS / 1000}s to accept`,
  )
  const counter = (t: Trade) => {
    void engine.declineTrade(t.id).catch(() => {})
    setDraft({ to: t.fromName, side: t.side === 'sell' ? 'buy' : 'sell', resource: t.resource, quantity: String(t.quantity), unitPrice: String(t.unitPrice) })
  }
  const total = Math.round(Number(draft.quantity) * Number(draft.unitPrice) * 100) / 100

  return (
    <>
      <form className="rc-form" onSubmit={(e) => { e.preventDefault(); send() }}>
        <label>PLAYER
          <input list="trade-players" value={draft.to} onChange={(e) => set({ to: e.target.value })} placeholder="Name or email" />
          <datalist id="trade-players">{net.players.map((p: string) => <option key={p} value={p} />)}</datalist>
        </label>
        <label>SIDE
          <select value={draft.side} onChange={(e) => set({ side: e.target.value as 'buy' | 'sell' })}><option value="sell">I sell</option><option value="buy">I buy</option></select>
        </label>
        <label>RESOURCE
          <select value={draft.resource} onChange={(e) => set({ resource: e.target.value as TradableKey })}>
            {PLAYER_TRADABLE_KEYS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
          </select>
        </label>
        <label>QTY<input type="number" min="1" value={draft.quantity} onChange={(e) => set({ quantity: e.target.value })} /></label>
        <label>PRICE / UNIT<input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => set({ unitPrice: e.target.value })} /></label>
        <button type="submit" disabled={busy || !draft.to.trim()}>SEND REQUEST</button>
      </form>
      <p className="rc-muted">Total: ${fmt(total)}. Your side is held until they answer.</p>

      {net.incoming.length > 0 && (
        <>
          <h3>REQUESTS FOR YOU</h3>
          {net.incoming.map((t: Trade) => {
            const left = seconds(t.expiresAt - serverNow)
            const { give, receive } = tradeLegs(t, 'recipient')
            return (
              <div className="rc-row" key={t.id}>
                <span>{t.fromName} offers {describe(receive)} for {describe(give)} ({fmt(t.unitPrice)} each, {left}s left)</span>
                <button disabled={busy || left <= 0} onClick={() => run(() => engine.acceptTrade(t.id), 'Trade completed')}>ACCEPT</button>
                <button className="ghost" disabled={busy} onClick={() => counter(t)}>COUNTER</button>
                <button className="danger" disabled={busy} onClick={() => run(() => engine.declineTrade(t.id))}>DECLINE</button>
              </div>
            )
          })}
        </>
      )}

      {net.outgoing.length > 0 && (
        <>
          <h3>YOUR PENDING REQUESTS</h3>
          {net.outgoing.map((t: Trade) => {
            const { give, receive } = tradeLegs(t, 'requester')
            return (
              <div className="rc-row" key={t.id}>
                <span>To {t.toName}: give {describe(give)} for {describe(receive)} ({seconds(t.expiresAt - serverNow)}s left)</span>
                <button className="danger" disabled={busy} onClick={() => run(() => engine.cancelTrade(t.id))}>CANCEL</button>
              </div>
            )
          })}
        </>
      )}
    </>
  )
}

function HistorySection() {
  const { history } = useGameState()
  if (history.length === 0) return <p className="rc-muted">Nothing yet.</p>
  return <pre>{[...history].reverse().slice(0, 20).map((h) => `[${new Date(h.at).toLocaleTimeString()}] ${h.text}\n`).join('')}</pre>
}
