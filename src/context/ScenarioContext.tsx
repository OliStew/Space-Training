import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useDebugResources } from '@/game'
import { useTextToSpeech } from '@/lib/tts'
import { streamGenerate, streamTextSmoothly } from '@/lib/generate'
import scenariosData from '@/scenarios.json'

export interface ScenarioOption {
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

export interface Scenario {
  id: number
  name: string
  description: string
  options: ScenarioOption[]
}

export interface ScenarioContextValue {
  scenario: Scenario | null
  options: ScenarioOption[]
  feedback: string | null
  aiOutcome: string | null
  isGeneratingOutcome: boolean
  countdown: number | null
  autoRead: boolean
  setAutoRead: (val: boolean) => void
  handleChooseOption: (opt: ScenarioOption) => Promise<void>
  nextRandomScenario: () => void
  getScenarioSpokenText: (scenario: Scenario) => string
}

const allScenarios: Scenario[] = (scenariosData as { scenarios: Scenario[] }).scenarios

export function getScenarioSpokenText(scenario: Scenario): string {
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

const ScenarioContext = createContext<ScenarioContextValue | null>(null)

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { speak, stop } = useTextToSpeech()

  const [scenario, setScenario] = useState<Scenario | null>(() => {
    if (allScenarios.length === 0) return null
    return allScenarios[Math.floor(Math.random() * allScenarios.length)]
  })
  const [feedback, setFeedback] = useState<string | null>(null)
  const [aiOutcome, setAiOutcome] = useState<string | null>(null)
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false)
  const [autoRead, setAutoRead] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const lastReadIdRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
      abortRef.current?.abort()
    }
  }, [clearTimers])

  useEffect(() => {
    if (!scenario || !autoRead) return
    if (lastReadIdRef.current === scenario.id) return
    lastReadIdRef.current = scenario.id

    const speechText = getScenarioSpokenText(scenario)
    speak(speechText).catch((err) => {
      console.warn('Auto-read paused until user interaction:', err)
    })
  }, [scenario, autoRead, speak])

  const nextRandomScenario = useCallback(() => {
    clearTimers()
    setCountdown(null)
    if (allScenarios.length === 0) return
    stop()
    abortRef.current?.abort()
    abortRef.current = null

    setScenario((current) => {
      if (!current || allScenarios.length <= 1) return allScenarios[0] ?? null
      let next = current
      while (next.id === current.id) {
        next = allScenarios[Math.floor(Math.random() * allScenarios.length)]
      }
      return next
    })
    setFeedback(null)
    setAiOutcome(null)
    setIsGeneratingOutcome(false)
  }, [clearTimers, stop])

  const startNextScenarioCountdown = useCallback(() => {
    clearTimers()
    setCountdown(15)

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    timerRef.current = setTimeout(() => {
      nextRandomScenario()
    }, 15000)
  }, [clearTimers, nextRandomScenario])

  const applyEffect = (resourceKey: 'biomass' | 'ammo' | 'oxygen' | 'health', delta: number) => {
    if (delta > 0) {
      addResource(resourceKey, delta)
    } else if (delta < 0) {
      removeResource(resourceKey, Math.abs(delta))
    }
  }

  const handleChooseOption = async (opt: ScenarioOption) => {
    if (!scenario || isGeneratingOutcome || countdown !== null) return
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

    setFeedback(`Selected "${opt.label}"`)
    setAiOutcome('')
    setIsGeneratingOutcome(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let narrative = ''
    try {
      const prompt = buildScenarioPrompt(scenario, opt, changes)
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

    if (autoRead && narrative && !controller.signal.aborted) {
      speak(narrative).catch(() => {})
    }

    if (!controller.signal.aborted) {
      startNextScenarioCountdown()
    }
  }

  const value: ScenarioContextValue = {
    scenario,
    options: scenario?.options ?? [],
    feedback,
    aiOutcome,
    isGeneratingOutcome,
    countdown,
    autoRead,
    setAutoRead,
    handleChooseOption,
    nextRandomScenario,
    getScenarioSpokenText,
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
