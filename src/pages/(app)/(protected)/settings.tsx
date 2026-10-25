/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useCallback, useState } from 'react'
import { signOut, useUser } from 'deepspace'
import { Button } from '@/components/ui'
import { callAction } from '@/lib/actions'

export default function SettingsPage() {
  const { user } = useUser()
  const userId = user?.id
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleResetData = useCallback(async () => {
    if (!confirm('This will reset all data to defaults — markets, trades, and settings. This cannot be undone. Continue?')) {
      return
    }
    setResetting(true)
    setResetError(null)
    try {
      const result = await callAction('resetData', {})
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
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-12 text-4xl font-bold tracking-tight">Settings</h1>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-2 text-lg font-semibold">Data</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Reset all server-side data (markets, trades, settings) and local game state back to their defaults. This cannot be undone.
          </p>
          {resetError && <p className="mb-4 text-sm text-destructive">{resetError}</p>}
          <Button variant="destructive" disabled={resetting} onClick={handleResetData}>
            {resetting ? 'Resetting…' : 'Reset all data'}
          </Button>
        </section>
      </div>
    </div>
  )
}
