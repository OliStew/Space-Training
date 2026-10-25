import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/FancyComp/parts'

const AUTO_DISMISS_MS = 10_000

export interface ScenarioAlert {
  id: number
  name: string
  description: string
}

/** Notification for a new crisis event. Dismisses itself after a few seconds. */
export function ScenarioPopup({ scenario, onClose }: { scenario: ScenarioAlert; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [scenario.id, onClose])

  return (
    <div className="rc-popup" role="alert">
      <div className="rc-popup-head">
        <Badge kind="warn">NEW CRISIS EVENT</Badge>
        <button className="rc-x" onClick={onClose} aria-label="Dismiss">×</button>
      </div>
      <strong style={{ color: 'var(--hi)', letterSpacing: '0.04em' }}>{scenario.name.toUpperCase()}</strong>
      <p className="rc-muted" style={{ margin: '4px 0 8px' }}>{scenario.description}</p>
      <Link to="/simulation" onClick={onClose}>RESPOND ▶</Link>
    </div>
  )
}
