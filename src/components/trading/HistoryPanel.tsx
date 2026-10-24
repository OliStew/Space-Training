import { useHistory } from '@/game'

/** Uses useHistory() -> [{ id, at (epoch ms), text }], oldest first. */
export function HistoryPanel() {
  const history = useHistory()
  return (
    <section>
      <h2>Activity</h2>
      {history.length === 0 && <p>Nothing yet.</p>}
      <ul>
        {[...history].reverse().slice(0, 20).map((h) => (
          <li key={h.id}>{new Date(h.at).toLocaleTimeString()} - {h.text}</li>
        ))}
      </ul>
    </section>
  )
}
