/**
 * Dashboard — main overview page. Plain text only; no styled UI.
 * Shows resources, market preview, trades preview, simulation preview,
 * and a link to the voice assistant.
 */

import { Link } from 'react-router-dom'
import { DAY_DURATION_SECONDS, useDayTime } from '@/game'
import { useGame, useNow } from '@/game/GameProvider'
import { PLAYER_TRADABLE_KEYS, DEPLETING_KEYS } from '@/game/state'
import { tradeLegs } from '@/shared/trade-book'
import { fmt, LABELS, seconds } from '@/components/trading/format'
import { Badge, Meter, Panel } from '@/FancyComp/parts'
import { ResourceTiles } from '@/FancyComp/ResourceTiles'
import { depletionRows, sumResources } from '@/FancyComp/sim'

export default function DashboardPage() {
  const { state, net } = useGame()
  const dayTime = useDayTime()
  const serverNow = useNow() + net.clockSkew
  const market = net.markets[0]
  const holds = Object.values(state.holds) as any[]

  return (
    <>
      <Panel title="RESOURCES"><ResourceTiles state={state} /></Panel>

      <Panel
        title="STATION CLOCK & DAY CYCLE"
        right={<Badge kind="out">DAY {dayTime.day}</Badge>}
      >
        <div className="rc-row">
          <span>STATION TIME: {dayTime.timeStringFull} <span className="rc-muted">({dayTime.phase})</span></span>
          <span>{dayTime.progressPercent}% ELAPSED</span>
        </div>
        <Meter value={dayTime.progressPercent} max={100} />
        <p className="rc-muted" style={{ marginTop: 8 }}>
          Cycle length: {DAY_DURATION_SECONDS}s per day. {Math.round(dayTime.secondsLeftInDay)}s until Day {dayTime.day + 1}.
        </p>
      </Panel>

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

      <Panel title="SIMULATION" right={<Link to="/simulation">DETAILS ▶</Link>}>
        {depletionRows(state).map((d) => (
          <div className="rc-row" key={d.key}>
            <span>{LABELS[d.key]}: {fmt(d.amount, 1)}</span>{d.left === Infinity ? '∞' : `${d.left}s`} left at {fmt(d.rate, 2)}/s
          </div>
        ))}
        <p>Total resources: ${sumResources(state).toLocaleString()}</p>
      </Panel>

      <Panel title="ALIEN LANGUAGE GAME" right={<Link to="/language">PLAY ▶</Link>}>
        <p className="rc-muted">Decode alien words to learn their language.</p>
      </Panel>
    </>
  )
}