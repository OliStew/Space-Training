import { useState } from 'react'
import { Input } from '@/components/ui'
import { DEPLETING_KEYS, setDepletion } from '@/game/state'
import type { DepletingKey } from '@/game/state'
import { useGame } from '@/game/GameProvider'
import { RESOURCE_KEYS } from '@/shared/types'
import { fmt, LABELS } from './format'

/** Your holdings, with an editable depletion rate for biomass and oxygen. */
export function ResourceBar() {
  const { state, store } = useGame()
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Your resources">
      {RESOURCE_KEYS.map((key) => {
        const depleting = (DEPLETING_KEYS as readonly string[]).includes(key)
        const amount = state.resources[key]
        return (
          <div key={key} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{LABELS[key]}</p>
            <p className="font-mono text-xl font-semibold text-foreground">
              {key === 'money' ? `$${fmt(amount)}` : fmt(amount, 1)}
            </p>
            {depleting && (
              <RateInput
                value={state.depletion[key as DepletingKey]}
                onChange={(v) => store.update((s) => setDepletion(s, key as DepletingKey, v))}
              />
            )}
            {amount === 0 && depleting && <p className="mt-1 text-xs text-destructive">Depleted!</p>}
          </div>
        )
      })}
    </section>
  )
}

function RateInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // Keep what the user is typing; only push valid numbers into the store.
  const [text, setText] = useState(String(value))
  return (
    <label className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
      −
      <Input
        aria-label="Depletion per second"
        className="h-7 w-16 px-1.5 text-xs"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= 0) onChange(v)
        }}
      />
      /s
    </label>
  )
}
