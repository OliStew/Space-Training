/**
 * React bindings for the game layer. Mount <GameProvider> inside the
 * signed-in area; any component below can then call useGame().
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth, useUser } from 'deepspace'
import { serverApi } from './api'
import { TradingEngine } from './engine'
import type { NetState } from './engine'
import { useObservable } from './observable'
import { GameStore, storeKey } from './store'
import type { GameState } from './state'

interface Game {
  store: GameStore
  engine: TradingEngine
}

const GameContext = createContext<Game | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const { user } = useUser()
  const name = user?.name?.trim() || user?.email?.split('@')[0] || ''
  const email = user?.email ?? undefined

  // The engine reads the latest profile when it syncs.
  const profile = useRef({ id: userId ?? '', name, email })
  profile.current = { id: userId ?? '', name, email }

  const game = useMemo<Game | null>(() => {
    if (!userId) return null
    const store = new GameStore(typeof localStorage === 'undefined' ? null : localStorage, storeKey(userId))
    return { store, engine: new TradingEngine(store, serverApi, () => profile.current) }
  }, [userId])

  useEffect(() => {
    if (!game) return
    const stopStore = game.store.start()
    const stopEngine = game.engine.start()
    return () => {
      stopStore()
      stopEngine()
    }
  }, [game])

  // Register with the player directory as soon as the profile name is known.
  useEffect(() => {
    if (game && name) void game.engine.syncTrades()
  }, [game, name])

  if (!game) return null
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>
}

/** Resources, depletion settings, trade holds and history. */
export function useGameState(): GameState {
  return useObservable(useGameContext().store)
}

/** Markets, price-update timing, and open trade requests. */
export function useNet(): NetState {
  return useObservable(useGameContext().engine.net)
}

/** Everything you can do: `engine.buyFromMarket`, `engine.sendTrade`, `store.update(...)`, … */
export function useGame(): { state: GameState; net: NetState } & Game {
  const game = useGameContext()
  return { ...game, state: useObservable(game.store), net: useObservable(game.engine.net) }
}

function useGameContext(): Game {
  const game = useContext(GameContext)
  if (!game) throw new Error('useGame must be used inside <GameProvider>')
  return game
}

/** Re-render on an interval (for countdowns). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
