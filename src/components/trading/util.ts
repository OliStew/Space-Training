import { useState } from 'react'
import type { Delta } from '@/game'

/** Display helpers shared by the example components. Replace freely. */
export const fmt = (n: number, digits = 2) => n.toFixed(digits)

/** `{ money: 50 }` -> "$50.00", `{ metal: 3 }` -> "3 metal" */
export function describe(delta: Delta): string {
  return Object.entries(delta)
    .map(([k, v]) => (k === 'money' ? `$${fmt(v ?? 0)}` : `${v} ${k}`))
    .join(', ')
}

/**
 * Run an action; show its error (or `okText`) as a message.
 *   const [message, attempt] = useAttempt()
 *   <button onClick={() => attempt(() => buy(...), 'Bought!')}>
 */
export function useAttempt(): [string, (fn: () => Promise<unknown>, okText?: string) => Promise<void>] {
  const [message, setMessage] = useState('')
  const attempt = async (fn: () => Promise<unknown>, okText = '') => {
    try {
      await fn()
      setMessage(okText)
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return [message, attempt]
}
