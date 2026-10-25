import { useEffect, useRef, useState } from 'react'
import { useDebugResources } from '@/game'
import { useTextToSpeech } from '@/lib/tts'
import scenariosData from '@/scenarios.json'

interface ScenarioOption {
  key: string
  action_id: string
  label: string
  intent_category: string
  trigger_keywords?: string[]
  effects?: {
    food?: number
    ammunition?: number
    oxygen?: number
    base_health_pct?: number
    [key: string]: number | undefined
  }
}

interface Scenario {
  id: number
  name: string
  description: string
  options: ScenarioOption[]
}

const allScenarios: Scenario[] = (scenariosData as { scenarios: Scenario[] }).scenarios

function getScenarioSpokenText(scenario: Scenario): string {
  const optionsText = scenario.options
    .map((opt) => `Option ${opt.key}: ${opt.label}`)
    .join('. ')
  return `Scenario: ${scenario.name}. ${scenario.description} Your options are: ${optionsText}`
}

export function ScenarioPanel() {
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { speak, stop, isPlaying, isLoading, error: ttsError } = useTextToSpeech()

  const [scenario, setScenario] = useState<Scenario>(() => {
    return allScenarios[Math.floor(Math.random() * allScenarios.length)]
  })
  const [inputText, setInputText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [autoRead, setAutoRead] = useState(false)

  // Track the scenario ID to avoid duplicate auto-reads on re-renders
  const lastReadIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!scenario || !autoRead) return
    if (lastReadIdRef.current === scenario.id) return
    lastReadIdRef.current = scenario.id

    const speechText = getScenarioSpokenText(scenario)
    speak(speechText).catch((err) => {
      // Browser autoplay policy might block audio until the first user click
      console.warn('Auto-read paused until user interaction:', err)
    })
  }, [scenario, autoRead, speak])

  const nextRandomScenario = () => {
    if (allScenarios.length === 0) return
    stop()
    let next = scenario
    if (allScenarios.length > 1) {
      while (next.id === scenario?.id) {
        next = allScenarios[Math.floor(Math.random() * allScenarios.length)]
      }
    }
    setScenario(next)
    setFeedback(null)
    setInputText('')
  }

  const applyEffect = (resourceKey: 'biomass' | 'ammo' | 'oxygen' | 'health', delta: number) => {
    if (delta > 0) {
      addResource(resourceKey, delta)
    } else if (delta < 0) {
      removeResource(resourceKey, Math.abs(delta))
    }
  }

  const handleChooseOption = (opt: ScenarioOption) => {
    stop()
    const changes: string[] = []
    if (opt.effects) {
      if (opt.effects.food) {
        applyEffect('biomass', opt.effects.food)
        changes.push(`biomass ${opt.effects.food > 0 ? '+' : ''}${opt.effects.food}`)
      }
      if (opt.effects.ammunition) {
        applyEffect('ammo', opt.effects.ammunition)
        changes.push(`ammo ${opt.effects.ammunition > 0 ? '+' : ''}${opt.effects.ammunition}`)
      }
      if (opt.effects.oxygen) {
        applyEffect('oxygen', opt.effects.oxygen)
        changes.push(`oxygen ${opt.effects.oxygen > 0 ? '+' : ''}${opt.effects.oxygen}`)
      }
      if (opt.effects.base_health_pct) {
        applyEffect('health', opt.effects.base_health_pct)
        changes.push(`health ${opt.effects.base_health_pct > 0 ? '+' : ''}${opt.effects.base_health_pct}%`)
      }
    }

    const effectStr = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    const msg = `Selected Option ${opt.key}: "${opt.label}"${effectStr}`
    setFeedback(msg)

    if (autoRead) {
      const outcomeSpeech = `You chose Option ${opt.key}: ${opt.label}.${
        changes.length > 0 ? ' Result: ' + changes.join(', ') : ''
      }`
      speak(outcomeSpeech).catch(() => {})
    }
  }

  const handleTextSubmit = () => {
    const query = inputText.trim().toLowerCase()
    if (!query || !scenario) return

    // 1. Exact match on key ("a", "b", "c", "option a", etc.)
    let matched = scenario.options.find(
      (opt) =>
        opt.key.toLowerCase() === query ||
        `option ${opt.key.toLowerCase()}` === query,
    )

    // 2. Trigger keywords match
    if (!matched) {
      matched = scenario.options.find((opt) =>
        opt.trigger_keywords?.some((kw) => query.includes(kw.toLowerCase())),
      )
    }

    // 3. Option label substring match
    if (!matched) {
      matched = scenario.options.find(
        (opt) =>
          opt.label.toLowerCase().includes(query) ||
          query.includes(opt.label.toLowerCase()),
      )
    }

    if (matched) {
      handleChooseOption(matched)
      setInputText('')
    } else {
      setFeedback(`No matching action for "${inputText.trim()}". Try selecting A, B, or C.`)
    }
  }

  if (!scenario) {
    return (
      <section>
        <h2>Scenario</h2>
        <p>No scenarios found.</p>
      </section>
    )
  }

  return (
    <section>
      <h2>Scenario: {scenario.name}</h2>
      <p>{scenario.description}</p>
      <ul>
        {scenario.options.map((opt) => (
          <li key={opt.key}>
            <button onClick={() => handleChooseOption(opt)}>
              Option {opt.key}: {opt.label}
            </button>
          </li>
        ))}
      </ul>
      <p>
        <input
          type="text"
          size={35}
          placeholder="Enter command or option..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit()
          }}
        />{' '}
        <button onClick={handleTextSubmit}>Submit</button>{' '}
        <button onClick={nextRandomScenario}>New Scenario</button>{' '}
        {isPlaying ? (
          <button onClick={stop}>Stop Voice</button>
        ) : (
          <button
            disabled={isLoading}
            onClick={() => speak(getScenarioSpokenText(scenario)).catch(() => {})}
          >
            {isLoading ? 'Loading Voice...' : 'Read Aloud'}
          </button>
        )}{' '}
        <label style={{ marginLeft: 8, fontSize: '0.9em' }}>
          <input
            type="checkbox"
            checked={autoRead}
            onChange={(e) => setAutoRead(e.target.checked)}
          />{' '}
          Auto-read with Eva
        </label>
      </p>
      {feedback && <p>{feedback}</p>}
      {ttsError && <p style={{ color: 'red' }}>Voice Error: {ttsError}</p>}
    </section>
  )
}
