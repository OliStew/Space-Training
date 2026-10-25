import { Link } from 'react-router-dom'
import { Badge, TerminalFrame } from '@/FancyComp/parts'
import { Seo } from '@/components/Seo'
import { seo } from '@/seo'

const BOOT = [
  'Initializing terminal bios memory map... [ OK ]',
  'Connecting to local station subsystem cores... [ OK ]',
  'CORA AI background assistant initialized... [ READY ]',
  'Live trade markets and player network synchronization... [ ACTIVE ]',
]

export default function LandingPage() {
  return (
    <>
      <Seo {...seo} path="/" />
      <TerminalFrame>
      <div className="rc-center">
        <div className="rc-win">
          <div className="rc-titlebar">
            <div className="t"><small>goopcorp.exe_</small><b>GOOPCORP OS INITIALIZATION</b></div>
            <span style={{ marginRight: 12 }}><Badge kind="out">v2.0.99</Badge></span>
          </div>
          <div style={{ padding: 24 }}>
            <h1>WELCOME TO GOOPCORP INDUSTRIES UNIFIED OS</h1>
            <p className="rc-muted">AUTHORIZED PERSONNEL ONLY</p>
            <div className="rc-panel" style={{ margin: '18px 0' }}>
              {BOOT.map((l) => <p key={l}>✦ {l}</p>)}
            </div>
            <Link to="/trade" style={{ textDecoration: 'none' }}><button>INITIALIZE DASHBOARD ▶</button></Link>
          </div>
        </div>
      </div>
    </TerminalFrame>
    </>
  )
}
