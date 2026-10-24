import { useEffect, useState } from 'react'
import { useYjsRoom } from 'deepspace'
import { Button } from '@/components/ui'

const minPrice = 1.0

/**
 * Solves the system:
 *   y = -x + demand
 *   y =  x - supply
 *
 * Adding: 2y = demand - supply  →  y = (demand - supply) / 2
 * Price is the y-value of the intersection, clamped to a minimum floor.
 */
function computePrice(demand: number, supply: number): number {
  return Math.max(minPrice, (demand - supply) / 2)
}

export default function MarketPage() {
  // Standalone Yjs room — all users share the same docId 'market'
  const { doc, synced, canWrite } = useYjsRoom('market', 'data')

  // Shared Yjs Map holds demand and supply
  const marketMap = doc.getMap('market')

  // Local per-user money (not synced — each user tracks their own)
  const [money, setMoney] = useState(100)

  // Mirror shared values into React state on every Yjs update
  // Initial values give the market a non-zero starting price
  const [demand, setDemand] = useState(10)
  const [supply, setSupply] = useState(5)

  useEffect(() => {
    const refresh = () => {
      // Use initial defaults (10/5) when the Yjs map is empty
      setDemand((marketMap.get('demand') as number) ?? 10)
      setSupply((marketMap.get('supply') as number) ?? 5)
    }
    refresh()
    marketMap.observe(refresh)
    return () => marketMap.unobserve(refresh)
  }, [marketMap])

  const price = computePrice(demand, supply)

  function incrementDemand() {
    if (!canWrite) return
    doc.transact(() => {
      const current = (marketMap.get('demand') as number) ?? 10
      marketMap.set('demand', current + 1)
    })
    // Incrementing demand decreases money by price
    setMoney((m) => m - price)
  }

  function incrementSupply() {
    if (!canWrite) return
    doc.transact(() => {
      const current = (marketMap.get('supply') as number) ?? 5
      marketMap.set('supply', current + 1)
    })
    // Incrementing supply increases money by price
    setMoney((m) => m + price)
  }

  if (!synced) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted-foreground">
        Connecting to market...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Market</h1>

      {/* Shared state display */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Price</p>
          <p className="text-2xl font-mono font-semibold text-foreground">
            {price.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Demand</p>
          <p className="text-2xl font-mono font-semibold text-foreground">{demand}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-sm text-muted-foreground">Supply</p>
          <p className="text-2xl font-mono font-semibold text-foreground">{supply}</p>
        </div>
      </div>

      {/* Local money display */}
      <div className="mb-8 rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">Your Money</p>
        <p className="text-3xl font-mono font-semibold text-foreground">
          {money.toFixed(2)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={incrementDemand} disabled={!canWrite} className="flex-1">
          Increase Demand (+1)
        </Button>
        <Button onClick={incrementSupply} disabled={!canWrite} className="flex-1">
          Increase Supply (+1)
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Price = max(1.0, (Demand − Supply) / 2) &middot; Buying (demand) costs price &middot; Selling
        (supply) earns price
      </p>
    </div>
  )
}
