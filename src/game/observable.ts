import { useSyncExternalStore } from 'react'

/** Minimal observable value; snapshots must be treated as immutable. */
export class Observable<T> {
  private listeners = new Set<() => void>()
  constructor(protected value: T) {}

  get = (): T => this.value

  set(next: T) {
    if (next === this.value) return
    this.value = next
    this.listeners.forEach((l) => l())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export function useObservable<T>(o: Observable<T>): T {
  return useSyncExternalStore(o.subscribe, o.get, o.get)
}
