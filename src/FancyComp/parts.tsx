import './goopcorp.css'
import type { ReactNode } from 'react'
import { usePrefs } from './prefs'

/** Root of every terminal screen: theme, CRT overlays, flicker. */
export function TerminalFrame({ children }: { children: ReactNode }) {
  const p = usePrefs()
  return (
    <div className={`rc-root${p.flicker ? ' rc-flicker' : ''}`} data-theme={p.theme}>
      {children}
      {p.scanlines && (<><div className="rc-vig" /><div className="rc-scan" /></>)}
    </div>
  )
}

export function Panel({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rc-panel">
      <header className="rc-panel-head"><h2>[ {title} ]</h2>{right && <span>{right}</span>}</header>
      {children}
    </section>
  )
}

export const Badge = ({ kind = '', children }: { kind?: '' | 'out' | 'warn' | 'crit'; children: ReactNode }) =>
  <span className={`rc-badge ${kind}`}>{children}</span>

export const Meter = ({ value, max }: { value: number; max: number }) =>
  <div className="rc-meter"><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>
