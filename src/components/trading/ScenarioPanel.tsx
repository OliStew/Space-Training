import { useMemo, useState } from 'react'
import { useGame } from '@/game/GameProvider'
import { fmt } from '@/components/trading/format'
import { Badge, Meter } from '@/FancyComp/parts'
import data from '@/lib/scenarios.json'

type Effects = { food: number; ammunition: number; oxygen: number; base_health_pct: number }
type Option = { key: string; action_id: string; label: string; intent_category: string; trigger_keywords: string[]; effects: Effects }
type Scenario = { id: number; name: string; description: string; options: Option[] }
const scenarios = data.scenarios as Scenario[]

/** Scenario effect name -> game resource key. Adjust if your RESOURCE_KEYS differ. */
const RESOURCE_OF: Record<string, string> = { food: 'biomass', oxygen: 'oxygen', ammunition: 'ammunition' }
const EFFECT_LABEL: Record<string, string> = { food: 'FOOD', oxygen: 'OXYGEN', ammunition: 'AMMO', base_health_pct: 'COLONY HEALTH %' }

function matchOption(text: string, options: Option[]): Option | null {
  const t = text.toLowerCase()
  let best: Option | null = null, bestScore = 0
  for (const o of options) {
    const score = o.trigger_keywords.filter((k) => t.includes(k.toLowerCase())).length
    if (score > bestScore) { best = o; bestScore = score }
  }
  return best
}

export function ScenarioPanel() {
  const { state } = useGame()
  const [id, setId] = useState(scenarios[0].id)
  const [chosen, setChosen] = useState<Option | null>(null)
  const [text, setText] = useState('')
  const [miss, setMiss] = useState(false)
  const sc = useMemo(() => scenarios.find((s) => s.id === id)!, [id])

  const select = (n: number) => { setId(n); setChosen(null); setText(''); setMiss(false) }
  const submit = () => {
    const o = matchOption(text, sc.options)
    setChosen(o); setMiss(!o)
  }

  const rows = chosen
    ? (Object.keys(chosen.effects) as (keyof Effects)[]).filter((k) => chosen.effects[k] !== 0)
    : []
  const health = chosen ? Math.max(0, 100 + chosen.effects.base_health_pct) : 100

  return (
    <>
      <label className="rc-form" style={{ marginBottom: 12 }}>
        <label>SCENARIO
          <select value={id} onChange={(e) => select(Number(e.target.value))}>
            {scenarios.map((s) => <option key={s.id} value={s.id}>{String(s.id).padStart(2, '0')} — {s.name}</option>)}
          </select>
        </label>
      </label>

      <p>{sc.description}</p>

      <div className="rc-tabs" style={{ marginTop: 10 }}>
        {sc.options.map((o) => (
          <button key={o.key} className={chosen?.key === o.key ? '' : 'ghost'} onClick={() => { setChosen(o); setMiss(false) }}>
            {o.key}: {o.label.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="rc-form" style={{ marginBottom: 12 }}>
        <label>OR DESCRIBE YOUR ORDER
          <input value={text} placeholder="e.g. lock the colony down" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
        <button onClick={submit} disabled={!text.trim()}>EXECUTE ▶</button>
      </div>

      {miss && <p className="rc-muted">No matching order. Try one of the options above.</p>}

      {chosen && (
        <>
          <div className="rc-row">
            <span>{chosen.label} <span className="rc-muted">({chosen.intent_category})</span></span>
            <Badge kind={chosen.effects.base_health_pct < -9 ? 'crit' : chosen.effects.base_health_pct < 0 ? 'warn' : 'out'}>
              {rows.length ? 'COSTS INCURRED' : 'NO COST'}
            </Badge>
          </div>
          {rows.filter((k) => k !== 'base_health_pct').map((k) => {
            const rk = RESOURCE_OF[k]
            const cur = state.resources[rk]
            return (
              <div className="rc-row" key={k}>
                <span>{EFFECT_LABEL[k]}</span>
                {cur === undefined ? `${chosen.effects[k]}` : `${fmt(cur, 1)} → ${fmt(Math.max(0, cur + chosen.effects[k]), 1)} (${chosen.effects[k]})`}
              </div>
            )
          })}
          <div className="rc-row" style={{ display: 'block' }}>
            <span>COLONY HEALTH {chosen.effects.base_health_pct ? `(${chosen.effects.base_health_pct}%)` : ''}</span>
            <Meter value={health} max={100} />
          </div>
        </>
      )}
    </>
  )
}
