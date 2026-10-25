import React, { useState } from 'react'
import { useResources } from '@/game'
import { useScenario } from '@/context/ScenarioContext'
import { askResourceAI } from '@/services/ai-service'
import type { LowResourceGameReaction } from '@/interfaces/aiReactions'

export function AIPanel() {
  const resources = useResources()
  const { scenario } = useScenario()

  const [inputText, setInputText] = useState('')
  const [reaction, setReaction] = useState<LowResourceGameReaction | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTransmitToAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isProcessing) return

    setIsProcessing(true)

    try {
      const aiResponse = await askResourceAI(inputText, resources, scenario)
      setReaction(aiResponse)
    } catch (err) {
      console.error('AI transmission error:', err)
      setReaction({
        text: 'COMMS ARRAY OFFLINE. CHECK CONSOLE PARAMETERS.',
        vibe: 'WARNING',
        actionChain: [{ stepNumber: 1, action: 'NONE', reasoning: 'Transmission failure.' }]
      })
    } finally {
      setIsProcessing(false)
      setInputText('')
    }
  }

  return (
    <section style={{
      padding: '24px',
      background: '#0a0d0a',
      color: '#33ff33',
      fontFamily: 'Courier New, Courier, monospace',
      border: '1px solid #1c4a1c',
      borderRadius: '4px',
      letterSpacing: '0.5px'
    }}>
      <div style={{
        borderBottom: '1px solid #1c4a1c',
        paddingBottom: '12px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        {/*Colony Runtime Administrator*/}
        <span>SYSTEM: CORA AI</span>
        {scenario ? (
          <span style={{ fontSize: '0.85em', color: '#ffb86c' }}>
            [MONITORING SCENARIO: {scenario.name.toUpperCase()}]
          </span>
        ) : (
          <span style={{ fontSize: '0.85em', color: '#6272a4' }}>
            [SCENARIO: QUIET ORBIT]
          </span>
        )}
      </div>

      <div style={{
        minHeight: '100px',
        border: '1px solid #1c4a1c',
        padding: '16px',
        marginBottom: '24px',
        background: '#000000',
        lineHeight: '1.6'
      }}>
        {reaction ? (
          <div>
            <div style={{ marginBottom: '12px' }}>
              [{reaction.vibe}] TRANSMISSION RECEIVED
            </div>
            <div>
              AI: {reaction.text}
            </div>
          </div>
        ) : (
          <div style={{ color: '#1f661f' }}>
            Ship computer idling... enter command below.
          </div>
        )}
      </div>

      {reaction && reaction.actionChain.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px', color: '#66ff66' }}>
            RECOMMENDED PLAN:
          </div>
          {reaction.actionChain.map((step) => (
            <div key={step.stepNumber} style={{
              background: '#041204',
              border: '1px solid #1c4a1c',
              padding: '14px 16px',
              marginBottom: '10px'
            }}>
              <div>Step {step.stepNumber}: {step.action}</div>
              <div style={{ fontSize: '13px', color: '#2b882b', marginTop: '6px' }}>
                {step.reasoning}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleTransmitToAI} style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Consult space advisor..."
          disabled={isProcessing}
          style={{
            flexGrow: 1,
            padding: '12px',
            background: '#000000',
            border: '1px solid #1c4a1c',
            color: '#33ff33',
            fontFamily: 'inherit',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            background: '#0a240a',
            color: '#33ff33',
            border: '1px solid #33ff33',
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          {isProcessing ? 'COMPUTING...' : 'TRANSMIT'}
        </button>
      </form>
    </section>
  )
}