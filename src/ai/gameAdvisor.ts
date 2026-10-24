import { useResources } from '@/game'

export function useGameAdvisor() {
  const resources = useResources()
  return { resources }
}
