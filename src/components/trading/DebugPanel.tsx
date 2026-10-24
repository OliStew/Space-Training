import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { applyDelta } from '@/game/state'
import { useGame } from '@/game/GameProvider'
import { RESOURCE_KEYS } from '@/shared/types'
import { LABELS } from './format'

/** Temporary: add or remove any amount of any resource (removal stops at zero). */
export function DebugPanel() {
  const { store } = useGame()
  const [amount, setAmount] = useState('100')
  const n = Number(amount)
  const valid = Number.isFinite(n) && n > 0

  return (
    <section className="rounded-lg border border-dashed border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Debug: adjust resources</h2>
        <Input aria-label="Amount" className="h-8 w-28" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCE_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <span>{LABELS[key]}</span>
            <span className="space-x-2">
              <Button size="sm" variant="outline" disabled={!valid} onClick={() => store.update((s) => applyDelta(s, { [key]: n }, -1))}>− Remove</Button>
              <Button size="sm" disabled={!valid} onClick={() => store.update((s) => applyDelta(s, { [key]: n }))}>+ Add</Button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
