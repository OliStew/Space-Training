import { useEffect, useState, useCallback } from 'react'
import { AlienWords, getAlienDisplay } from '@/lib/Language'

interface GameState {
  alienDisplay: string
  options: string[]
  chosenWord: string
  result: string
  resultColor: string
}

const initialGameState: GameState = {
  alienDisplay: '...',
  options: [],
  chosenWord: '',
  result: '',
  resultColor: ''
}

function generateRound(): Omit<GameState, 'result' | 'resultColor'> {
  const chosenWord = AlienWords[Math.floor(Math.random() * AlienWords.length)]
  const alienDisplay = getAlienDisplay(chosenWord)

  const options = [chosenWord]
  while (options.length < 3) {
    const wrong = AlienWords[Math.floor(Math.random() * AlienWords.length)]
    if (!options.includes(wrong)) {
      options.push(wrong)
    }
  }

  return { alienDisplay, options, chosenWord }
}

export function Language() {
  const [game, setGame] = useState<GameState>(initialGameState)

  const startRound = useCallback(() => {
    const round = generateRound()
    setGame({ ...round, result: '', resultColor: '' })
  }, [])

  useEffect(() => {
    startRound()
  }, [startRound])

  const checkGuess = useCallback(
    (selectedWord: string) => {
      if (selectedWord === game.chosenWord) {
        setGame((prev) => ({
          ...prev,
          result: 'Correct! ✅',
          resultColor: '#4ade80'
        }))
      } else {
        setGame((prev) => ({
          ...prev,
          result: `Wrong! It was "${game.chosenWord}" ❌`,
          resultColor: '#f87171'
        }))
      }

      setTimeout(startRound, 1500)
    },
    [game.chosenWord, startRound]
  )

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Decode the Alien Word:</h1>
      <div
        style={{
          fontSize: '2.5rem',
          color: '#38bdf8',
          margin: '20px',
          letterSpacing: '3px'
        }}
      >
        {game.alienDisplay}
      </div>

      <div>
        {game.options.map((option) => (
          <button
            key={option}
            onClick={() => checkGuess(option)}
            style={{
              display: 'block',
              margin: '10px auto',
              padding: '12px 24px',
              fontSize: '1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            {option}
          </button>
        ))}
      </div>

      <h3 style={{ color: game.resultColor }}>{game.result}</h3>
    </div>
  )
}
