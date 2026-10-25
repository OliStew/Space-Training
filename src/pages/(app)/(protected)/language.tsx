import { Link } from 'react-router-dom'
import { Language } from '@/components/trading/Language'
import { Panel } from '@/FancyComp/parts'

export default function LanguagePage() {
  return (
    <Panel title="ALIEN LANGUAGE GAME" right={<Link to="/trade">◀ DASHBOARD</Link>}>
      <Language />
    </Panel>
  )
}