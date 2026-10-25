/**
 * Dashboard — main overview page. Plain text only; no styled UI.
 * Shows resources, market preview, trades preview, simulation preview,
 * and a link to the voice assistant.
 */

import { Link } from 'react-router-dom'
import { useGame, useNow } from '@/game/GameProvider'
import { PLAYER_TRADABLE_KEYS, DEPLETING_KEYS } from '@/game/state'
import { RESOURCE_KEYS } from '@/shared/types'

/** Resources visible on the dashboard — metal and buildings are hidden. */
const VISIBLE_RESOURCE_KEYS = RESOURCE_KEYS.filter((k) => k !== 'metal' && k !== 'buildings')
import { tradeLegs } from '@/shared/trade-book'
import { fmt, LABELS, seconds } from '@/components/trading/format'
import { AIPanel } from '@/components/aiLogicAndVisual/AiPanel'

export default function DashboardPage() {
  const { state, net } = useGame()
  const now = useNow()
  const serverNow = now + net.clockSkew

  return (
    <div style={{ padding: '1rem', fontFamily: 'monospace' }}>
      <h1>Dashboard</h1>

      <hr />
      <h2>Resources</h2>
      <pre>
        {VISIBLE_RESOURCE_KEYS.map((k) => {
          const val = state.resources[k]
          const line = k === 'money' ? `  ${LABELS[k]}: $${fmt(val)}` : `  ${LABELS[k]}: ${fmt(val, 1)}`
          const depletion = DEPLETING_KEYS.includes(k as any)
            ? `  (-${fmt(state.depletion[k as 'biomass' | 'oxygen'], 2)}/s)`
            : ''
          return `${line}${depletion}\n`
        })}
      </pre>

      <hr />
      <h2><Link to="/trades">Market Prices</Link></h2>
      {net.markets.length === 0 ? (
        <p>{net.error ?? 'Loading…'}</p>
      ) : (
        <pre>
          {(() => {
            const market = net.markets[0]
            const lines = []
            if (net.nextUpdateAt) {
              lines.push(`Updates in ${seconds(net.nextUpdateAt - serverNow)}s`)
            }
            PLAYER_TRADABLE_KEYS.filter((k) => market.prices[k]).forEach((k) => {
              const p = market.prices[k]!
              lines.push(`  ${LABELS[k]}: buy ${fmt(p.buy)} / sell ${fmt(p.sell)}`)
            })
            return lines.join('\n') + '\n'
          })()}
        </pre>
      )}

      <hr />
      <h2><Link to="/trades">Incoming Trades</Link> ({net.incoming.length} pending)</h2>
      {net.incoming.length === 0 ? (
        <p>No requests</p>
      ) : (
        <pre>
          {net.incoming.slice(0, 5).map((t) => {
            const left = seconds(t.expiresAt - serverNow)
            const { receive } = tradeLegs(t, 'recipient')
            const qty = receive[t.resource] ?? 0
            return `  ${t.fromName} → ${qty} ${LABELS[t.resource]} (${left}s left)\n`
          })}
          {net.incoming.length > 5 ? `  ... and ${net.incoming.length - 5} more\n` : ''}
        </pre>
      )}

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
        Total resources: ${VISIBLE_RESOURCE_KEYS.reduce((s, k) => s + state.resources[k], 0).toLocaleString()}
      </pre>

      <hr />
    <AIPanel />
        <hr />
        <h2><Link to="/language">Alien Language Game</Link></h2>
    </div>
  )
}
