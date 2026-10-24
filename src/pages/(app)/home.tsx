import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div style={{ padding: 16 }}>
      <h1>Life in Space</h1>
      <p><Link to="/trade">Go to the trading page</Link></p>
    </div>
  )
}
