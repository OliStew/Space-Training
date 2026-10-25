import { useEffect, useRef } from 'react'
import { Badge } from '@/FancyComp/parts'

const AUTO_DISMISS_MS = 8_000

export interface AutoResponse {
  id: string
  fromName: string
  /** Ammo that was sent. */
  amount: number
  /** Ammo that would have fully defended. */
  requiredDefense: number
  /** Set if sending the response failed. */
  error?: string
}

/** Notification that time ran out on an attack and a response was sent for you. */
export function AutoRespondPopup({ response, onClose }: { response: AutoResponse; onClose: () => void }) {
  // The parent re-renders constantly with a fresh onClose; don't restart the timer for it.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [response.id])

  const failed = !!response.error
  return (
    <div className={`rc-popup${failed ? ' crit' : ''}`} role="alert">
      <div className="rc-popup-head">
        <Badge kind={failed ? 'crit' : 'warn'}>{failed ? 'AUTO-RESPOND FAILED' : 'AUTO-RESPONDED'}</Badge>
        <button className="rc-x" onClick={onClose} aria-label="Dismiss">×</button>
      </div>
      {failed ? (
        <p style={{ margin: 0, color: '#ff4d4d' }}>Couldn't respond to {response.fromName}: {response.error}</p>
      ) : (
        <p style={{ margin: 0 }}>
          Time ran out: responded to {response.fromName} with {response.amount} ammo.{' '}
          <span className="rc-muted">
            {response.amount >= response.requiredDefense ? 'Fully defended.' : `${response.requiredDefense} was needed for no harm.`}
          </span>
        </p>
      )}
    </div>
  )
}
