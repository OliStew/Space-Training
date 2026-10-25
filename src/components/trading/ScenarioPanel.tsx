import { useState } from 'react'
import { useScenario, type ScenarioOption } from '@/context/ScenarioContext'
import { useTextToSpeech } from '@/lib/tts'

export function ScenarioPanel() {
  const {
    scenario,
    feedback,
    aiOutcome,
    isGeneratingOutcome,
    countdown,
    autoRead,
    setAutoRead,
    handleChooseOption,
    getScenarioSpokenText,
  } = useScenario()

  const { speak, stop, isPlaying, isLoading: isVoiceLoading, error: ttsError } = useTextToSpeech()
  const [inputText, setInputText] = useState('')

  const handleTextSubmit = () => {
    const query = inputText.trim().toLowerCase()
    if (!query || !scenario || isGeneratingOutcome || countdown !== null) return

    // 1. Exact match on key ("a", "b", "c", "option a", etc.)
    let matched = scenario.options.find(
      (opt: ScenarioOption) =>
        opt.key.toLowerCase() === query ||
        `option ${opt.key.toLowerCase()}` === query,
    )

    // 2. Trigger keywords match
    if (!matched) {
      matched = scenario.options.find((opt: ScenarioOption) =>
        opt.trigger_keywords?.some((kw) => query.includes(kw.toLowerCase())),
      )
    }

    // 3. Option label substring match
    if (!matched) {
      matched = scenario.options.find(
        (opt: ScenarioOption) =>
          opt.label.toLowerCase().includes(query) ||
          query.includes(opt.label.toLowerCase()),
      )
    }

    if (matched) {
      void handleChooseOption(matched)
      setInputText('')
    }
  }

  if (!scenario) {
    return (
      <section>
        <h2>Scenario</h2>
        <p>No active scenarios.</p>
      </section>
    )
  }

  return (
    <section>
      <h2>Scenario: {scenario.name}</h2>
      <p>{scenario.description}</p>
      <ul>
        {scenario.options.map((opt: ScenarioOption) => (
          <li key={opt.key}>
            <button
              disabled={isGeneratingOutcome || countdown !== null}
              onClick={() => void handleChooseOption(opt)}
            >
              Option {opt.key}: {opt.label}
            </button>
          </li>
        ))}
      </ul>
      <p>
        <input
          type="text"
          size={35}
          placeholder={
            countdown !== null
              ? `Next scenario in ${countdown}s...`
              : 'Enter command or option...'
          }
          value={inputText}
          disabled={isGeneratingOutcome || countdown !== null}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextSubmit()
          }}
        />{' '}
        <button
          disabled={isGeneratingOutcome || countdown !== null}
          onClick={handleTextSubmit}
        >
          Submit
        </button>{' '}
        {isPlaying ? (
          <button onClick={stop}>Stop Voice</button>
        ) : (
          <button
            disabled={isVoiceLoading || isGeneratingOutcome}
            onClick={() => {
              const textToRead = aiOutcome || getScenarioSpokenText(scenario)
              speak(textToRead).catch(() => {})
            }}
          >
            {isVoiceLoading ? 'Loading Voice...' : aiOutcome ? 'Read Outcome' : 'Read Aloud'}
          </button>
        )}{' '}
        <label style={{ marginLeft: 8, fontSize: '0.9em' }}>
          <input
            type="checkbox"
            checked={autoRead}
            onChange={(e) => setAutoRead(e.target.checked)}
          />{' '}
          Auto-read with C.O.R.A.
        </label>
      </p>

      {feedback && <p>{feedback}</p>}

      {isGeneratingOutcome && !aiOutcome && (
        <p style={{ fontStyle: 'italic', color: '#888' }}>
          Generating aftermath narrative from DeepSpace AI...
        </p>
      )}

      {aiOutcome && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 14px',
            border: '1px solid #444',
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <strong>Aftermath:</strong>
          <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
            {aiOutcome}
            {isGeneratingOutcome && (
              <span style={{ display: 'inline-block', marginLeft: 4, opacity: 0.8 }}>▌</span>
            )}
          </p>
        </div>
      )}

      {countdown !== null && (
        <p style={{ fontStyle: 'italic', color: '#888' }}>
          Next scenario arriving in {countdown}s...
        </p>
      )}

      {ttsError && <p style={{ color: 'red' }}>Voice Error: {ttsError}</p>}
    </section>
  )
}
