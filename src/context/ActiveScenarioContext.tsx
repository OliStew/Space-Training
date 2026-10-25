import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export interface ActiveScenario {
  id: number
  name: string
  description: string
  options: {
    key: string
    label: string
    effects: {
      food: number
      ammunition: number
      oxygen: number
      base_health_pct: number
    }
  }[]
}

interface ActiveScenarioContextValue {
  scenario: ActiveScenario | null
  setScenario: (scenario: ActiveScenario | null) => void
}

const ActiveScenarioContext = createContext<ActiveScenarioContextValue | null>(null)

export function ActiveScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ActiveScenario | null>(null)
  return (
    <ActiveScenarioContext.Provider value={{ scenario, setScenario }}>
      {children}
    </ActiveScenarioContext.Provider>
  )
}

export function useActiveScenario() {
  const context = useContext(ActiveScenarioContext)
  if (!context) {
    throw new Error('useActiveScenario must be used within an ActiveScenarioProvider')
  }
  return context
}
