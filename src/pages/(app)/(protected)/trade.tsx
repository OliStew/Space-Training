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
import { CombatPreview } from '@/components/combat/CombatPreview'

export default function DashboardPage() {
  const { state, net } = useGame()
  const dayTime = useDayTime()
  const serverNow = useNow() + net.clockSkew
  const markets = net.markets as any[]
  const bestPrices = PLAYER_TRADABLE_KEYS.map((k) => {
    const quotes = markets.filter((m) => m.prices[k]).map((m) => ({ name: m.name as string, buy: m.prices[k].buy as number, sell: m.prices[k].sell as number }))
    if (quotes.length === 0) return null
    const bestBuy = quotes.reduce((a, b) => (b.buy < a.buy ? b : a))
    const bestSell = quotes.reduce((a, b) => (b.sell > a.sell ? b : a))
    return { key: k, bestBuy, bestSell }
  }).filter((r): r is NonNullable<typeof r> => r !== null)
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
        {markets.length === 0 ? <p className="rc-muted">{net.error ?? 'Loading…'}</p> : (
          <>
            <p className="rc-muted">
              Best price for each resource across {markets.length} market{markets.length === 1 ? '' : 's'}.
              {net.nextUpdateAt && <> Updates in {seconds(net.nextUpdateAt - serverNow)}s.</>}
            </p>
            {bestPrices.map(({ key, bestBuy, bestSell }) => (
              <div className="rc-row" key={key}>
                <span style={{ flex: '0 0 auto', minWidth: 90 }}>{LABELS[key]}</span>
                <span style={{ flex: '1 1 0', textAlign: 'right' }}>
                  buy {fmt(bestBuy.buy)} <span className="rc-muted">({bestBuy.name})</span> / sell {fmt(bestSell.sell)} <span className="rc-muted">({bestSell.name})</span>
                </span>
              </div>
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

      <Panel title="INCOMING ATTACKS" right={<Link to="/combat">OPEN COMBAT ▶</Link>}>
        <CombatPreview />
      </Panel>

      <Panel title="ALIEN LANGUAGE GAME" right={<Link to="/language">PLAY ▶</Link>}>
        <p className="rc-muted">Decode alien words to learn their language.</p>
      </Panel>
    </>
  )
}
