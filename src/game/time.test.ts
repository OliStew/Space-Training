import { describe, expect, it } from 'vitest'
import {
  advanceDay,
  calcDayTime,
  calculateHealthRegen,
  checkGameOutcome,
  continueAfterVictory,
  DAY_DURATION_SECONDS,
  HEALTH_REGEN_INTERVAL_SECONDS,
  HEALTH_REGEN_RATE,
  HEALTH_REGEN_THRESHOLD,
  initialState,
  isHealthRegenerating,
  MAX_HEALTH,
  resetGameState,
  setDay,
  setGameTime,
  tick,
  VICTORY_DAY_THRESHOLD,
} from './state'

describe('Day and Time System', () => {
  it('has a day duration of exactly 120 seconds', () => {
    expect(DAY_DURATION_SECONDS).toBe(120)
  })

  it('starts at Day 1, 00:00:00 (NIGHT) at gameTime = 0', () => {
    const time = calcDayTime(0)
    expect(time.day).toBe(1)
    expect(time.hour).toBe(0)
    expect(time.minute).toBe(0)
    expect(time.second).toBe(0)
    expect(time.timeString).toBe('00:00')
    expect(time.timeStringFull).toBe('00:00:00')
    expect(time.phase).toBe('NIGHT')
    expect(time.cycle).toBe('NIGHT')
    expect(time.progress).toBe(0)
    expect(time.progressPercent).toBe(0)
    expect(time.secondsLeftInDay).toBe(120)
  })

  it('calculates 6:00:00 (DAWN / MORNING) at 30 seconds (quarter day)', () => {
    const time = calcDayTime(30)
    expect(time.day).toBe(1)
    expect(time.hour).toBe(6)
    expect(time.minute).toBe(0)
    expect(time.second).toBe(0)
    expect(time.timeString).toBe('06:00')
    expect(time.phase).toBe('MORNING')
    expect(time.cycle).toBe('DAWN')
    expect(time.progress).toBeCloseTo(0.25)
    expect(time.progressPercent).toBe(25)
    expect(time.secondsLeftInDay).toBe(90)
  })

  it('calculates 12:00:00 (AFTERNOON / DAY) at 60 seconds (midday)', () => {
    const time = calcDayTime(60)
    expect(time.day).toBe(1)
    expect(time.hour).toBe(12)
    expect(time.minute).toBe(0)
    expect(time.second).toBe(0)
    expect(time.timeString).toBe('12:00')
    expect(time.phase).toBe('AFTERNOON')
    expect(time.cycle).toBe('DAY')
    expect(time.progress).toBeCloseTo(0.5)
    expect(time.progressPercent).toBe(50)
    expect(time.secondsLeftInDay).toBe(60)
  })

  it('calculates 18:00:00 (EVENING / DUSK) at 90 seconds (three-quarter day)', () => {
    const time = calcDayTime(90)
    expect(time.day).toBe(1)
    expect(time.hour).toBe(18)
    expect(time.minute).toBe(0)
    expect(time.timeString).toBe('18:00')
    expect(time.phase).toBe('EVENING')
    expect(time.cycle).toBe('DUSK')
    expect(time.progress).toBeCloseTo(0.75)
    expect(time.progressPercent).toBe(75)
    expect(time.secondsLeftInDay).toBe(30)
  })

  it('advances to Day 2 at 120 seconds', () => {
    const time = calcDayTime(120)
    expect(time.day).toBe(2)
    expect(time.hour).toBe(0)
    expect(time.minute).toBe(0)
    expect(time.timeString).toBe('00:00')
    expect(time.phase).toBe('NIGHT')
    expect(time.progress).toBe(0)
    expect(time.secondsLeftInDay).toBe(120)
  })

  it('advances to Day 3 at 240 seconds', () => {
    const time = calcDayTime(240)
    expect(time.day).toBe(3)
    expect(time.hour).toBe(0)
    expect(time.minute).toBe(0)
  })

  it('handles fractional seconds and in-game minutes/seconds accurately', () => {
    // 5 real seconds = 1 in-game hour
    const t5 = calcDayTime(5)
    expect(t5.hour).toBe(1)
    expect(t5.minute).toBe(0)

    // 2.5 real seconds = 30 in-game minutes
    const t2_5 = calcDayTime(2.5)
    expect(t2_5.hour).toBe(0)
    expect(t2_5.minute).toBe(30)
  })

  it('setDay transitions gameTime correctly', () => {
    const s0 = initialState(0)
    const sAt30s = setGameTime(s0, 30) // Day 1, 06:00
    expect(calcDayTime(sAt30s.gameTime).day).toBe(1)

    // Set to Day 3 keeping time of day (06:00 = 30 seconds into Day 3)
    const sDay3 = setDay(sAt30s, 3, true)
    expect(sDay3.gameTime).toBe(2 * 120 + 30)
    const tDay3 = calcDayTime(sDay3.gameTime)
    expect(tDay3.day).toBe(3)
    expect(tDay3.hour).toBe(6)
    expect(tDay3.timeString).toBe('06:00')

    // Set to Day 4 without keeping time of day (00:00)
    const sDay4 = setDay(sAt30s, 4, false)
    expect(sDay4.gameTime).toBe(3 * 120)
    expect(calcDayTime(sDay4.gameTime).day).toBe(4)
    expect(calcDayTime(sDay4.gameTime).hour).toBe(0)
  })

  it('advanceDay jumps to 00:00 of next day', () => {
    const s = setGameTime(initialState(0), 45) // Day 1, 45 seconds in
    const next = advanceDay(s)
    expect(next.gameTime).toBe(120)
    const time = calcDayTime(next.gameTime)
    expect(time.day).toBe(2)
    expect(time.hour).toBe(0)
    expect(time.minute).toBe(0)
  })

  it('ticks seamlessly with the engine clock tick()', () => {
    let s = initialState(1000)
    s = tick(s, 1000 + 120_000) // 120 seconds elapsed
    expect(s.gameTime).toBe(120)
    const t = calcDayTime(s.gameTime)
    expect(t.day).toBe(2)
    expect(t.timeString).toBe('00:00')
  })
})

describe('Victory and Defeat End State System', () => {
  it('identifies standard playing state', () => {
    const s = initialState(0)
    expect(checkGameOutcome(s)).toBe('playing')
  })

  it('triggers defeat when base health drops to 0% at any time', () => {
    const s = initialState(0)
    const defeated = { ...s, resources: { ...s.resources, health: 0 } }
    expect(checkGameOutcome(defeated)).toBe('defeat')

    const negativeHealth = { ...s, resources: { ...s.resources, health: -5 } }
    expect(checkGameOutcome(negativeHealth)).toBe('defeat')
  })

  it('triggers victory when reaching Day 30', () => {
    const s = initialState(0)
    // Day 30 starts at (30 - 1) * 120 = 3480 seconds
    const day30State = setDay(s, VICTORY_DAY_THRESHOLD)
    expect(calcDayTime(day30State.gameTime).day).toBe(30)
    expect(checkGameOutcome(day30State)).toBe('victory')
  })

  it('allows continuing the simulation after victory without re-triggering modal', () => {
    const s = setDay(initialState(0), 30)
    expect(checkGameOutcome(s)).toBe('victory')

    const continued = continueAfterVictory(s)
    expect(continued.continuedAfterVictory).toBe(true)
    expect(checkGameOutcome(continued)).toBe('playing')

    // Advances to day 35, still playing
    const day35 = setDay(continued, 35)
    expect(checkGameOutcome(day35)).toBe('playing')
  })

  it('defeat takes precedence over victory if health drops to 0% after day 30', () => {
    const s = setDay(initialState(0), 30)
    const deadOnDay30 = { ...s, resources: { ...s.resources, health: 0 } }
    expect(checkGameOutcome(deadOnDay30)).toBe('defeat')
  })

  it('resetGameState restores full health, day 1, and clears victory state', () => {
    const s = setDay(initialState(0), 30)
    const continued = continueAfterVictory(s)
    const reset = resetGameState(continued, 5000)

    expect(reset.gameTime).toBe(0)
    expect(reset.resources.health).toBe(100)
    expect(reset.continuedAfterVictory).toBe(false)
    expect(checkGameOutcome(reset)).toBe('playing')
    expect(calcDayTime(reset.gameTime).day).toBe(1)
  })
})

describe('Base Health Regeneration System', () => {
  it('has regen constants configured correctly for 1% every 5 seconds', () => {
    expect(HEALTH_REGEN_INTERVAL_SECONDS).toBe(5)
    expect(HEALTH_REGEN_RATE).toBeCloseTo(0.2)
    expect(HEALTH_REGEN_THRESHOLD).toBe(50)
    expect(MAX_HEALTH).toBe(100)
  })

  it('detects when health should actively regenerate', () => {
    // Both > 50 and health < 100
    expect(isHealthRegenerating({ health: 80, biomass: 51, oxygen: 51 })).toBe(true)

    // Not regenerating if biomass <= 50
    expect(isHealthRegenerating({ health: 80, biomass: 50, oxygen: 60 })).toBe(false)
    expect(isHealthRegenerating({ health: 80, biomass: 40, oxygen: 60 })).toBe(false)

    // Not regenerating if oxygen <= 50
    expect(isHealthRegenerating({ health: 80, biomass: 60, oxygen: 50 })).toBe(false)
    expect(isHealthRegenerating({ health: 80, biomass: 60, oxygen: 30 })).toBe(false)

    // Not regenerating if health is already at max (100)
    expect(isHealthRegenerating({ health: 100, biomass: 80, oxygen: 80 })).toBe(false)

    // Not regenerating if health is 0 (colony destroyed)
    expect(isHealthRegenerating({ health: 0, biomass: 80, oxygen: 80 })).toBe(false)
  })

  it('regenerates 1% health every 5 seconds during tick() when biomass and oxygen > 50', () => {
    let s = initialState(0)
    s = { ...s, resources: { ...s.resources, health: 80, biomass: 80, oxygen: 80 } }

    // 1 second tick gives +0.2% health
    const tick1s = tick(s, 1000)
    expect(tick1s.resources.health).toBeCloseTo(80.2, 2)

    // 5 seconds tick gives exactly +1.0% health (80 -> 81)
    const tick5s = tick(s, 5000)
    expect(tick5s.resources.health).toBeCloseTo(81.0, 2)
  })

  it('does not regenerate health when biomass is at or below 50', () => {
    let s = initialState(0)
    s = { ...s, resources: { ...s.resources, health: 80, biomass: 50, oxygen: 80 } }

    const next = tick(s, 5000)
    expect(next.resources.health).toBe(80)
  })

  it('does not regenerate health when oxygen is at or below 50', () => {
    let s = initialState(0)
    s = { ...s, resources: { ...s.resources, health: 80, biomass: 80, oxygen: 50 } }

    const next = tick(s, 5000)
    expect(next.resources.health).toBe(80)
  })

  it('caps health regeneration at 100%', () => {
    let s = initialState(0)
    s = { ...s, resources: { ...s.resources, health: 99.5, biomass: 80, oxygen: 80 } }

    const next = tick(s, 5000)
    expect(next.resources.health).toBe(100)

    const nextAgain = tick(next, 10000)
    expect(nextAgain.resources.health).toBe(100)
  })

  it('does not resurrect colony from 0% health', () => {
    let s = initialState(0)
    s = { ...s, resources: { ...s.resources, health: 0, biomass: 80, oxygen: 80 } }

    const next = tick(s, 5000)
    expect(next.resources.health).toBe(0)
  })

  it('correctly handles multi-second elapsed time with calculateHealthRegen()', () => {
    const depletion = { biomass: 0.05, oxygen: 0.1 }

    // 10 seconds of regen at 0.2%/s = +2% health (80% -> 82%)
    const regen10 = calculateHealthRegen(80, 80, 80, depletion, 10)
    expect(regen10).toBeCloseTo(2)

    // Capping at 100%: 99% + 10s (would be +2%) -> capped at +1%
    const regenCap = calculateHealthRegen(99, 80, 80, depletion, 10)
    expect(regenCap).toBeCloseTo(1)
  })
})


