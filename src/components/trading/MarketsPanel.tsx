import { useState } from 'react'
import { useMarkets } from '@/game'
import type { TradableKey } from '@/game'
import { describe, fmt, useAttempt } from './util'

/**
 * Buy from / sell to the markets.
 *
 * Uses useMarkets():
 *   markets            [{ name, delaySeconds, prices: { metal: { buy, sell }, ... } }]
 *   deliveries         market trades in transit: { market, side, resource, quantity, receive, secondsLeft }
 *   resources          which resources can be traded
 *   secondsUntilUpdate seconds until prices next change
 *   buy(market, resource, quantity) / sell(...)   -> Promise, throws Error if refused
 *     (price is locked in; the paying side leaves now, the other side arrives after delaySeconds)
 */
export function MarketsPanel() {
  const { markets, deliveries, resources, secondsUntilUpdate, error, buy, sell } = useMarkets()
  const [message, attempt] = useAttempt()
  const [quantity, setQuantity] = useState('1')
  const qty = Number(quantity)

  return (
    <section>
      <h2>Markets</h2>
      <p>
        Quantity: <input type="number" min="1" step="1" size={5} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        {secondsUntilUpdate !== null && <> | Prices update in {secondsUntilUpdate}s</>}
      </p>
      {markets.length === 0 && <p>{error ?? 'Loading markets...'}</p>}
      {markets.map((market) => (
        <div key={market.name}>
          <h3>{market.name} ({market.delaySeconds}s away)</h3>
          <table>
            <thead>
              <tr><th>Resource</th><th>You pay</th><th>You get</th><th /></tr>
            </thead>
            <tbody>
              {resources.filter((r) => market.prices[r]).map((r: TradableKey) => (
                <tr key={r}>
                  <td>{r}</td>
                  <td>{fmt(market.prices[r].buy)}</td>
                  <td>{fmt(market.prices[r].sell)}</td>
                  <td>
                    <button onClick={() => attempt(() => buy(market.name, r, qty), `Ordered ${qty} ${r} from ${market.name}; arrives in ${market.delaySeconds}s`)}>Buy</button>{' '}
                    <button onClick={() => attempt(() => sell(market.name, r, qty), `Sold ${qty} ${r} to ${market.name}; paid in ${market.delaySeconds}s`)}>Sell</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {message && <p>{message}</p>}
      <h3>In transit</h3>
      {deliveries.length === 0 && <p>None.</p>}
      <ul>
        {deliveries.map((d) => (
          <li key={d.id}>
            {d.side === 'buy' ? 'Buying' : 'Selling'} {d.quantity} {d.resource} {d.side === 'buy' ? 'from' : 'to'} {d.market} @ {fmt(d.unitPrice)} - arrives in {d.secondsLeft}s ({describe(d.receive)})
          </li>
        ))}
      </ul>
    </section>
  )
}
