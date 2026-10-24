import { useState } from 'react'
import { Button, Input, useToast } from '@/components/ui'
import { useGame, useNow } from '@/game/GameProvider'
import { tradeLegs } from '@/shared/trade-book'
import { PLAYER_TRADABLE_KEYS } from '@/game/state'
import { TRADE_TTL_MS } from '@/shared/types'
import type { TradableKey, Trade } from '@/shared/types'
import { fmt, LABELS, seconds } from './format'

interface Draft {
  to: string
  side: 'buy' | 'sell'
  resource: TradableKey
  quantity: string
  unitPrice: string
}

const EMPTY: Draft = { to: '', side: 'sell', resource: 'metal', quantity: '1', unitPrice: '10' }

const selectClass =
  'h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** Send trade requests to other players, and answer the ones you receive. */
export function PlayerTradePanel() {
  const { net, engine } = useGame()
  const { error, success } = useToast()
  const now = useNow()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const serverNow = now + net.clockSkew

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

  /** A counteroffer is a fresh request back to the sender, with the roles reversed. */
  const counter = (t: Trade) => {
    void engine.declineTrade(t.id).catch(() => {})
    setDraft({ to: t.fromName, side: t.side === 'sell' ? 'buy' : 'sell', resource: t.resource, quantity: String(t.quantity), unitPrice: String(t.unitPrice) })
  }

  const total = Math.round(Number(draft.quantity) * Number(draft.unitPrice) * 100) / 100

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Trade with players</h2>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_5rem_6rem]">
        <Input aria-label="Player name or email" placeholder="Player name or email" list="trade-players" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        <datalist id="trade-players">{net.players.map((p) => <option key={p} value={p} />)}</datalist>
        <select aria-label="Side" className={selectClass} value={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.value as Draft['side'] })}>
          <option value="sell">I sell</option>
          <option value="buy">I buy</option>
        </select>
        <select aria-label="Resource" className={selectClass} value={draft.resource} onChange={(e) => setDraft({ ...draft, resource: e.target.value as TradableKey })}>
          {PLAYER_TRADABLE_KEYS.map((k) => <option key={k} value={k}>{LABELS[k]}</option>)}
        </select>
        <Input aria-label="Quantity" inputMode="numeric" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
        <Input aria-label="Price per unit" inputMode="decimal" value={draft.unitPrice} onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {Number.isFinite(total) ? `${draft.side === 'sell' ? 'You receive' : 'You pay'} $${fmt(total)} in total. ` : ''}
          Your side is held until they answer.
        </p>
        <Button disabled={busy || !draft.to.trim()} onClick={send}>Send request</Button>
      </div>

      {net.incoming.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">Requests for you</h3>
          <ul className="space-y-2">
            {net.incoming.map((t) => {
              const left = seconds(t.expiresAt - serverNow)
              const { give, receive } = tradeLegs(t, 'recipient')
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <span className="flex-1">
                    <strong>{t.fromName}</strong> offers you {describe(receive)} for {describe(give)}
                    <span className="ml-2 text-xs text-muted-foreground">({fmt(t.unitPrice)} each)</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{left}s</span>
                  <Button size="sm" disabled={busy || left <= 0} onClick={() => run(() => engine.acceptTrade(t.id), 'Trade completed')}>Accept</Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => counter(t)}>Counter</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => engine.declineTrade(t.id))}>Decline</Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {net.outgoing.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-sm font-medium text-foreground">Your pending requests</h3>
          <ul className="space-y-2">
            {net.outgoing.map((t) => {
              const { give, receive } = tradeLegs(t, 'requester')
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <span className="flex-1">To <strong>{t.toName}</strong>: you give {describe(give)} for {describe(receive)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{seconds(t.expiresAt - serverNow)}s</span>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => engine.cancelTrade(t.id))}>Cancel</Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}

function describe(delta: Partial<Record<string, number>>): string {
  return Object.entries(delta)
    .map(([k, v]) => (k === 'money' ? `$${fmt(v ?? 0)}` : `${v} ${LABELS[k as keyof typeof LABELS]}`))
    .join(', ')
}
