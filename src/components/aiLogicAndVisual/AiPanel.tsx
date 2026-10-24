
import React, { useState } from 'react'
import { useGameTime, useResources } from '@/game'
import { askResourceAI } from '@/services/ai-service'
import type { LowResourceGameReaction, LowResourceGameAction } from '@/interfaces/aiReactions'

export function AIPanel() {
  const resources = useResources()
  const { seconds: gameTime } = useGameTime()

  const [inputText, setInputText] = useState('')
  const [reaction, setReaction] = useState<LowResourceGameReaction | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTransmitToAI = async (e: React.FormEvent) => {
    e.preventDefault() 
    if (!inputText.trim() || isProcessing) return

    setIsProcessing(true)

    try {
      const aiResponse = await askResourceAI(inputText, resources, gameTime)
      setReaction(aiResponse)
    } catch (err) {
      console.error('AI transmission error:', err)
      setReaction({
        text: 'Comms array offline. Check console parameters.',
        vibe: 'WARNING',
        actionChain: [{ stepNumber: 1, action: 'NONE', reasoning: 'Transmission failure.' }]
      })
    } finally {
      setIsProcessing(false)
      setInputText('')
    }
  }

  const handleRunSuggestedStep = (action: LowResourceGameAction) => {
    // UI triggers recommendation execution via your external engine/action handler
    void action
  }
///temporary stuff 
  const getVibeColor = (vibe?: string) => {
    switch (vibe) {
      case 'OPTIMAL': return '#00ffcc'
      case 'STABLE': return '#00ccff'
      case 'WARNING': return '#ffcc00'
      case 'CRITICAL': return '#ff3333'
      default: return '#ffffff'
    }
  }

  return (
    <section style={{ padding: '16px', background: '#111', color: '#fff', borderRadius: '8px' }}>
      <h2>🌌 Colony Tactical AI</h2>

      {/* AI Dialogue Box */}
      <div style={{
        minHeight: 80,
        border: `1px solid ${getVibeColor(reaction?.vibe)}`,
        padding: '12px',
        marginBottom: '12px',
        background: '#000'
      }}>
        {reaction ? (
          <div>
            <span style={{ color: getVibeColor(reaction.vibe), fontWeight: 'bold' }}>
              [{reaction.vibe}]
            </span>
            <p style={{ margin: '8px 0 0 0', fontFamily: 'monospace' }}>
              [{gameTime}s] AI: {reaction.text}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#666' }}>Ship computer idling... enter command below.</p>
        )}
      </div>

      {/* Recommended Action Steps */}
      {reaction && reaction.actionChain.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <h4>Recommended Plan:</h4>
          {reaction.actionChain.map((step) => (
            <div key={step.stepNumber} style={{
              background: '#222',
              padding: '8px',
              marginBottom: '6px',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Step {step.stepNumber}: {step.action}</strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#aaa' }}>{step.reasoning}</p>
              </div>
              {step.action !== 'NONE' && (
                <button
                  onClick={() => handleRunSuggestedStep(step.action)}
                  style={{ background: '#00ffcc', border: 'none', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', color: '#000' }}
                >
                  Execute
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Terminal */}
      <form onSubmit={handleTransmitToAI} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Consult space advisor..."
          disabled={isProcessing}
          style={{ flexGrow: 1, padding: '8px', background: '#222', border: '1px solid #444', color: '#fff' }}
        />
        <button
          type="submit"
          disabled={isProcessing}
          style={{ padding: '8px 16px', background: '#00ffcc', color: '#000', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {isProcessing ? 'COMPUTING...' : 'TRANSMIT'}
        </button>
      </form>
    </section>
  )
}