/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useCallback, useState } from 'react'
import { signOut, useUser } from 'deepspace'
import { Badge, Panel } from '@/FancyComp/parts'
import { setPrefs, usePrefs, type Theme } from '@/FancyComp/prefs'
import { callAction } from '@/lib/actions'
import { useDayTime, useDebugResources } from '@/game'
import { useGame } from '@/game/GameProvider'

const THEMES: [Theme, string][] = [['green', 'GREEN PHOSPHOR'], ['amber', 'AMBER CLASSIC'], ['cyan', 'CYAN VECTOR'], ['white', 'MONOCHROME']]

export default function SettingsPage() {
  const { user } = useUser()
  const userId = user?.id
  const prefs = usePrefs()
  const dayTime = useDayTime()
  const { store } = useGame()
  const { remove: removeResource } = useDebugResources()
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleResetData = useCallback(async () => {
    if (!confirm('This will reset all data to defaults — markets, trades, and settings. This cannot be undone. Continue?')) {
      return
    }
    setResetting(true)
    setResetError(null)
    try {
      const result = (await callAction('resetData', {})) as { success?: boolean; error?: string }
      if (result?.success === false) {
        throw new Error(result.error ?? 'Server reset failed')
      }
      // Clear ALL client-side game data — do this synchronously right before
      // navigating so the GameStore timer cannot re-persist between clear and reload.
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('life-in-space:')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
      window.location.replace('/')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset data')
    } finally {
      setResetting(false)
    }
  }, [])

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

      <Panel title="DATA">
        <p className="rc-muted" style={{ marginBottom: 10 }}>
          Reset all server-side data (markets, trades, settings) and local game state back to their defaults. This cannot be undone.
        </p>
        {resetError && <p style={{ color: 'var(--destructive, #ef4444)', marginBottom: 10, fontSize: '0.875rem' }}>{resetError}</p>}
        <button className="danger" disabled={resetting} onClick={handleResetData}>
          {resetting ? 'Resetting…' : 'Reset all data'}
        </button>
      </Panel>
    </>
  )
}
