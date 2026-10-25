import { useEffect, useRef, useState } from 'react'

const SRC = 'src/components/ui/Ambient Space Music - Nibiru.mp3'

export function BackgroundAudio() {
  const ref = useRef<HTMLAudioElement>(null)
  const [muted, setMuted] = useState(() => localStorage.getItem('bgm-muted') === '1')

  useEffect(() => {
    
    const a = ref.current
    if (!a) return
    a.volume = 1
    const start = () => a.play().then(cleanup).catch(() => {})
    const cleanup = () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
    }
    a.play().catch(() => {
      window.addEventListener('pointerdown', start)
      window.addEventListener('keydown', start)
    })
    return cleanup
  }, [])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
    localStorage.setItem('bgm-muted', muted ? '1' : '0')
  }, [muted])

  return (
    <>
      <audio ref={ref} src={SRC} loop preload="auto" />
      <button
        onClick={() => setMuted((m) => !m)}
        style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 50 }}
      >
        {muted ? '♪ OFF' : '♪ ON'}
      </button>
    </>
  )
}