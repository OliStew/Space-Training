import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useActiveScenario } from '@/context/ActiveScenarioContext'
import { usePlayerTrades, useResources } from '@/game'
import { askResourceAI } from '@/services/ai-service'
import type { LowResourceGameReaction, TradeGameReaction, EventGameReaction } from '@/interfaces/aiReactions'

export function AIPanel() {
const resources = useResources()
  let incomingEvent= undefined;
  let tradeOffer= undefined;
  const { incoming } = usePlayerTrades()
  const { pathname } = useLocation()
  const isMarketPage = pathname === '/trades'
  const isScenarioPage = pathname === '/simulation'
  const { scenario, phase } = useActiveScenario()

  const [inputText, setInputText] = useState('')
  const [reaction, setReaction] = useState<LowResourceGameReaction | TradeGameReaction | EventGameReaction | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleTransmitToAI = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || isProcessing) return

    setIsProcessing(true)

        const incomingTradesText = incoming.map((trade) =>
      `Trade ${trade.id}: From ${trade.fromName} offers ${JSON.stringify(trade.youReceive)} for ${JSON.stringify(trade.youGive)}`
    ).join('\n')
    const tradeOffer = incomingTradesText
      ? `CURRENT INCOMING TRADES:\n${incomingTradesText}`
      : undefined
    
    if (isScenarioPage && phase === 'active' && scenario) {
      incomingEvent = `CURRENT EVENT: ${scenario.name}\n${scenario.description}\nOPTIONS AND THEIR EFFECTS:`;
      scenario.options.forEach((option) => {
        incomingEvent += `\nOption ${option.key}: ${option.label} | Effects: ${JSON.stringify(option.effects)}`;
      });
    } else {
      incomingEvent = undefined;
    }

    try {
      const aiResponse = await askResourceAI(inputText, resources, undefined, tradeOffer, incomingEvent, isMarketPage)
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
      background: 'var(--bg)',
      color: 'var(--main)',
      fontFamily: 'Courier New, Courier, monospace',
      border: '1px solid var(--dim)',
      borderRadius: '4px',
      letterSpacing: '0.5px'
    }}>
      <div style={{
        borderBottom: '1px solid var(--dim)',
        paddingBottom: '12px',
        marginBottom: '20px'
      }}>
        {/*Colony Runtime Administrator*/}
        <span>SYSTEM: CORA AI</span>
      </div>

      <div style={{
        minHeight: '100px',
        border: '1px solid var(--dim)',
        padding: '16px',
        marginBottom: '24px',
        background: 'var(--card)',
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
          <div style={{ color: 'var(--dim)' }}>
            Ship computer idling... enter command below.
          </div>
        )}
      </div>

      {reaction && reaction.actionChain.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px', color: 'var(--hi)' }}>
            RECOMMENDED PLAN:
          </div>
          {reaction.actionChain.map((step) => (
            <div key={step.stepNumber} style={{
              background: 'var(--card)',
              border: '1px solid var(--dim)',
              padding: '14px 16px',
              marginBottom: '10px'
            }}>
              <div>Step {step.stepNumber}: {step.action}</div>
              <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '6px' }}>
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
            background: 'var(--bg)',
            border: '1px solid var(--dim)',
            color: 'var(--main)',
            fontFamily: 'inherit',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          disabled={isProcessing}
          style={{
            padding: '12px 24px',
            background: 'var(--main)',
            color: 'var(--bg)',
            border: '1px solid var(--main)',
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