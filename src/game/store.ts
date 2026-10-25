import { Observable } from './observable'
import { reviveState, tick } from './state'
import type { GameState } from './state'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/**
 * A player's persisted game state. Lives in localStorage under a per-user key
 * and drains biomass/oxygen once a second while started (and catches up for
 * time spent closed, since depletion is computed from elapsed time).
 */
export class GameStore extends Observable<GameState> {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private storage: StorageLike | null,
    private key: string,
    private now: () => number = Date.now,
  ) {
    super(reviveState(read(storage, key), now()))
    this.persist()
  }

  /** Apply a pure state change and persist it. */
  update(fn: (s: GameState) => GameState): void {
    const next = fn(this.value)
    if (next === this.value) return
    this.set(next)
    this.persist()
  }

  /** Run `fn` and report whether it changed anything (e.g. a spend that was affordable). */
  tryUpdate(fn: (s: GameState) => GameState | null): boolean {
    const next = fn(this.value)
    if (!next) return false
    this.update(() => next)
    return true
  }

  start(intervalMs = 1000): () => void {
    this.stop()
    this.update((s) => tick(s, this.now()))
    this.timer = setInterval(() => this.update((s) => tick(s, this.now())), intervalMs)
    const onStorage = (e: StorageEvent) => {
      // Another tab changed this player's state; adopt it rather than overwrite it.
      if (e.key === this.key && e.newValue) this.set(reviveState(safeParse(e.newValue), this.now()))
    }
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
    return () => {
      this.stop()
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private persist() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.value))
    } catch {
      // Storage full or unavailable: keep playing in memory.
    }
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function read(storage: StorageLike | null, key: string): unknown {
  const text = storage?.getItem(key)
  return text ? safeParse(text) : null
}

export const storeKey = (userId: string) => `life-in-space:game:${userId}`
