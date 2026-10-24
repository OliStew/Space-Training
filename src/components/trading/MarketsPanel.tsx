import { useState } from 'react'
import { Button, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useGame, useNow } from '@/game/GameProvider'
import { PLAYER_TRADABLE_KEYS } from '@/game/state'
import type { TradableKey } from '@/shared/types'
import { fmt, LABELS, seconds } from './format'

/** Buy from / sell to the server-managed markets at their posted prices. */
export function MarketsPanel() {
  const { net, engine } = useGame()
  const { error, success } = useToast()
  const now = useNow()
  const [selected, setSelected] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const market = net.markets.find((m) => m.name === selected) ?? net.markets[0]
  const untilUpdate = net.nextUpdateAt ? seconds(net.nextUpdateAt - (now + net.clockSkew)) : null

  async function trade(side: 'buy' | 'sell', resource: TradableKey) {
    const quantity = Number(qty[resource] ?? 1)
    setBusy(true)
    try {
      const r = side === 'buy' ? await engine.buyFromMarket(market.name, resource, quantity) : await engine.sellToMarket(market.name, resource, quantity)
      success(`${side === 'buy' ? 'Bought' : 'Sold'} ${r.quantity} ${LABELS[resource]}`, `$${fmt(r.total)}`)
    } catch (e) {
      error('Order failed', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">Markets</h2>
        {untilUpdate !== null && <p className="text-xs text-muted-foreground">Prices update in {untilUpdate}s</p>}
      </div>

      {net.markets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{net.error ?? 'Loading markets…'}</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {net.markets.map((m) => (
              <Button key={m.name} size="sm" variant={m.name === market.name ? 'default' : 'outline'} onClick={() => setSelected(m.name)}>
                {m.name}
              </Button>
            ))}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 font-normal">Resource</th>
                <th className="py-1 text-right font-normal">You pay</th>
                <th className="py-1 text-right font-normal">You get</th>
                <th className="py-1 pl-4 font-normal">Qty</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k]).map((k) => {
                const p = market.prices[k]!
                return (
                  <tr key={k} className="border-t border-border">
                    <td className="py-2">{LABELS[k]}</td>
                    <td className={cn('py-2 text-right font-mono')}>{fmt(p.buy)}</td>
                    <td className="py-2 text-right font-mono">{fmt(p.sell)}</td>
                    <td className="py-2 pl-4">
                      <Input
                        aria-label={`${LABELS[k]} quantity`}
                        className="h-8 w-20"
                        inputMode="numeric"
                        value={qty[k] ?? '1'}
                        onChange={(e) => setQty({ ...qty, [k]: e.target.value })}
                      />
                    </td>
                    <td className="space-x-2 py-2 text-right">
                      <Button size="sm" disabled={busy} onClick={() => trade('buy', k)}>Buy</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => trade('sell', k)}>Sell</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
