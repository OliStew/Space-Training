import { useState } from 'react'
import { Button } from '@/components/ui'
import { useTextToSpeech } from '@/lib/tts'
import { Volume2, VolumeX, Loader2 } from 'lucide-react'
import { useGame } from '@/game/GameProvider'
import { fmt } from './format'

export function VoiceAssistantPanel() {
  const { state } = useGame()
  const { speak, stop, isPlaying, isLoading, error: ttsError } = useTextToSpeech()
  const [customText, setCustomText] = useState('')

  const handleSpeakStatus = () => {
    const defaultStatus =
      `Current resource report: You have $${fmt(state.resources.money)} credits, ` +
      `${fmt(state.resources.biomass, 1)} biomass, ${fmt(state.resources.oxygen, 1)} oxygen, ` +
      `${fmt(state.resources.metal, 1)} metal, ${fmt(state.resources.ammo, 1)} ammo, and ` +
      `${fmt(state.resources.buildings, 1)} buildings.`
    const textToSpeak = customText.trim() || defaultStatus
    speak(textToSpeak).catch(() => {})
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Voice Assistant</h2>
          <p className="text-xs text-muted-foreground">ElevenLabs Flash 2.5 &middot; Eva</p>
        </div>
        {isPlaying ? (
          <Button
            variant="outline"
            size="sm"
            onClick={stop}
            className="flex items-center gap-1.5 text-destructive"
          >
            <VolumeX className="h-4 w-4" /> Stop
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={handleSpeakStatus}
            className="flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Synthesizing...
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" /> Speak Status
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Type custom text to speak..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customText.trim() && !isLoading) {
              speak(customText.trim()).catch(() => {})
            }
          }}
        />
        <Button
          size="sm"
          disabled={isLoading || !customText.trim()}
          onClick={() => speak(customText.trim()).catch(() => {})}
        >
          Speak
        </Button>
      </div>

      {ttsError && <p className="mt-2 text-xs text-destructive">{ttsError}</p>}
    </section>
  )
}
