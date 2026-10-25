import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useDebugResources } from '@/game'
import { useTextToSpeech } from '@/lib/tts'
import { streamGenerate, streamTextSmoothly } from '@/lib/generate'
import data from '@/lib/scenarios.json'

export type Effects = {
  food: number
  ammunition: number
  oxygen: number
  base_health_pct: number
  [key: string]: number | undefined
}

export type Option = {
  key: string
  action_id: string
  label: string
  intent_category: string
  trigger_keywords: string[]
  effects: Effects
}

export type ScenarioOption = Option

export type Scenario = {
  id: number
  name: string
  description: string
  options: Option[]
}

/** Seconds player has to respond to a crisis event before it times out. */
export const SCENARIO_RESPONSE_TIME_SECONDS = 30

/** Seconds of cooldown between scenarios before the next crisis arrives. */
export const SCENARIO_COOLDOWN_SECONDS = 30

/** Base health penalty applied if the commander fails to respond to a crisis in time. */
export const SCENARIO_TIMEOUT_HEALTH_PENALTY = 20

export const scenariosList = data.scenarios as Scenario[]

export function getScenarioSpokenText(scenario: Scenario): string {
  const optionsText = scenario.options
    .map((opt) => `Option ${opt.key}: ${opt.label}`)
    .join('. ')
  return `Scenario: ${scenario.name}. ${scenario.description} Your options are: ${optionsText}`
}

export function buildScenarioPrompt(
  scenario: Scenario,
  opt: Option,
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

export function cleanNarrative(rawText: string): string {
  return rawText
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(Narrative|Outcome|Result|Here is what happens|Here's what happens|Immediate outcome):\s*/i, '')
    .replace(/[*#_`]/g, '')
    .trim()
}

export function getFallbackNarrative(
  scenario: Scenario,
  opt: Option,
  consequences: string[],
): string {
  const resourceText =
    consequences.length > 0
      ? `The operation required immediate resource expenditure, resulting in ${consequences.join(', ')}.`
      : 'Station telemetry confirmed the situation stabilized without additional resource depletion.'

  return `Station personnel executed the commander's order to "${opt.label}". Crews swiftly responded to mitigate the ${scenario.name.toLowerCase()} incident across all affected sectors. ${resourceText}`
}

export function matchOption(text: string, options: Option[]): Option | null {
  const query = text.trim().toLowerCase()
  if (!query) return null

  // 1. Exact match on option key ("a", "b", "c", "option a", etc.)
  const exact = options.find(
    (o) => o.key.toLowerCase() === query || `option ${o.key.toLowerCase()}` === query,
  )
  if (exact) return exact

  // 2. Keyword score matching
  let best: Option | null = null
  let bestScore = 0
  for (const o of options) {
    const score = (o.trigger_keywords || []).filter((k) => query.includes(k.toLowerCase())).length
    if (score > bestScore) {
      best = o
      bestScore = score
    }
  }
  if (best) return best

  // 3. Substring match on label
  const labelMatch = options.find(
    (o) => o.label.toLowerCase().includes(query) || query.includes(o.label.toLowerCase()),
  )
  return labelMatch ?? null
}

export interface ScenarioContextValue {
  scenario: Scenario
  scenarios: Scenario[]
  chosen: Option | null
  aiOutcome: string | null
  isGeneratingOutcome: boolean
  phase: 'active' | 'cooldown'
  phaseEndAt: number | null
  responseCountdown: number | null
  countdown: number | null
  autoRead: boolean
  setAutoRead: (val: boolean) => void
  executeOption: (opt: Option) => Promise<void>
  nextRandomScenario: () => void
  speakScenarioOrOutcome: () => void
  speak: (text: string) => Promise<void>
  stop: () => void
  isPlaying: boolean
  isVoiceLoading: boolean
  ttsError: string | null
}

const ScenarioContext = createContext<ScenarioContextValue | null>(null)

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { speak, stop, isPlaying, isLoading: isVoiceLoading, error: ttsError } = useTextToSpeech()

  // Random initial scenario selection
  const [scenario, setScenario] = useState<Scenario>(() => {
    return scenariosList[Math.floor(Math.random() * scenariosList.length)] ?? scenariosList[0]
  })
  const [chosen, setChosen] = useState<Option | null>(null)
  const [aiOutcome, setAiOutcome] = useState<string | null>(null)
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false)
  const [autoRead, setAutoRead] = useState(false)

  // 30s response window -> 30s cooldown window
  const [phase, setPhase] = useState<'active' | 'cooldown'>('active')
  const [phaseEndAt, setPhaseEndAt] = useState<number>(() => Date.now() + SCENARIO_RESPONSE_TIME_SECONDS * 1000)
  const [responseCountdown, setResponseCountdown] = useState<number | null>(SCENARIO_RESPONSE_TIME_SECONDS)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Synchronous refs for the background timer interval
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const phaseEndAtRef = useRef(phaseEndAt)
  phaseEndAtRef.current = phaseEndAt
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario
  const isGeneratingOutcomeRef = useRef(isGeneratingOutcome)
  isGeneratingOutcomeRef.current = isGeneratingOutcome
  const autoReadRef = useRef(autoRead)
  autoReadRef.current = autoRead
  const responseCountdownRef = useRef(responseCountdown)
  responseCountdownRef.current = responseCountdown

  const lastReadIdRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const applyEffect = useCallback(
    (resourceKey: 'biomass' | 'ammo' | 'oxygen' | 'health', delta: number) => {
      if (delta > 0) {
        addResource(resourceKey, delta)
      } else if (delta < 0) {
        removeResource(resourceKey, Math.abs(delta))
      }
    },
    [addResource, removeResource],
  )

  const nextRandomScenario = useCallback(() => {
    stop()
    abortRef.current?.abort()
    abortRef.current = null

    const currentId = scenarioRef.current?.id
    let next = scenariosList[0]
    if (scenariosList.length > 1) {
      let candidate = scenariosList[Math.floor(Math.random() * scenariosList.length)]
      while (candidate.id === currentId) {
        candidate = scenariosList[Math.floor(Math.random() * scenariosList.length)]
      }
      next = candidate
    }

    setScenario(next)
    setChosen(null)
    setAiOutcome(null)
    setIsGeneratingOutcome(false)
    setPhase('active')
    const nextEnd = Date.now() + SCENARIO_RESPONSE_TIME_SECONDS * 1000
    setPhaseEndAt(nextEnd)
    setResponseCountdown(SCENARIO_RESPONSE_TIME_SECONDS)
    setCountdown(null)
  }, [stop])

  const handleResponseTimeout = useCallback(() => {
    stop()
    setResponseCountdown(0)
    const currentSc = scenarioRef.current
    const scName = currentSc?.name ?? 'crisis'

    // Deduct 20 base health penalty for failing to respond in time
    removeResource('health', SCENARIO_TIMEOUT_HEALTH_PENALTY)

    setAiOutcome(
      `RESPONSE TIMEOUT (30S): No commander orders were issued within the 30-second window. The unmitigated ${scName.toLowerCase()} caused severe structural damage (-${SCENARIO_TIMEOUT_HEALTH_PENALTY}% base health). Life support and emergency teams operated autonomously to contain further breaches.`,
    )

    if (autoReadRef.current) {
      speak(
        `Warning: Response window expired. ${SCENARIO_TIMEOUT_HEALTH_PENALTY} percent base health lost due to unmitigated incident.`,
      ).catch(() => {})
    }

    setPhase('cooldown')
    const cooldownEnd = Date.now() + SCENARIO_COOLDOWN_SECONDS * 1000
    setPhaseEndAt(cooldownEnd)
    setCountdown(SCENARIO_COOLDOWN_SECONDS)
  }, [stop, removeResource, speak])

  // Master background timer loop that runs continuously throughout the project
  useEffect(() => {
    const interval = setInterval(() => {
      if (isGeneratingOutcomeRef.current) return

      const now = Date.now()
      const end = phaseEndAtRef.current
      const currentPhase = phaseRef.current

      if (currentPhase === 'active') {
        const remaining = Math.max(0, Math.ceil((end - now) / 1000))
        setResponseCountdown(remaining)
        if (remaining <= 0) {
          handleResponseTimeout()
        }
      } else if (currentPhase === 'cooldown') {
        const remaining = Math.max(0, Math.ceil((end - now) / 1000))
        setCountdown(remaining)
        if (remaining <= 0) {
          nextRandomScenario()
        }
      }
    }, 250)

    return () => clearInterval(interval)
  }, [handleResponseTimeout, nextRandomScenario])

  // Auto-read scenario via C.O.R.A. if enabled
  useEffect(() => {
    if (!scenario || !autoRead) return
    if (lastReadIdRef.current === scenario.id) return
    lastReadIdRef.current = scenario.id

    const speechText = getScenarioSpokenText(scenario)
    speak(speechText).catch((err) => {
      console.warn('Auto-read paused until user interaction:', err)
    })
  }, [scenario, autoRead, speak])

  const executeOption = useCallback(
    async (opt: Option) => {
      if (
        isGeneratingOutcomeRef.current ||
        phaseRef.current === 'cooldown' ||
        responseCountdownRef.current === 0
      ) {
        return
      }

      stop()
      setChosen(opt)
      setResponseCountdown(null)
      setAiOutcome('')
      setIsGeneratingOutcome(true)

      const currentSc = scenarioRef.current

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

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let narrative = ''
      try {
        const prompt = buildScenarioPrompt(currentSc, opt, changes)
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
          return
        }

        console.warn('AI narrative streaming failed or timed out, applying typewriter fallback:', err)
        narrative = getFallbackNarrative(currentSc, opt, changes)
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

      if (autoReadRef.current && narrative && !controller.signal.aborted) {
        speak(narrative).catch(() => {})
      }

      if (!controller.signal.aborted) {
        setPhase('cooldown')
        const cooldownEnd = Date.now() + SCENARIO_COOLDOWN_SECONDS * 1000
        setPhaseEndAt(cooldownEnd)
        setCountdown(SCENARIO_COOLDOWN_SECONDS)
      }
    },
    [applyEffect, stop, speak],
  )

  const speakScenarioOrOutcome = useCallback(() => {
    const textToRead = aiOutcome || getScenarioSpokenText(scenario)
    speak(textToRead).catch(() => {})
  }, [aiOutcome, scenario, speak])

  const value: ScenarioContextValue = {
    scenario,
    scenarios: scenariosList,
    chosen,
    aiOutcome,
    isGeneratingOutcome,
    phase,
    phaseEndAt,
    responseCountdown,
    countdown,
    autoRead,
    setAutoRead,
    executeOption,
    nextRandomScenario,
    speakScenarioOrOutcome,
    speak,
    stop,
    isPlaying,
    isVoiceLoading,
    ttsError,
  }

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext)
  if (!ctx) {
    throw new Error('useScenario must be used within a ScenarioProvider')
  }
  return ctx
}

export function useScenarioOptional(): ScenarioContextValue | null {
  return useContext(ScenarioContext)
}
