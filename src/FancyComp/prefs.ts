import { useSyncExternalStore } from 'react'

export type Theme = 'green' | 'amber' | 'cyan' | 'white'
export interface Prefs { theme: Theme; scanlines: boolean; flicker: boolean }

const KEY = 'robco-prefs'
const DEFAULTS: Prefs = { theme: 'green', scanlines: true, flicker: true }

function load(): Prefs {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEFAULTS }
}

let prefs = load()
const subs = new Set<() => void>()

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* private mode */ }
  subs.forEach((f) => f())
}

export const usePrefs = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => prefs, () => DEFAULTS)
