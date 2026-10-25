/**
 * Dashboard — main overview page. Plain text only; no styled UI.
 * Shows resources, market preview, trades preview, simulation preview,
 * and a link to the voice assistant.
 */

import { Link } from 'react-router-dom'
import { useGame, useNow } from '@/game/GameProvider'
import { PLAYER_TRADABLE_KEYS, DEPLETING_KEYS } from '@/game/state'
import { tradeLegs } from '@/shared/trade-book'
import { fmt, LABELS, seconds } from '@/components/trading/format'
import { Badge, Panel } from '@/FancyComp/parts'
import { ResourceTiles } from '@/FancyComp/ResourceTiles'
import { depletionRows, sumResources } from '@/FancyComp/sim'
import { RESOURCE_KEYS } from '@/shared/types'
import { AIPanel } from '@/components/aiLogicAndVisual/AiPanel'


export default function DashboardPage() {
  const { state, net } = useGame()
  const serverNow = useNow() + net.clockSkew
  const market = net.markets[0]
  const holds = Object.values(state.holds) as any[]

  return (
    <>
      <Panel title="RESOURCES"><ResourceTiles state={state} /></Panel>

      <Panel title="MARKET PRICES" right={<Link to="/trades">OPEN MARKETS ▶</Link>}>
        {!market ? <p className="rc-muted">{net.error ?? 'Loading…'}</p> : (
          <>
            {net.nextUpdateAt && <p className="rc-muted">Updates in {seconds(net.nextUpdateAt - serverNow)}s</p>}
            {PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k]).map((k) => (
              <div className="rc-row" key={k}><span>{LABELS[k]}</span>buy {fmt(market.prices[k]!.buy)} / sell {fmt(market.prices[k]!.sell)}</div>
            ))}
          </>
        )}
      </Panel>

      <Panel title="INCOMING TRADES" right={<Badge kind={net.incoming.length ? '' : 'out'}>{net.incoming.length} PENDING</Badge>}>
        {net.incoming.length === 0 ? <p className="rc-muted">No requests.</p> : (
          <>
            {net.incoming.slice(0, 5).map((t: any) => {
              const qty = tradeLegs(t, 'recipient').receive[t.resource] ?? 0
              return <div className="rc-row" key={t.id}><span>{t.fromName} → {qty} {LABELS[t.resource as keyof typeof LABELS]}</span>{seconds(t.expiresAt - serverNow)}s left</div>
            })}
            {net.incoming.length > 5 && <p className="rc-muted">… and {net.incoming.length - 5} more</p>}
          </>
        )}
      </Panel>

      <Panel title="CURRENT TRADES" right={<Link to="/trades">MANAGE ▶</Link>}>
        <p>Outgoing requests: {net.outgoing.length}</p>
        {net.outgoing.slice(0, 5).map((t: any) => (
          <div className="rc-row" key={t.id}>You → {t.toName}: {tradeLegs(t, 'requester').give[t.resource] ?? 0} {LABELS[t.resource as keyof typeof LABELS]}</div>
        ))}
        <p>Active holds: {holds.length}</p>
        {holds.slice(0, 5).map((h, i) => (
          <div className="rc-row" key={i}>{h.summary.counterparty}: {h.give[h.summary.resource] ?? 0} {h.summary.resource} (held)</div>
        ))}
      </Panel>

      <hr />
      <h2><Link to="/trades">Current Trades</Link></h2>
      <pre>
        Outgoing requests: {net.outgoing.length}
        {net.outgoing.slice(0, 5).map((t) => {
          const { give } = tradeLegs(t, 'requester')
          const qty = give[t.resource] ?? 0
          return `\n  You → ${t.toName}: ${qty} ${LABELS[t.resource]}`
        })}
        Active holds: {Object.keys(state.holds).length}
        {Object.entries(state.holds).slice(0, 5).map(([id, hold]) => {
          const qty = hold.give[hold.summary.resource] ?? 0
          return `\n  ${hold.summary.counterparty}: ${qty} ${hold.summary.resource} (held)`
        })}
      </pre>

      <hr />
      <h2><Link to="/simulation">Simulation</Link></h2>
      <pre>
        {DEPLETING_KEYS.map((k) => {
          const amount = state.resources[k]
          const rate = state.depletion[k]
          const left = rate > 0 ? `${Math.ceil(amount / rate)}s` : '∞'
          return `  ${LABELS[k]}: ${fmt(amount, 1)} (${left} left at ${fmt(rate, 2)}/s)\n`
        })}
        Total resources: ${RESOURCE_KEYS.reduce((s, k) => s + state.resources[k], 0).toLocaleString()}
      </pre>

      <hr />
      <AIPanel />
      <hr />
      <h2><Link to="/language">Alien Language Game</Link></h2>

      <Panel title="SIMULATION" right={<Link to="/simulation">DETAILS ▶</Link>}>
        {depletionRows(state).map((d) => (
          <div className="rc-row" key={d.key}>
            <span>{LABELS[d.key]}: {fmt(d.amount, 1)}</span>{d.left === Infinity ? '∞' : `${d.left}s`} left at {fmt(d.rate, 2)}/s
          </div>
        ))}
        <p>Total resources: ${sumResources(state).toLocaleString()}</p>
      </Panel>
    </>
  )
}
