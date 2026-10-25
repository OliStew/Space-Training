import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '@/game/GameProvider'
import { useDebugResources } from '@/game'
import { useTextToSpeech } from '@/lib/tts'
import { streamGenerate, streamTextSmoothly } from '@/lib/generate'
import { fmt } from '@/components/trading/format'
import { Badge } from '@/FancyComp/parts'
import { useActiveScenario } from '@/context/ActiveScenarioContext'
import data from '@/lib/scenarios.json'

type Effects = { food: number; ammunition: number; oxygen: number; base_health_pct: number }
type Option = {
  key: string
  action_id: string
  label: string
  intent_category: string
  trigger_keywords: string[]
  effects: Effects
}
type Scenario = { id: number; name: string; description: string; options: Option[] }
const scenarios = data.scenarios as Scenario[]

/** Scenario effect name -> game resource key */
const RESOURCE_OF: Record<string, 'biomass' | 'ammo' | 'oxygen' | 'health'> = {
  food: 'biomass',
  oxygen: 'oxygen',
  ammunition: 'ammo',
  base_health_pct: 'health',
}
const EFFECT_LABEL: Record<string, string> = {
  food: 'FOOD (BIOMASS)',
  oxygen: 'OXYGEN',
  ammunition: 'AMMO',
  base_health_pct: 'COLONY HEALTH %',
}

function getScenarioSpokenText(scenario: Scenario): string {
  const optionsText = scenario.options
    .map((opt) => `Option ${opt.key}: ${opt.label}`)
    .join('. ')
  return `Scenario: ${scenario.name}. ${scenario.description} Your options are: ${optionsText}`
}

function buildScenarioPrompt(
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

function cleanNarrative(rawText: string): string {
  return rawText
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(Narrative|Outcome|Result|Here is what happens|Here's what happens|Immediate outcome):\s*/i, '')
    .replace(/[*#_`]/g, '')
    .trim()
}

function getFallbackNarrative(
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

function matchOption(text: string, options: Option[]): Option | null {
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

export function ScenarioPanel() {
  const { state } = useGame()
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { speak, stop, isPlaying, isLoading: isVoiceLoading, error: ttsError } = useTextToSpeech()
  const { setScenario: setActiveScenario } = useActiveScenario()

  // Random initial scenario selection
  const [id, setId] = useState<number>(() => {
    return scenarios[Math.floor(Math.random() * scenarios.length)]?.id ?? scenarios[0].id
  })
  const [chosen, setChosen] = useState<Option | null>(null)
  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)
  const [aiOutcome, setAiOutcome] = useState<string | null>(null)
  const [isGeneratingOutcome, setIsGeneratingOutcome] = useState(false)
  const [autoRead, setAutoRead] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const sc = useMemo(() => scenarios.find((s) => s.id === id) ?? scenarios[0], [id])

  useEffect(() => {
    setActiveScenario(sc)
  }, [sc, setActiveScenario])

  useEffect(() => () => setActiveScenario(null), [setActiveScenario])

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

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      clearTimers()
      abortRef.current?.abort()
    }
  }, [clearTimers])

  // Auto-read scenario via C.O.R.A. if enabled
  useEffect(() => {
    if (!sc || !autoRead) return
    if (lastReadIdRef.current === sc.id) return
    lastReadIdRef.current = sc.id

    const speechText = getScenarioSpokenText(sc)
    speak(speechText).catch((err) => {
      console.warn('Auto-read paused until user interaction:', err)
    })
  }, [sc, autoRead, speak])

  const nextRandomScenario = useCallback(() => {
    clearTimers()
    setCountdown(null)
    if (scenarios.length === 0) return
    stop()
    abortRef.current?.abort()
    abortRef.current = null

    setId((currId) => {
      if (scenarios.length <= 1) return scenarios[0].id
      let next = scenarios[Math.floor(Math.random() * scenarios.length)].id
      while (next === currId) {
        next = scenarios[Math.floor(Math.random() * scenarios.length)].id
      }
      return next
    })
    setChosen(null)
    setAiOutcome(null)
    setIsGeneratingOutcome(false)
    setText('')
    setMiss(false)
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

  const executeOption = async (opt: Option) => {
    if (isGeneratingOutcome || countdown !== null) return
    stop()
    setChosen(opt)
    setMiss(false)
    setText('')

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

    setAiOutcome('')
    setIsGeneratingOutcome(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let narrative = ''
    try {
      const prompt = buildScenarioPrompt(sc, opt, changes)
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
      narrative = getFallbackNarrative(sc, opt, changes)
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

  const submit = () => {
    if (isGeneratingOutcome || countdown !== null) return
    const matched = matchOption(text, sc.options)
    if (matched) {
      void executeOption(matched)
    } else {
      setMiss(true)
    }
  }

  const rows = chosen
    ? (Object.keys(chosen.effects) as (keyof Effects)[]).filter((k) => chosen.effects[k] !== 0)
    : []

  return (
    <>
      {/* Scenario header without manual dropdown selection */}
      <div
        className="rc-row"
        style={{
          borderBottom: '2px solid var(--dim)',
          paddingBottom: 6,
          marginBottom: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Badge kind="out">CRISIS EVENT</Badge>
          <strong style={{ color: 'var(--hi)', letterSpacing: '0.04em' }}>
            {sc.name.toUpperCase()}
          </strong>
        </span>
        {countdown !== null && (
          <Badge kind="warn">NEXT EVENT IN {countdown}S</Badge>
        )}
      </div>

      <p style={{ lineHeight: 1.5, marginBottom: 12 }}>{sc.description}</p>

      {/* Options displayed as structured read-only records - NOT pressable buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0 14px' }}>
        {sc.options.map((o) => (
          <div
            key={o.key}
            className="rc-row"
            style={{
              padding: '6px 10px',
              background: chosen?.key === o.key ? 'rgba(185,255,87,0.08)' : 'rgba(0,0,0,0.35)',
              border: chosen?.key === o.key ? '1px solid var(--main)' : '1px solid var(--dim)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--hi)', marginRight: 8 }}>[{o.key}]</strong>
              {o.label}{' '}
              <span className="rc-muted">({o.intent_category})</span>
            </span>
          </div>
        ))}
      </div>

      {/* Command execution form */}
      <div className="rc-form" style={{ marginBottom: 12 }}>
        <label>
          COMMAND / ORDER INPUT
          <input
            value={text}
            disabled={countdown !== null || isGeneratingOutcome}
            placeholder={
              countdown !== null
                ? `System cooldown active. Next event in ${countdown}s...`
                : 'Enter order (e.g. A, B, C, or describe order)...'
            }
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <button
          onClick={submit}
          disabled={!text.trim() || countdown !== null || isGeneratingOutcome}
        >
          {isGeneratingOutcome ? 'TRANSMITTING...' : 'EXECUTE ▶'}
        </button>
      </div>

      {miss && (
        <p className="rc-muted" style={{ color: '#ffb000' }}>
          No matching order recognized. Enter Option A, B, or C, or describe your action.
        </p>
      )}

      {/* Voice controls */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '6px 0 12px', fontSize: '11px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRead}
            onChange={(e) => setAutoRead(e.target.checked)}
          />
          AUTO-READ WITH C.O.R.A.
        </label>
        {isPlaying ? (
          <button className="ghost" onClick={stop}>STOP VOICE</button>
        ) : (
          <button
            className="ghost"
            disabled={isVoiceLoading || isGeneratingOutcome}
            onClick={() => {
              const textToRead = aiOutcome || getScenarioSpokenText(sc)
              speak(textToRead).catch(() => {})
            }}
          >
            {isVoiceLoading ? 'LOADING...' : aiOutcome ? 'READ OUTCOME' : 'READ SCENARIO'}
          </button>
        )}
      </div>

      {/* Resource impact details when an option has been chosen */}
      {chosen && (
        <>
          <div className="rc-row">
            <span>
              EXECUTED: {chosen.label} <span className="rc-muted">({chosen.intent_category})</span>
            </span>
            <Badge kind={chosen.effects.base_health_pct < -9 ? 'crit' : chosen.effects.base_health_pct < 0 ? 'warn' : 'out'}>
              {rows.length ? 'COSTS INCURRED' : 'NO COST'}
            </Badge>
          </div>
          {rows.map((k) => {
            const rk = RESOURCE_OF[k]
            const cur = state.resources[rk]
            return (
              <div className="rc-row" key={k}>
                <span>{EFFECT_LABEL[k]}</span>
                {cur === undefined
                  ? `${chosen.effects[k]}`
                  : `${fmt(cur, 1)} → ${fmt(Math.max(0, cur + chosen.effects[k]), 1)} (${chosen.effects[k] > 0 ? '+' : ''}${chosen.effects[k]})`}
              </div>
            )
          })}
        </>
      )}

      {/* Streaming aftermath narrative */}
      {aiOutcome && (
        <div
          className="rc-row"
          style={{
            display: 'block',
            marginTop: 10,
            padding: '10px 12px',
            border: '1px solid var(--dim)',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, color: 'var(--hi)', letterSpacing: '0.08em' }}>
              AFTERMATH TELEMETRY:
            </span>
            {countdown !== null && (
              <Badge kind="warn">NEXT IN {countdown}S</Badge>
            )}
          </div>
          <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--main)' }}>
            {aiOutcome}
            {isGeneratingOutcome && (
              <span style={{ display: 'inline-block', marginLeft: 4, opacity: 0.8 }}>▌</span>
            )}
          </p>
        </div>
      )}

      {countdown !== null && (
        <p className="rc-muted" style={{ fontStyle: 'italic', marginTop: 8 }}>
          Colony systems recovering from event. Next scenario in {countdown}s...
        </p>
      )}

      {ttsError && <p style={{ color: '#ff4d4d', fontSize: '11px' }}>VOICE ERROR: {ttsError}</p>}
    </>
  )
}
