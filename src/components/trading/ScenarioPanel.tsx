import { useState } from 'react'
import { useGame } from '@/game/GameProvider'
import { fmt } from '@/components/trading/format'
import { Badge } from '@/FancyComp/parts'
import {
  matchOption,
  SCENARIO_COOLDOWN_SECONDS,
  SCENARIO_RESPONSE_TIME_SECONDS,
  SCENARIO_TIMEOUT_HEALTH_PENALTY,
  useScenario,
} from '@/context/ActiveScenarioContext'
import type { Effects } from '@/context/ActiveScenarioContext'

export {
  SCENARIO_COOLDOWN_SECONDS,
  SCENARIO_RESPONSE_TIME_SECONDS,
  SCENARIO_TIMEOUT_HEALTH_PENALTY,
}

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

export function ScenarioPanel() {
  const { state } = useGame()
  const {
    scenario,
    chosen,
    aiOutcome,
    isGeneratingOutcome,
    responseCountdown,
    countdown,
    autoRead,
    setAutoRead,
    executeOption,
    speakScenarioOrOutcome,
    stop,
    isPlaying,
    isVoiceLoading,
    ttsError,
  } = useScenario()

  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)

  const submit = () => {
    if (isGeneratingOutcome || countdown !== null || responseCountdown === 0) return
    const matched = matchOption(text, scenario.options)
    if (matched) {
      void executeOption(matched)
      setText('')
      setMiss(false)
    } else {
      setMiss(true)
    }
  }

  const rows = chosen
    ? (Object.keys(chosen.effects) as (keyof Effects)[]).filter(
        (k) => chosen.effects[k] !== undefined && chosen.effects[k] !== 0,
      )
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
            {scenario.name.toUpperCase()}
          </strong>
        </span>
        {countdown !== null ? (
          <Badge kind="warn">NEXT EVENT IN {countdown}S</Badge>
        ) : responseCountdown !== null ? (
          <Badge kind={responseCountdown <= 10 ? 'crit' : 'warn'}>
            RESPOND IN {responseCountdown}S
          </Badge>
        ) : null}
      </div>

      <p style={{ lineHeight: 1.5, marginBottom: 12 }}>{scenario.description}</p>

      {/* Options displayed as structured read-only records - NOT pressable buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0 14px' }}>
        {scenario.options.map((o) => (
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
            disabled={countdown !== null || isGeneratingOutcome || responseCountdown === 0}
            placeholder={
              countdown !== null
                ? `System cooldown active. Next event in ${countdown}s...`
                : responseCountdown !== null
                ? `Enter order (${responseCountdown}s to respond)...`
                : 'Enter order (e.g. A, B, C, or describe order)...'
            }
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <button
          onClick={submit}
          disabled={!text.trim() || countdown !== null || isGeneratingOutcome || responseCountdown === 0}
        >
          {isGeneratingOutcome ? 'TRANSMITTING...' : 'EXECUTE ▶'}
        </button>
      </div>

      {responseCountdown === 0 && countdown !== null && (
        <p className="rc-muted" style={{ color: '#ff4d4d', fontStyle: 'italic', margin: '4px 0 8px' }}>
          RESPONSE WINDOW EXPIRED (30S): -{SCENARIO_TIMEOUT_HEALTH_PENALTY}% BASE HEALTH PENALTY. Automatic emergency containment engaged. Next scenario in {countdown}s...
        </p>
      )}

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
            onClick={speakScenarioOrOutcome}
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
            <Badge
              kind={
                chosen.effects.base_health_pct < -9
                  ? 'crit'
                  : chosen.effects.base_health_pct < 0
                  ? 'warn'
                  : 'out'
              }
            >
              {rows.length ? 'COSTS INCURRED' : 'NO COST'}
            </Badge>
          </div>
          {rows.map((k) => {
            const rk = RESOURCE_OF[k]
            const cur = state.resources[rk]
            const effectVal = chosen.effects[k] ?? 0
            return (
              <div className="rc-row" key={k}>
                <span>{EFFECT_LABEL[k]}</span>
                {cur === undefined
                  ? `${effectVal}`
                  : `${fmt(cur, 1)} → ${fmt(Math.max(0, cur + effectVal), 1)} (${
                      effectVal > 0 ? '+' : ''
                    }${effectVal})`}
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
