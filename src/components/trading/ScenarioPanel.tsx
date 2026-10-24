import { useDebugResources, useGameTime, useResources } from '@/game'

/**
 * Placeholder for the scenario UI. No logic yet — this is just screen space.
 * Replace the contents; the rest of the page does not depend on it.
 *
 * Hooked up, but intentionally unused so far:
 *   resources                  read: { money, metal, ammo, biomass, oxygen, buildings }
 *   addResource(key, amount)   write: give the player `amount` of `key`
 *   removeResource(key, amount) write: take `amount` of `key` (stops at zero)
 *   gameTime                  read: the shared game clock in seconds (also useGameTime().set(seconds) to change it)
 * (add/remove come from useDebugResources; despite the name they are the general write API.)
 */
export function ScenarioPanel() {
  const resources = useResources()
  const { add: addResource, remove: removeResource } = useDebugResources()
  const { seconds: gameTime } = useGameTime()
  void resources, addResource, removeResource, gameTime // available to the scenario code, not used yet

    // To modify resources, use the form addResource('money', 100) and removeResource('biomass', 50)
    // To access resources, use the form resources.money, resources.metal, etc.
    // Or you can loop through resources to view multiple at once

  return (
    <section>
      <h2>Scenario</h2>
      <div style={{ minHeight: 200, border: '1px dashed gray', padding: 8 }}>
        (scenario goes here)
      </div>
    </section>
  )
}
