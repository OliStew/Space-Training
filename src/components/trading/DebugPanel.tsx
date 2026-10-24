import { useState } from 'react'
import { RESOURCE_KEYS, useDebugResources } from '@/game'

/** Temporary cheat buttons. Uses useDebugResources() -> { add(resource, amount), remove(resource, amount) }. */
export function DebugPanel() {
  const { add, remove } = useDebugResources()
  const [amount, setAmount] = useState('100')
  const n = Number(amount)

  return (
    <section>
      <h2>Debug: adjust resources</h2>
      <p>Amount: <input type="number" min="0" size={8} value={amount} onChange={(e) => setAmount(e.target.value)} /></p>
      <ul>
        {RESOURCE_KEYS.map((key) => (
          <li key={key}>
            {key}{' '}
            <button onClick={() => remove(key, n)}>- Remove</button>{' '}
            <button onClick={() => add(key, n)}>+ Add</button>
          </li>
        ))}
      </ul>
    </section>
  )
}
