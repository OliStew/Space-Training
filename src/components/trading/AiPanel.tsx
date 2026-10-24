import { useState } from 'react'
import { Button } from '@/components/ui'
import { useGenerate } from '@/hooks/useGenerate'
import { Sparkles, Loader2, Send } from 'lucide-react'

export function AiPanel() {
  const { text, loading, error, generate } = useGenerate()
  const [prompt, setPrompt] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return
    await generate(prompt.trim())
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Ask anything about life in space</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask something..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && prompt.trim() && !loading) {
              handleGenerate()
            }
          }}
        />
        <Button
          size="sm"
          disabled={loading || !prompt.trim()}
          onClick={handleGenerate}
          className="flex items-center gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Ask
            </>
          )}
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {text && (
        <div className="mt-3 rounded-md border border-border bg-muted p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-foreground whitespace-pre-wrap">{text}</p>
          </div>
        </div>
      )}
    </section>
  )
}
