import { useState } from 'react'
import { useGenerate } from '@/hooks/useGenerate'
import { useAdvice } from '@/hooks/useAdvice'
import { Sparkles, Loader2, Send, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui'

/**
 * AI Panel — two modes:
 * 1. "Get Advice" button: automatically gathers game state and asks the AI for trading advice.
 * 2. Manual prompt: type a custom question and hit Ask.
 */
export function AIPanel() {
  const { text: manualText, loading: manualLoading, error: manualError, generate } = useGenerate()
  const { advice, loading: adviceLoading, error: adviceError, getAdvice } = useAdvice()

  const [prompt, setPrompt] = useState('')

  const isAdviceMode = advice !== null && adviceError === null
  const text = isAdviceMode ? advice : manualText
  const loading = adviceLoading || manualLoading
  const error = adviceError ?? manualError

  const handleAsk = async () => {
    if (!prompt.trim() || loading) return
    await generate(prompt.trim())
  }

  const handleAdvice = async () => {
    if (loading) return
    await getAdvice()
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Get trading advice or ask a question</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdvice}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs"
        >
          {adviceLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
            </>
          ) : (
            <>
              <Lightbulb className="h-3.5 w-3.5" /> Get Advice
            </>
          )}
        </Button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Or ask something..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim() && !loading) {
              handleAsk()
            }
          }}
        />
        <Button
          size="sm"
          disabled={loading || !prompt.trim()}
          onClick={handleAsk}
          className="flex items-center gap-1.5"
        >
          {manualLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {text && (
        <div className="mt-3 rounded-md border border-border bg-muted p-3">
          <div className="flex items-start gap-2">
            {isAdviceMode ? (
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <p className="text-xs text-foreground whitespace-pre-wrap">{text}</p>
          </div>
        </div>
      )}
    </section>
  )
}