/**
 * AI generation hook — wraps the /api/generate endpoint.
 *
 * Usage:
 *   const { text, loading, error, generate } = useGenerate()
 *   await generate('Tell me about space')
 */

import { useCallback, useState } from 'react'
import { getAuthToken } from 'deepspace'

export interface GenerateResult {
  text: string | null
  loading: boolean
  error: string | null
  /** Send a prompt to the AI and return the result text. */
  generate: (prompt: string, options?: { model?: string }) => Promise<string | null>
  /** Reset state back to initial. */
  reset: () => void
}

export function useGenerate(): GenerateResult {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string, options?: { model?: string }): Promise<string | null> => {
      const token = await getAuthToken()
      if (!token) {
        setError('Not authenticated')
        return null
      }

      setLoading(true)
      setError(null)
      setText(null)

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prompt, model: options?.model }),
        })

        const data = await res.json() as { text?: string; error?: string }

        if (data.error) {
          setError(data.error)
          return null
        }

        setText(data.text ?? null)
        return data.text ?? null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setText(null)
    setError(null)
  }, [])

  return { text, loading, error, generate, reset }
}
