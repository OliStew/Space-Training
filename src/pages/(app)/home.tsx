import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-20 text-center">
      <h1 className="mb-3 text-3xl font-bold text-foreground">Life in Space</h1>
      <p className="mb-6 text-muted-foreground">
        Keep your oxygen and biomass up, and trade metal, ammo and buildings with the markets — or with other players.
      </p>
      <Link to="/trade"><Button>Open the trading floor</Button></Link>
    </div>
  )
}
