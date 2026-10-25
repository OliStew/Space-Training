/**
 * The terminal chrome: ticker, left square buttons, centre pop-up window,
 * glowing connector line, and the floating CORA AI. Pages render into <Outlet />.
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useGame, useNow } from '@/game/GameProvider'
import { calcDayTime } from '@/game'
import { fmt, seconds } from '@/components/trading/format'
import { AIPanel } from '@/components/aiLogicAndVisual/AiPanel'
import { Badge, TerminalFrame } from './parts'
import { EndStateModal } from './EndStateModal'

const ICON = {
  dashboard: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  trading: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4',
  simulate: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2',
  language: 'M4 5h9M8.5 3v2M6 5c0 4 3 7 7 8M12 5c0 4-3 7-7 8M14 21l4-10 4 10M15.5 18h5',
  bot: 'M12 4v3M7 8h10a3 3 0 013 3v6a3 3 0 01-3 3H7a3 3 0 01-3-3v-6a3 3 0 013-3zM9 13h.01M15 13h.01M9 17h6',
}
const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" aria-hidden><path d={d} /></svg>
)

const NAV = [
  { to: '/trade', label: 'DASHBOARD', icon: ICON.dashboard, title: 'COMMAND DASHBOARD' },
  { to: '/trades', label: 'TRADING', icon: ICON.trading, title: 'MARKETS & PLAYER TRADING' },
  { to: '/simulation', label: 'SIMULATE', icon: ICON.simulate, title: 'SCENARIO SIMULATOR' },
  { to: '/settings', label: 'SETTINGS', icon: ICON.settings, title: 'TERMINAL SYSTEM SETTINGS' },
  { to: '/language', label: 'LANGUAGE', icon: ICON.language, title: 'ALIEN LANGUAGE GAME' },
]

type Pt = [number, number]

export default function RobcoShell() {
  const { pathname } = useLocation()
  const { state, net } = useGame()
  const now = useNow()
  const [agentOpen, setAgentOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const winRef = useRef<HTMLElement>(null)
  const [pts, setPts] = useState<Pt[] | null>(null)
  const active = NAV.findIndex((n) => n.to === pathname)

  // Route the glowing line from the active square to the window's left edge.
  useLayoutEffect(() => {
    const measure = () => {
      const grid = gridRef.current, win = winRef.current
      const btn = grid?.children[active] as HTMLElement | undefined
      if (!grid || !win || !btn || window.innerWidth < 860) return setPts(null)
      const r = btn.getBoundingClientRect(), g = grid.getBoundingClientRect(), w = win.getBoundingClientRect()
      const ex = w.left, ey = w.top + w.height / 2
      const midX = g.right + (ex - g.right) * 0.55
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      // Left-column squares have a neighbour on the right, so they drop into the row gap first.
      setPts(active % 2 === 0
        ? [[cx, r.bottom], [cx, r.bottom + 7], [midX, r.bottom + 7], [midX, ey], [ex, ey]]
        : [[r.right, cy], [midX, cy], [midX, ey], [ex, ey]])
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    if (winRef.current) ro.observe(winRef.current)
    return () => { window.removeEventListener('resize', measure); ro.disconnect() }
  }, [active])

  const r = state.resources
  const dayTime = calcDayTime(state.gameTime)
  const ticker = [
    `DAY: ${dayTime.day} (${dayTime.timeString})`,
    `CYCLE: ${dayTime.phase} (${Math.round(dayTime.secondsLeftInDay)}S REMAINING)`,
    `OXYGEN: ${fmt(r.oxygen, 1)}`,
    `BIOMASS: ${fmt(r.biomass, 1)}`,
    `CREDITS: $${fmt(r.money)}`,
    `INCOMING TRADES: ${net.incoming.length}`,
    `ACTIVE HOLDS: ${Object.keys(state.holds).length}`,
    net.nextUpdateAt ? `MARKET UPDATE IN ${seconds(net.nextUpdateAt - (now + net.clockSkew))}S` : `MARKET LINK: ${net.error ? 'OFFLINE' : 'ONLINE'}`,
  ]
  const group = (k: string) => (
    <div className="rc-group" key={k}>{ticker.map((t, i) => <span key={i}>{t} <b>◆</b></span>)}</div>
  )

  return (
    <TerminalFrame>
      <header className="rc-ticker">
        <div className="rc-brand"><i /><span>ROBCO UOS v2.0</span></div>
        <div className="rc-track"><div className="rc-run">{group('a')}{group('b')}</div></div>
        <div className="rc-ticker-end">
          <Badge kind="out">DAY {dayTime.day}</Badge>
          <span title={`${dayTime.display} (${dayTime.phase}) — ${Math.round(dayTime.secondsLeftInDay)}s remaining`}>
            {dayTime.timeString} [{dayTime.phase}]
          </span>
        </div>
      </header>

      {pts && (
        <svg className="rc-line" aria-hidden>
          <path d={'M' + pts.map((p) => p.join(' ')).join(' L')} />
          <rect x={pts[0][0] - 5} y={pts[0][1] - 5} width="10" height="10" />
          <rect x={pts[pts.length - 1][0] - 6} y={pts[pts.length - 1][1] - 6} width="12" height="12" />
        </svg>
      )}

      <main className="rc-main">
        <aside className="rc-rail">
          <div>
            <div className="rc-railmeta"><Link to="/">◀ HOME</Link><span>NAV / 0{NAV.length}</span></div>
            <nav className="rc-grid" ref={gridRef} aria-label="Main navigation">
              {NAV.map((n, i) => (
                <Link key={n.to} to={n.to} className={`rc-nav${i === active ? ' active' : ''}`} aria-current={i === active ? 'page' : undefined}>
                  <span className="n">0{i + 1}</span><Icon d={n.icon} /><span className="l">{n.label}</span>
                </Link>
              ))}
            </nav>
          </div>
          <button className="rc-agent-btn" onClick={() => setAgentOpen((o) => !o)} aria-expanded={agentOpen}>
            <Icon d={ICON.bot} /><span><small>AI FIELD AGENT</small><b>SYSTEM: CORA AI</b></span>
          </button>
        </aside>

        <section className="rc-win rc-win-main" ref={winRef}>
          <div className="rc-titlebar">
            <div className="t"><small>robco.exe_</small><b>{NAV[active]?.title ?? 'ROBCO TERMINAL'}</b></div>
            <span className="rc-muted" style={{ marginRight: 12 }}>● CONNECTED</span>
          </div>
          <div className="rc-body" key={pathname}><Outlet /></div>
        </section>
      </main>

      {/* Always mounted (just hidden) so the chat and voice state survive closing the pop-up. */}
      <aside className="rc-win rc-agent" hidden={!agentOpen} aria-label="CORA AI">
        <div className="rc-titlebar">
          <div className="t"><b>cora_ai.exe_</b></div>
          <button className="rc-x" onClick={() => setAgentOpen(false)} aria-label="Close CORA AI">×</button>
        </div>
        <div className="rc-agent-body"><AIPanel /></div>
      </aside>

      {/* End state modal: displays Victory on Day 30 or Defeat on 0% health */}
      <EndStateModal />
    </TerminalFrame>
  )
}
