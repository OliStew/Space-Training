import { describe, expect, it } from 'vitest'
import {
  getScenarioSpokenText,
  matchOption,
  SCENARIO_COOLDOWN_SECONDS,
  SCENARIO_RESPONSE_TIME_SECONDS,
  SCENARIO_TIMEOUT_HEALTH_PENALTY,
  scenariosList,
} from '@/context/ScenarioContext'
import type { Option, Scenario } from '@/context/ScenarioContext'
import {
  ActiveScenarioProvider,
  ScenarioProvider,
  useActiveScenario,
  useScenario,
} from '@/context/ActiveScenarioContext'
import { applyDelta, checkGameOutcome, initialState } from '@/game/state'

describe('Simulation Scenario Timers and State', () => {
  it('exposes compatible ActiveScenarioContext aliases', () => {
    expect(ActiveScenarioProvider).toBe(ScenarioProvider)
    expect(useActiveScenario).toBe(useScenario)
  })
  it('has response window configured to exactly 30 seconds', () => {
    expect(SCENARIO_RESPONSE_TIME_SECONDS).toBe(30)
  })

  it('has cooldown between scenarios configured to exactly 30 seconds', () => {
    expect(SCENARIO_COOLDOWN_SECONDS).toBe(30)
  })

  it('has scenario timeout base health penalty configured to 20%', () => {
    expect(SCENARIO_TIMEOUT_HEALTH_PENALTY).toBe(20)
  })

  it('removes 20 base health when a scenario is not responded to', () => {
    const s = initialState()
    expect(s.resources.health).toBe(100)

    // Apply the timeout penalty
    const penalised = applyDelta(s, { health: SCENARIO_TIMEOUT_HEALTH_PENALTY }, -1)
    expect(penalised.resources.health).toBe(80)
    expect(checkGameOutcome(penalised)).toBe('playing')
  })

  it('triggers defeat if timeout penalty reduces base health to 0%', () => {
    const s = { ...initialState(), resources: { ...initialState().resources, health: 15 } }
    const dead = applyDelta(s, { health: SCENARIO_TIMEOUT_HEALTH_PENALTY }, -1)
    expect(dead.resources.health).toBe(0)
    expect(checkGameOutcome(dead)).toBe('defeat')
  })

  it('triggers defeat after 5 consecutive ignored crisis events from full health', () => {
    let s = initialState()
    expect(s.resources.health).toBe(100)

    for (let i = 1; i <= 5; i++) {
      s = applyDelta(s, { health: SCENARIO_TIMEOUT_HEALTH_PENALTY }, -1)
      expect(s.resources.health).toBe(Math.max(0, 100 - i * 20))
    }

    expect(s.resources.health).toBe(0)
    expect(checkGameOutcome(s)).toBe('defeat')
  })

  it('contains valid scenarios from scenarios.json', () => {
    expect(scenariosList.length).toBeGreaterThan(0)
    for (const sc of scenariosList) {
      expect(sc.id).toBeDefined()
      expect(sc.name).toBeTruthy()
      expect(sc.description).toBeTruthy()
      expect(sc.options.length).toBeGreaterThanOrEqual(2)
      for (const opt of sc.options) {
        expect(opt.key).toBeTruthy()
        expect(opt.label).toBeTruthy()
        expect(opt.effects).toBeDefined()
      }
    }
  })

  it('matches option accurately by single letter key', () => {
    const sc = scenariosList[0]
    const matched = matchOption('A', sc.options)
    expect(matched).not.toBeNull()
    expect(matched?.key).toBe('A')

    const matchedLower = matchOption('a', sc.options)
    expect(matchedLower?.key).toBe('A')

    const matchedPrefixed = matchOption('option a', sc.options)
    expect(matchedPrefixed?.key).toBe('A')
  })

  it('matches option accurately by keyword scoring', () => {
    const sc = scenariosList[0]
    // Option A has trigger keywords like "feed", "rations", "distribute", "goop"
    const matched = matchOption('distribute fresh goop rations to colonists', sc.options)
    expect(matched).not.toBeNull()
    expect(matched?.key).toBe('A')
  })

  it('matches option accurately by substring of option label', () => {
    const sc = scenariosList[0]
    const opt = sc.options[1]
    const matched = matchOption(opt.label.toLowerCase(), sc.options)
    expect(matched).not.toBeNull()
    expect(matched?.key).toBe(opt.key)
  })

  it('returns null for unrecognized command inputs', () => {
    const sc = scenariosList[0]
    expect(matchOption('', sc.options)).toBeNull()
    expect(matchOption('   ', sc.options)).toBeNull()
    expect(matchOption('xyzzy dance with martians', sc.options)).toBeNull()
  })

  it('formats spoken text properly for C.O.R.A. voice reading', () => {
    const sampleScenario: Scenario = {
      id: 99,
      name: 'Oxygen Leak',
      description: 'Hull seal degraded in Sector 4.',
      options: [
        {
          key: 'A',
          action_id: 'SEAL',
          label: 'Seal Sector',
          intent_category: 'containment',
          trigger_keywords: ['seal'],
          effects: { food: 0, ammunition: 0, oxygen: 0, base_health_pct: 0 },
        },
        {
          key: 'B',
          action_id: 'VENT',
          label: 'Vent Sector',
          intent_category: 'purge',
          trigger_keywords: ['vent'],
          effects: { food: 0, ammunition: 0, oxygen: -10, base_health_pct: 0 },
        },
      ],
    }
    const spoken = getScenarioSpokenText(sampleScenario)
    expect(spoken).toContain('Scenario: Oxygen Leak')
    expect(spoken).toContain('Hull seal degraded in Sector 4.')
    expect(spoken).toContain('Option A: Seal Sector')
    expect(spoken).toContain('Option B: Vent Sector')
  })
})
