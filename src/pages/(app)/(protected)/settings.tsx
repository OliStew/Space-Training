/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { signOut, useUser } from 'deepspace'
import { Panel } from '@/FancyComp/parts' 
import { setPrefs, usePrefs, type Theme } from '@/FancyComp/prefs'

const THEMES: [Theme, string][] = [['green', 'GREEN PHOSPHOR'], ['amber', 'AMBER CLASSIC'], ['cyan', 'CYAN VECTOR'], ['white', 'MONOCHROME']]

export default function SettingsPage() {
  const { user } = useUser()
  const prefs = usePrefs()

return (
    <>
      <Panel title="YOUR ACCOUNT">
        <div className="rc-row"><span className="rc-muted">NAME</span>{user?.name ?? '—'}</div>
        <div className="rc-row"><span className="rc-muted">EMAIL</span>{user?.email ?? '—'}</div>
        <p style={{ marginTop: 14 }}><button className="danger" onClick={() => signOut()}>SIGN OUT</button></p>
      </Panel>

      <Panel title="TERMINAL COLOR PALETTE">
        <div className="rc-tabs">
          {THEMES.map(([t, label]) => (
            <button key={t} className={prefs.theme === t ? '' : 'ghost'} onClick={() => setPrefs({ theme: t })}>{label}</button>
          ))}
        </div>
      </Panel>

      <Panel title="VISUAL & CRT CONTROLS">
        <label className="rc-row"><span>Scanlines &amp; screen overlay</span><input type="checkbox" checked={prefs.scanlines} onChange={(e) => setPrefs({ scanlines: e.target.checked })} /></label>
        <label className="rc-row"><span>CRT tube flicker</span><input type="checkbox" checked={prefs.flicker} onChange={(e) => setPrefs({ flicker: e.target.checked })} /></label>
      </Panel>
    </>
  )
}
