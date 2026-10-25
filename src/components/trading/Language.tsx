import { useMemo, useState } from 'react'
import { AlienWords, getAlienDisplay } from '@/lib/Language'
import { Badge } from '@/FancyComp/parts'

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]
const shuffle = <T,>(a: readonly T[]) => [...a].sort(() => Math.random() - 0.5)

function newRound(prev?: string) {
  const word = pick(AlienWords.filter((w) => w !== prev))
  const decoys = shuffle(AlienWords.filter((w) => w !== word)).slice(0, 3)
  return { word, options: shuffle([word, ...decoys]) }
}

export function Language() {
  const [round, setRound] = useState(() => newRound())
  const [answer, setAnswer] = useState<string | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })
  const alien = useMemo(() => getAlienDisplay(round.word), [round.word])
  const correct = answer === round.word

  const choose = (o: string) => {
    if (answer) return
    setAnswer(o)
    setScore((s) => ({ right: s.right + (o === round.word ? 1 : 0), total: s.total + 1, streak: o === round.word ? s.streak + 1 : 0 }))
  }
  const next = () => { setAnswer(null); setRound(newRound(round.word)) }

  return (
    <>
      <div className="rc-row">
        <span className="rc-muted">DECODE THE ALIEN WORD</span>
        <Badge kind="out">{score.right}/{score.total} CORRECT</Badge>
        <Badge kind={score.streak > 2 ? '' : 'out'}>STREAK {score.streak}</Badge>
      </div>

      <div className="rc-tile" style={{ margin: '14px 0', textAlign: 'center', padding: '22px 10px' }}>
        <small>INCOMING TRANSMISSION</small>
        <b style={{ fontSize: 34, letterSpacing: '.12em', textShadow: '0 0 12px var(--glow)' }}>{alien}</b>
      </div>

      <div className="rc-tabs">
        {round.options.map((o) => (
          <button
            key={o}
            className={answer && o !== round.word && o !== answer ? 'ghost' : answer && o === round.word ? '' : 'ghost'}
            disabled={!!answer && o !== answer && o !== round.word}
            onClick={() => choose(o)}
          >{o.toUpperCase()}</button>
        ))}
      </div>

      {answer && (
        <p style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge kind={correct ? '' : 'crit'}>{correct ? 'DECODED' : 'MISMATCH'}</Badge>
          <span>{correct ? 'Signal understood.' : <>It meant <b>{round.word}</b>.</>}</span>
          <button onClick={next}>NEXT WORD ▶</button>
        </p>
      )}
    </>
  )
}

