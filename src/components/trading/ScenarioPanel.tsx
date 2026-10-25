import { useEffect, useRef, useState } from 'react'
import { useDebugResources } from '@/game'
import { useTextToSpeech } from '@/lib/tts'
import { streamGenerate, streamTextSmoothly } from '@/lib/generate'
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

function buildScenarioPrompt(
  scenario: Scenario,
  opt: ScenarioOption,
  consequences: string[],
): string {
  const consequencesText =
    consequences.length > 0
      ? `Consequences: ${consequences.join(', ')}.`
      : 'No resources were lost or gained.'

  return `You are the narrative life-support monitor and storyteller for a space station simulation.
A critical event occurred:
Scenario: "${scenario.name}"
Description: "${scenario.description}"

The commander selected Option ${opt.key}: "${opt.label}".
Mechanical consequences: ${consequencesText}

Write a natural, immersive 2-to-3 sentence outcome describing what happens immediately on the space station as a direct result of this choice.
You MUST clearly and naturally explain the events that unfold and explicitly state the resources lost or spent (${consequencesText}).
Do NOT use markdown headers, bolding, asterisks, or quotes. Provide clean, vivid narrative prose.`
}

function cleanNarrative(rawText: string): string {
  return rawText
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(Narrative|Outcome|Result|Here is what happens|Here's what happens|Immediate outcome):\s*/i, '')
    .replace(/[*#_`]/g, '')
    .trim()
}

function getFallbackNarrative(
  scenario: Scenario,
  opt: ScenarioOption,
  consequences: string[],
): string {
  const resourceText =
    consequences.length > 0
      ? `The operation required immediate resource expenditure, resulting in ${consequences.join(', ')}.`
      : 'Station telemetry confirmed the situation stabilized without additional resource depletion.'

  return `Station personnel executed the commander's order to "${opt.label}". Crews swiftly responded to mitigate the ${scenario.name.toLowerCase()} incident across all affected sectors. ${resourceText}`
}

export function ScenarioPanel() {
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { speak, stop, isPlaying, isLoading: isVoiceLoading, error: ttsError } = useTextToSpeech()

  const [scenario, setScenario] = useState<Scenario>(() => {
    return allScenarios[Math.floor(Math.random() * allScenarios.length)]
  })
  const [inputText, setInputText] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [aiOutcome, setAiOutcome] = useState<string | null>(null)
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false)
  const [autoRead, setAutoRead] = useState(false)

  // Track the scenario ID to avoid duplicate auto-reads on re-renders
  const lastReadIdRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    abortRef.current?.abort()
    abortRef.current = null

    let next = scenario
    if (allScenarios.length > 1) {
      while (next.id === scenario?.id) {
        next = allScenarios[Math.floor(Math.random() * allScenarios.length)]
      }
    }
    setScenario(next)
    setFeedback(null)
    setAiOutcome(null)
    setIsGeneratingOutcome(false)
    setInputText('')
  }

  const applyEffect = (resourceKey: 'biomass' | 'ammo' | 'oxygen' | 'health', delta: number) => {
    if (delta > 0) {
      addResource(resourceKey, delta)
    } else if (delta < 0) {
      removeResource(resourceKey, Math.abs(delta))
    }
  }

  const handleChooseOption = async (opt: ScenarioOption) => {
    stop()
    const changes: string[] = []
    if (opt.effects) {
      if (opt.effects.food) {
        applyEffect('biomass', opt.effects.food)
        changes.push(
          `${Math.abs(opt.effects.food)} biomass ${opt.effects.food > 0 ? 'gained' : 'consumed'}`,
        )
      }
      if (opt.effects.ammunition) {
        applyEffect('ammo', opt.effects.ammunition)
        changes.push(
          `${Math.abs(opt.effects.ammunition)} ammo ${opt.effects.ammunition > 0 ? 'gained' : 'spent'}`,
        )
      }
      if (opt.effects.oxygen) {
        applyEffect('oxygen', opt.effects.oxygen)
        changes.push(
          `${Math.abs(opt.effects.oxygen)} oxygen ${opt.effects.oxygen > 0 ? 'gained' : 'vented'}`,
        )
      }
      if (opt.effects.base_health_pct) {
        applyEffect('health', opt.effects.base_health_pct)
        changes.push(
          `${Math.abs(opt.effects.base_health_pct)}% base integrity ${
            opt.effects.base_health_pct > 0 ? 'restored' : 'lost'
          }`,
        )
      }
    }

    const effectStr = changes.length > 0 ? ` (${changes.join(', ')})` : ''
    setFeedback(`Selected "${opt.label}"`)
    setAiOutcome('')
    setIsGeneratingOutcome(true)

    // Cancel any previous in-flight generation
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // Stream narrative from DeepSpace AI with typewriter fallback protection
    let narrative = ''
    try {
      const prompt = buildScenarioPrompt(scenario, opt, changes)
      // Guard with an 8-second timeout so slow/stalled networks trigger fallback
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      try {
        narrative = await streamGenerate(
          prompt,
          (_chunk, accumulated) => {
            if (!controller.signal.aborted) {
              setAiOutcome(accumulated)
            }
          },
          { signal: controller.signal },
        )
      } finally {
        clearTimeout(timeoutId)
      }

      const cleaned = cleanNarrative(narrative)
      if (cleaned && cleaned.length > 15) {
        narrative = cleaned
        setAiOutcome(cleaned)
      } else {
        throw new Error('Response too short or malformed')
      }
    } catch (err) {
      if (controller.signal.aborted && abortRef.current !== controller) {
        // Superseded by a newer choice or scenario switch
        return
      }

      console.warn('AI narrative streaming failed or timed out, applying typewriter fallback:', err)
      narrative = getFallbackNarrative(scenario, opt, changes)
      await streamTextSmoothly(narrative, (current) => {
        if (!controller.signal.aborted) {
          setAiOutcome(current)
        }
      })
    } finally {
      if (abortRef.current === controller) {
        setIsGeneratingOutcome(false)
      }
    }

    // If autoRead is on, speak the finalized narrative result
    if (autoRead && narrative && !controller.signal.aborted) {
      speak(narrative).catch(() => {})
    }
  }

  const handleTextSubmit = () => {
    const query = inputText.trim().toLowerCase()
    if (!query || !scenario || isGeneratingOutcome) return

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
      void handleChooseOption(matched)
      setInputText('')
    } else {
      setFeedback(`Commander, I do not understand that command. Please write a valid option.`)
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
            <button
              disabled={isGeneratingOutcome}
              onClick={() => void handleChooseOption(opt)}
            >
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
          disabled={isGeneratingOutcome}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit()
          }}
        />{' '}
        <button disabled={isGeneratingOutcome} onClick={handleTextSubmit}>
          Submit
        </button>{' '}
        <button onClick={nextRandomScenario}>New Scenario</button>{' '}
        {isPlaying ? (
          <button onClick={stop}>Stop Voice</button>
        ) : (
          <button
            disabled={isVoiceLoading || isGeneratingOutcome}
            onClick={() => {
              const textToRead = aiOutcome || getScenarioSpokenText(scenario)
              speak(textToRead).catch(() => {})
            }}
          >
            {isVoiceLoading ? 'Loading Voice...' : aiOutcome ? 'Read Outcome' : 'Read Aloud'}
          </button>
        )}{' '}
        <label style={{ marginLeft: 8, fontSize: '0.9em' }}>
          <input
            type="checkbox"
            checked={autoRead}
            onChange={(e) => setAutoRead(e.target.checked)}
          />{' '}
          Auto-read with C.O.R.A.
        </label>
      </p>

      {feedback && <p>{feedback}</p>}

      {isGeneratingOutcome && (
        <p style={{ fontStyle: 'italic', color: '#888' }}>
          Generating aftermath narrative from DeepSpace AI...
        </p>
      )}

      {aiOutcome && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            border: '1px solid #444',
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <strong>Aftermath:</strong>
          <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>{aiOutcome}</p>
        </div>
      )}

      {ttsError && <p style={{ color: 'red' }}>Voice Error: {ttsError}</p>}
    </section>
  )
}
