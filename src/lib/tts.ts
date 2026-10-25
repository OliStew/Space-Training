import { useCallback, useEffect, useRef, useState } from 'react'

export const DEFAULT_VOICE_ID = 'weA4Q36twV5kwSaTEL0Q' // Eva
export const DEFAULT_MODEL_ID = 'eleven_flash_v2_5' // Flash 2.5

export interface TtsOptions {
  voiceId?: string
  modelId?: string
}

/**
 * Fetch and play speech from the backend ElevenLabs proxy.
 *
 * @param text The text to synthesize
 * @param options Optional overrides for voiceId and modelId
 * @returns The playing HTMLAudioElement
 */
export async function speakText(
  text: string,
  options: TtsOptions = {},
): Promise<HTMLAudioElement> {
  const { voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_MODEL_ID } = options

  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voiceId,
      modelId,
    }),
  })

  if (!res.ok) {
    let message = 'Failed to generate speech'
    try {
      const err = (await res.json()) as { error?: string }
      if (err?.error) message = err.error
    } catch {
      message = `Server error (${res.status})`
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const audioUrl = URL.createObjectURL(blob)
  const audio = new Audio(audioUrl)

  audio.addEventListener('ended', () => {
    URL.revokeObjectURL(audioUrl)
  })

  await audio.play()
  return audio
}

/**
 * React hook to control ElevenLabs TTS generation and playback state.
 */
export function useTextToSpeech(defaultOptions: TtsOptions = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.currentTime = 0
      currentAudioRef.current = null
      setIsPlaying(false)
    }
  }, [])

  const speak = useCallback(
    async (text: string, options?: TtsOptions) => {
      stop()
      setIsLoading(true)
      setError(null)

      try {
        const audio = await speakText(text, { ...defaultOptions, ...options })
        currentAudioRef.current = audio
        setIsLoading(false)
        setIsPlaying(true)

        audio.addEventListener('ended', () => {
          setIsPlaying(false)
          currentAudioRef.current = null
        })

        audio.addEventListener('error', (e) => {
          console.error('Audio playback error', e)
          setIsPlaying(false)
          currentAudioRef.current = null
          setError('Failed during audio playback')
        })
      } catch (err: unknown) {
        setIsLoading(false)
        setIsPlaying(false)
        const errMsg = err instanceof Error ? err.message : 'Unknown TTS error'
        setError(errMsg)
        throw err
      }
    },
    [defaultOptions, stop],
  )

  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [])

  return {
    speak,
    stop,
    isPlaying,
    isLoading,
    error,
  }
}
