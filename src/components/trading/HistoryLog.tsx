import { useGameState } from '@/game/GameProvider'

export function HistoryLog() {
  const { history } = useGameState()
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Activity</h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {[...history].reverse().slice(0, 20).map((h) => (
            <li key={h.id} className="flex gap-3">
              <time className="shrink-0 font-mono text-xs text-muted-foreground">{new Date(h.at).toLocaleTimeString()}</time>
              <span className="text-foreground">{h.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
