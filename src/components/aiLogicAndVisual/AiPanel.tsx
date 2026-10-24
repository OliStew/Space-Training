import { useDebugResources, useGameTime, useResources } from '@/game'
import { useGenerate } from '@/hooks/useGenerate'
import {useState} from "react";


/**
 * Placeholder for the ai UI. No logic yet — this is just screen space.
 * Replace the contents; the rest of the page does not depend on it.
 *
 * Hooked up, but intentionally unused so far:
 *   resources                  read: { money, metal, ammo, biomass, oxygen, buildings }
 *   addResource(key, amount)   write: give the player `amount` of `key`
 *   removeResource(key, amount) write: take `amount` of `key` (stops at zero)
 *   gameTime                  read: the shared game clock in seconds (also useGameTime().set(seconds) to change it)
 * (add/remove come from useDebugResources; despite the name they are the general write API.)
 */
export function AIPanel() {
    const resources = useResources()
    const {add: addResource, remove: removeResource} = useDebugResources()
    const {seconds: gameTime} = useGameTime()
    void resources, addResource, removeResource, gameTime // available to the scenario code, not used yet

    const { text, loading, error, generate } = useGenerate() // AI access; `text` is the AI's response, `generate(prompt)`
                                                             // is the function to call to generate a response, loading
                                                             // is a bool indicating whether the AI is currently generating a response

    const [prompt, setPrompt] = useState('') // This makes prompt "reactive": whenever setPrompt(value) is called, the HTML will update.

    // To modify resources, use the form addResource('money', 100) and removeResource('biomass', 50)
    // To access resources, use the form resources.money, resources.metal, etc.
    // Or you can loop through resources to view multiple at once



    // Below: the <textarea> allows the user to enter a prompt (and uses setPrompt to make sure the prompt is updated in real-time)
    // The button calls generate(prompt) when pressed. generate(prompt) sets `text` to the AI's response when it's done.
    // The curly braces after that just render the text variable if it exists, or the error message if it exists.

    return (
        <div>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}/>
            <button onClick={() => generate(prompt)} disabled={loading}>
                {loading ? 'Generating...' : 'Generate'}
            </button>
            {error && <p style={{color: 'red'}}>{error}</p>}
            {text && <pre>{text}</pre>}
        </div>
    )
}