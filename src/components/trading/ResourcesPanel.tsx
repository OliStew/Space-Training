import { useGame } from '@/game/GameProvider'
import { ResourceTiles } from '@/FancyComp/ResourceTiles'

export function ResourcesPanel() {
  const { state } = useGame()
  return <ResourceTiles state={state} />
}

