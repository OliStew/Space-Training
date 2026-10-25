import { useGameOutcome, useResources, useDayTime, VICTORY_DAY_THRESHOLD } from '@/game'
import { Badge } from './parts'
import { fmt } from '@/components/trading/format'

export function EndStateModal() {
  const { outcome, resetGame, continueSimulation } = useGameOutcome()
  const dayTime = useDayTime()
  const resources = useResources()

  if (outcome === 'playing') {
    return null
  }

  const isVictory = outcome === 'victory'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-state-title"
    >
      <div
        className="rc-win"
        style={{
          width: 'min(640px, 100%)',
          borderColor: isVictory ? 'var(--hi)' : '#ff4d4d',
          boxShadow: isVictory
            ? '0 0 50px rgba(74, 246, 38, 0.35)'
            : '0 0 50px rgba(255, 77, 77, 0.4)',
        }}
      >
        <div className="rc-titlebar">
          <div className="t">
            <small>{isVictory ? 'robco_mission.exe_' : 'robco_emergency.exe_'}</small>
            <b style={{ color: isVictory ? 'var(--hi)' : '#ff4d4d' }}>
              {isVictory
                ? `MISSION VICTORY // ${VICTORY_DAY_THRESHOLD}-DAY SIMULATION COMPLETE`
                : 'CRITICAL FAILURE // COLONY INTEGRITY BREACHED'}
            </b>
          </div>
          <Badge kind={isVictory ? 'out' : 'crit'}>
            {isVictory ? 'VICTORY' : 'DEFEAT'}
          </Badge>
        </div>

        <div style={{ padding: 24 }}>
          {isVictory ? (
            <>
              <h1
                id="end-state-title"
                style={{
                  color: 'var(--hi)',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                  fontSize: '20px',
                }}
              >
                ★ OUTPOST SURVIVAL CONFIRMED ★
              </h1>
              <p style={{ lineHeight: 1.6, fontSize: '13px', marginBottom: 12 }}>
                Congratulations, Commander! You have successfully commanded the outpost through{' '}
                <strong style={{ color: 'var(--hi)' }}>30 full days ({dayTime.day} days logged)</strong>{' '}
                of deep space operations. All critical life-support protocols were maintained and the
                colony has firmly established its presence in the frontier.
              </p>
              <p className="rc-muted" style={{ lineHeight: 1.5, fontSize: '12px', marginBottom: 18 }}>
                You may choose to continue managing the station in extended simulation mode, or reset
                the colony simulation back to Day 1 to begin a new campaign.
              </p>

              <div
                className="rc-panel"
                style={{ marginBottom: 20, padding: 12, background: 'rgba(0,0,0,0.45)' }}
              >
                <div className="rc-row">
                  <span>FINAL DAY LOGGED</span>
                  <strong style={{ color: 'var(--hi)' }}>DAY {dayTime.day} ({dayTime.timeString})</strong>
                </div>
                <div className="rc-row">
                  <span>BASE HULL INTEGRITY</span>
                  <strong>{fmt(resources.health, 1)}%</strong>
                </div>
                <div className="rc-row">
                  <span>BIOMASS RESERVES</span>
                  <strong>{fmt(resources.biomass, 1)}</strong>
                </div>
                <div className="rc-row">
                  <span>OXYGEN RESERVES</span>
                  <strong>{fmt(resources.oxygen, 1)}</strong>
                </div>
                <div className="rc-row">
                  <span>TREASURY BALANCE</span>
                  <strong>${fmt(resources.money)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={continueSimulation}
                  style={{ minWidth: 200 }}
                >
                  CONTINUE SIMULATION ▶
                </button>
                <button
                  className="danger"
                  onClick={resetGame}
                >
                  RESET SIMULATION ↺
                </button>
              </div>
            </>
          ) : (
            <>
              <h1
                id="end-state-title"
                style={{
                  color: '#ff4d4d',
                  letterSpacing: '0.06em',
                  marginBottom: 10,
                  fontSize: '20px',
                }}
              >
                ☠ COLONY DESTROYED: 0% HEALTH ☠
              </h1>
              <p style={{ lineHeight: 1.6, fontSize: '13px', marginBottom: 12 }}>
                Critical failure alert! Base health has collapsed to{' '}
                <strong style={{ color: '#ff4d4d' }}>0%</strong>. Structural bulkheads have
                compromised, atmospheric pressure vented into the void, and station life-support
                subsystems are irrecoverable.
              </p>
              <p className="rc-muted" style={{ lineHeight: 1.5, fontSize: '12px', marginBottom: 18 }}>
                The simulation terminated on Day {dayTime.day} at {dayTime.timeString}. All colony
                telemetry has gone dark. Reboot the station terminal bios to initiate a fresh
                simulation run.
              </p>

              <div
                className="rc-panel"
                style={{
                  marginBottom: 20,
                  padding: 12,
                  borderColor: '#ff4d4d',
                  background: 'rgba(255, 0, 0, 0.05)',
                }}
              >
                <div className="rc-row">
                  <span>TERMINATION TIME</span>
                  <strong>DAY {dayTime.day} at {dayTime.timeString}</strong>
                </div>
                <div className="rc-row">
                  <span>BASE HEALTH</span>
                  <strong style={{ color: '#ff4d4d' }}>0.0% [CRITICAL ZERO]</strong>
                </div>
                <div className="rc-row">
                  <span>PRIMARY CASUALTY</span>
                  <span style={{ color: '#ffb000' }}>TOTAL HULL FAILURE</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="danger"
                  onClick={resetGame}
                  style={{ minWidth: 220 }}
                >
                  REBOOT &amp; RESET SIMULATION ↺
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
