/**
 * Gated routes. Any file under src/pages/(app)/(protected)/ requires sign-in.
 * The `(protected)` folder is a Generouted route group — parentheses mean
 * it doesn't appear in the URL. For a dynamic page that does NOT require
 * sign-in, put it directly under src/pages/(app)/; for a static page, put it
 * at the top level of src/pages/.
 *
 * Children may call data hooks like `useUser()` safely because the parent
 * (app)/_layout.tsx mounts <RecordProvider> above this layout.
 *
 * The `fallback` keeps signed-out visitors inside the app's own chrome
 * (without it, AuthGate shows the SDK's full-screen, non-dismissible
 * overlay). The sign-in overlay opens on demand and can be dismissed.
 */

import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { AuthGate, AuthOverlay } from 'deepspace'
// import { Button } from '@/components/ui'
import { GameProvider } from '@/game/GameProvider'
import RobcoShell from '@/FancyComp/RobcoShell'
import { TerminalFrame } from '@/FancyComp/parts'

export default function ProtectedLayout() {
  return (
    <AuthGate fallback={<SignedOutPanel />}>
      <GameProvider>
        <RobcoShell />
      </GameProvider>
    </AuthGate>
  )
}

function SignedOutPanel() {
  const [open, setOpen] = useState(false)
  return (
    <TerminalFrame>
      <div className="rc-center">
        <div className="rc-win">
          <div className="rc-titlebar"><div className="t"><small>robco.exe_</small><b>ACCESS RESTRICTED</b></div></div>
          <div style={{ padding: 24 }}>
            <h1>AUTHENTICATION REQUIRED</h1>
            <p className="rc-muted">This terminal is only available to signed-in operators.</p>
            <p style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
              <button onClick={() => setOpen(true)}>SIGN IN ▶</button>
              <Link to="/">Back to home</Link>
            </p>
          </div>
        </div>
      </div>
      {open && <AuthOverlay onClose={() => setOpen(false)} />}
    </TerminalFrame>
  )
}
