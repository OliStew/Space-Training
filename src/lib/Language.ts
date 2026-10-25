 export const AlienAlphabet: Record<string, string> = {
   A: 'Α', a: 'α', B: 'ꓭ', b: 'β',
   C: 'Γ', c: 'γ', D: 'Δ', d: 'δ',
   E: 'Ε', e: 'ε', F: 'Ϝ', f: 'ζ',
   G: 'Θ', g: 'θ', H: 'Η', h: 'η',
   I: 'Ι', i: 'ι', J: 'Λ', j: 'λ',
   K: 'Κ', k: 'κ', L: 'Ł', l: 'l',
   M: 'Μ', m: 'μ', N: 'Ν', n: 'ν',
   O: 'Ο', o: 'ο', P: 'Ρ', p: 'ρ',
   Q: 'Φ', q: 'φ', R: 'Σ', r: 'σ',
   S: 'ς', s: 's', T: 'Τ', t: 'τ',
   U: 'U', u: 'π', V: 'Π', v: 'v',
   W: 'Ω', w: 'ω', X: 'X', x: 'x',
   Y: 'Ψ', y: 'ψ', Z: 'Z', z: '𝟚', '': ''
 }

 export const AlienWords = [
   'Colony Health',
   'Colony Name',
   'Space Goop',
   'Space Bucks',
   'Oxygen',
   'Ammunition',
   'Evil',
   'Friendly'
 ]

 /** Translate plain text to the alien alphabet */
 export function translateToAlien(text: string): string {
   return text
     .split('')
     .map((char) => (char in AlienAlphabet ? AlienAlphabet[char] : char))
     .join('')
 }

 /** Scramble the characters of a string */
 function scrambleOnce(word: string): string {
   const letters = word.split('')
   for (let i = letters.length - 1; i > 0; i--) {
     const j = Math.floor(Math.random() * (i + 1))
     ;[letters[i], letters[j]] = [letters[j], letters[i]]
   }
   return letters.join('')
 }

 const STORAGE_KEY = 'alien-word-cache'

 /** Load cached alien displays from localStorage */
 function loadCache(): Record<string, string> {
   try {
     const raw = localStorage.getItem(STORAGE_KEY)
     if (raw) return JSON.parse(raw)
   } catch {
     // ignore corrupt data
   }
   return {}
 }

 /** Persist the cache to localStorage */
 function saveCache(cache: Record<string, string>) {
   try {
     localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
   } catch {
     // storage full or unavailable — silent fail
   }
 }

 // Initialize cache from localStorage
 const alienCache: Record<string, string> = loadCache()

 /**
  * Get the persistent scrambled alien display for a word.
  * First call generates and caches the value; subsequent calls return the cached value.
  * Cache persists across page reloads via localStorage.
  */
 export function getAlienDisplay(word: string): string {
   if (!(word in alienCache)) {
     const translated = translateToAlien(word)
     alienCache[word] = scrambleOnce(translated)
     saveCache(alienCache)
   }
   return alienCache[word]
 }