# Server Actions

Server actions are exposed at `POST /api/actions/:name`. They run on the server side with access to the app's environment bindings (database, AI proxy, integrations).

## Authentication

All actions require the caller to be signed in. Two conditions must be met:

1. **Valid session** — The request must carry a valid DeepSpace session (cookie or token).
2. **Bearer JWT token** — The `Authorization` header must include a Bearer token: `Authorization: Bearer <jwt>`.

Cookie-only sessions are not sufficient — the JWT token must be sent explicitly. Anonymous users will receive a `401 Unauthorized` response.

To obtain the token client-side:

```ts1240
import { authClient } from 'deepspace'

const session = await authClient.getSession()
const token = session?.data?.session?.token
```

## Calling Actions Client-Side

```ts
const res = await fetch('/api/actions/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ prompt: 'Explain supply and demand' }),
})

const result = await res.json()
// { success: true, data: { text: "..." } }
// { success: false, error: "..." }
```

---

## Available Actions

### `generate`

Generate a text response from an AI language model using DeepSpace's platform-managed AI proxy. No API key is needed — authentication is handled by the platform.

**Endpoint:** `POST /api/actions/generate`

**Input:**

| Field    | Type     | Required | Description                                      |
|----------|----------|----------|--------------------------------------------------|
| `prompt` | `string` | Yes      | The text prompt to send to the model.            |
| `model`  | `string` | No       | Optional model ID override (defaults to `claude-haiku-5-5`). |

**Output:**

| Field    | Type     | Description                        |
|----------|----------|------------------------------------|
| `text`   | `string` | The generated text response.       |

**Example request:**

```json
{
  "prompt": "Explain how supply and demand determine price."
}
```

**Example response:**

```json
{
  "success": true,
  "data": {
    "text": "Supply and demand interact to determine market price..."
  }
}
```

**Default model:** `claude-haiku-5-5` (Anthropic — fast, low-cost).

**Error responses:**

| Status | Condition                |
|--------|--------------------------|
| 401    | Not authenticated or missing Bearer token. |
| 404    | Action not found.        |
| 400    | Missing or invalid `prompt` parameter.     |

---

### `marketBuy`

Queue a buy order for a resource in a market. Orders accumulate server-side and are processed in batches every `batchInterval` seconds (default 30s). When processed, prices first rise by `interest`%, then increase by `effect`% per buy order.

**Endpoint:** `POST /api/actions/marketBuy`

**Input:**

| Field      | Type     | Required | Description                          |
|------------|----------|----------|--------------------------------------|
| `market`   | `string` | Yes      | The market name (e.g., `"food"`).    |
| `resource` | `string` | Yes      | The resource name (e.g., `"bread"`). |

**Output:**

| Field     | Type    | Description                        |
|-----------|---------|------------------------------------|
| `queued`  | `bool`  | Always `true` on success.          |
| `pending` | `number`| Number of orders waiting in queue. |

**Example request:**

```json
{
  "market": "food",
  "resource": "bread"
}
```

---

### `marketSell`

Queue a sell order for a resource in a market. When processed, prices first rise by `interest`%, then decrease by `impact`% per sell order.

**Endpoint:** `POST /api/actions/marketSell`

**Input:**

| Field      | Type     | Required | Description                          |
|------------|----------|----------|--------------------------------------|
| `market`   | `string` | Yes      | The market name.                     |
| `resource` | `string` | Yes      | The resource name.                   |

**Output:** Same as `marketBuy`.

---

### `marketList`

Retrieve the current list of all markets and their prices.

**Endpoint:** `POST /api/actions/marketList`

**Input:** None.

**Output:**

| Field     | Type            | Description                          |
|-----------|-----------------|--------------------------------------|
| `markets` | `MarketEntry[]` | Array of markets with their prices.  |

Each `MarketEntry` has:
- `name` (string): Market name.
- `prices` (object): Resource name → current price mapping.

**Example response:**

```json
{
  "success": true,
  "data": {
    "markets": [
      {
        "name": "food",
        "prices": { "bread": 2.5, "milk": 3.0 }
      }
    ]
  }
}
```

---

### `marketCreate`

Create or update a market with initial resource prices.

**Endpoint:** `POST /api/actions/marketCreate`

**Input:**

| Field    | Type       | Required | Description                                  |
|----------|------------|----------|----------------------------------------------|
| `name`   | `string`   | Yes      | The market name.                             |
| `prices` | `object`   | Yes      | Resource name → initial price mapping.       |

**Output:**

| Field    | Type         | Description              |
|----------|--------------|--------------------------|
| `market` | `MarketEntry`| The created market entry.|

**Example request:**

```json
{
  "name": "food",
  "prices": { "bread": 2.0, "milk": 3.0 }
}
```

---

### `marketConfig`

Read or update the market processing configuration.

**Endpoint:** `POST /api/actions/marketConfig`

**Input (all optional):**

| Field           | Type     | Required | Description                                       |
|-----------------|----------|----------|---------------------------------------------------|
| `batchInterval` | `number` | No       | Seconds between batch processing (default 30).    |
| `interest`      | `number` | No       | % to increment all prices each cycle (default 0). |
| `effect`        | `number` | No       | % to increase price per buy (default 1).          |
| `impact`        | `number` | No       | % to decrease price per sell (default 1).         |

If no fields are provided, returns the current config. If any field is provided, updates and returns the new config.

**Output:**

| Field    | Type           | Description             |
|----------|----------------|-------------------------|
| `config` | `MarketsConfig`| The (updated) config.   |

**Example request (update):**

```json
{
  "batchInterval": 60,
  "interest": 0.5,
  "effect": 2,
  "impact": 1.5
}
```

---

## Market Processing Details

The Markets Durable Object (`AppMarketsRoom`) processes queued orders on a timer:

1. **Interest phase** — All prices in all markets are multiplied by `(1 + interest/100)`.
2. **Buy phase** — Each resource price is multiplied by `(1 + effect/100) ^ buyCount`.
3. **Sell phase** — Each resource price is multiplied by `(1 - impact/100) ^ sellCount`.

Orders are cleared after each batch cycle. The alarm re-arms automatically for the next cycle.

---

## Client-Side Market Usage

### Buying and Selling from a React Component

```tsx
import { useState } from 'react'
import { authClient } from 'deepspace'

async function callAction(name: string, params: Record<string, unknown>) {
  const session = await authClient.getSession()
  if (!session?.data?.session) {
    throw new Error('Not authenticated')
  }
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.data.session.token}`,
    },
    body: JSON.stringify(params),
  })
  return res.json()
}

export default function MarketTrader() {
  const [loading, setLoading] = useState(false)

  async function handleBuy() {
    setLoading(true)
    try {
      const result = await callAction('marketBuy', {
        market: 'food',
        resource: 'bread',
      })
      if (result.success) {
        alert(`Order queued! ${result.data.pending} pending orders.`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSell() {
    setLoading(true)
    try {
      const result = await callAction('marketSell', {
        market: 'food',
        resource: 'bread',
      })
      if (result.success) {
        alert(`Order queued! ${result.data.pending} pending orders.`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3>Food Market — Bread</h3>
      <button onClick={handleBuy} disabled={loading}>Buy</button>
      <button onClick={handleSell} disabled={loading}>Sell</button>
    </div>
  )
}
```

### Reading Current Prices

```tsx
async function fetchMarkets() {
  const result = await callAction('marketList', {})
  if (result.success) {
    // result.data.markets is an array of { name, prices }
    console.log(result.data.markets)
  }
}
```

---

## Initializing Markets on Startup

Markets do not exist until created. On your app's first run, call `marketCreate` to seed initial markets with starting prices.

### One-Time Setup via Action

Call `marketCreate` once per market to define its resources and starting prices:

```json
{
  "name": "food",
  "prices": { "bread": 2.0, "milk": 3.0, "eggs": 1.5 }
}
```

```json
{
  "name": "materials",
  "prices": { "wood": 5.0, "stone": 4.0, "iron": 8.0 }
}
```

### Automated Startup Initialization

To automatically seed markets when the app starts, add an initialization function in your client code:

```ts
// src/lib/init-markets.ts
import { authClient } from 'deepspace'

const DEFAULT_MARKETS = [
  { name: 'food', prices: { bread: 2.0, milk: 3.0, eggs: 1.5 } },
  { name: 'materials', prices: { wood: 5.0, stone: 4.0, iron: 8.0 } },
]

async function callAction(name: string, params: Record<string, unknown>) {
  const session = await authClient.getSession()
  if (!session?.data?.session) {
    throw new Error('Not authenticated')
  }
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.data.session.token}`,
    },
    body: JSON.stringify(params),
  })
  return res.json()
}

export async function initMarkets() {
  // Check existing markets first
  const listResult = await callAction('marketList', {})
  if (!listResult.success) return

  const existingNames = new Set(
    (listResult.data.markets ?? []).map((m: { name: string }) => m.name)
  )

  // Create any missing markets
  for (const market of DEFAULT_MARKETS) {
    if (!existingNames.has(market.name)) {
      await callAction('marketCreate', {
        name: market.name,
        prices: market.prices,
      })
    }
  }
}
```

Then call `initMarkets()` from your app's layout or a `useEffect` hook:

```tsx
// src/pages/(app)/_layout.tsx
import { useEffect, useState } from 'react'
import { initMarkets } from '@/lib/init-markets'

export default function AppLayout({ children }) {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    initMarkets().then(() => setInitialized(true))
  }, [])

  if (!initialized) return <div>Loading markets...</div>
  return <>{children}</>
}
```

### Configuring Processing Parameters

Optionally, set custom processing parameters after initialization:

```json
{
  "batchInterval": 60,
  "interest": 0.5,
  "effect": 2,
  "impact": 1.5
}
```

Call this via `marketConfig` to adjust how frequently orders are processed and how much each order affects prices.

---

## Adding New Actions

Actions are registered in `src/actions/index.ts`. Each action is an async function that receives `{ userId, params, tools, env, callerJwt }` and returns an `ActionResult`:

```ts
export const actions: Record<string, ActionHandler<Env>> = {
  myAction: async ({ params, tools, env }): Promise<ActionResult> => {
    // ... logic
    return { success: true, data: { /* ... */ } }
  },
}
```

The `tools` object provides database operations (`create`, `update`, `query`, `remove`, `deleteWhere`, `get`) and integration access. Note that actions run with per-record RBAC disabled — always check ownership manually before writing other users' data.
