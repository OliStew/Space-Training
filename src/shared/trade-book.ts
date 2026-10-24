/**
 * Pure player-to-player trade logic. The Trades Durable Object just loads a
 * `TradeBookState`, calls one of these functions, and saves the result.
 *
 * Balances live on the clients, so the book is only an arbiter of *state*:
 * it guarantees a trade is accepted at most once, only before it expires, and
 * only by its recipient. Each client checks affordability and moves its own
 * resources (see src/game/engine.ts).
 */

import { TRADE_TTL_MS, isTradable } from './types'
import type { Delta, Trade, TradeRequestInput } from './types'
import { round2 } from './pricing'

export interface Player {
  name: string
  email?: string
  seenAt: number
}

export interface TradeBookState {
  trades: Record<string, Trade>
  players: Record<string, Player>
}

export interface BookFail {
  ok: false
  error: string
}
export type BookResult<T = undefined> = { ok: true; value: T } | BookFail

/** Type guard — the app compiles with strict off, where `!r.ok` does not narrow. */
export const isFail = (r: { ok: boolean }): r is BookFail => r.ok === false

const ok = <T>(value?: T): BookResult<T> => ({ ok: true, value: value as T })
const fail = (error: string): BookFail => ({ ok: false, error })

/** Resolved trades are kept this long (for un-acked parties) before pruning. */
const RETENTION_MS = 60 * 60 * 1000
const MAX_QUANTITY = 1_000_000
const MAX_UNIT_PRICE = 1_000_000_000

export function emptyBook(): TradeBookState {
  return { trades: {}, players: {} }
}

// ---- Settlement math (shared with the client) ---------------------------------

/** What `role` hands over and receives if the trade completes. */
export function tradeLegs(
  trade: Pick<Trade, 'side' | 'resource' | 'quantity' | 'total'>,
  role: 'requester' | 'recipient',
): { give: Delta; receive: Delta } {
  const goods: Delta = { [trade.resource]: trade.quantity }
  const money: Delta = { money: trade.total }
  // The requester gives goods if selling, money if buying; the recipient is the mirror.
  const requesterGivesGoods = trade.side === 'sell'
  const givesGoods = role === 'requester' ? requesterGivesGoods : !requesterGivesGoods
  return givesGoods ? { give: goods, receive: money } : { give: money, receive: goods }
}

// ---- Players ----------------------------------------------------------------

export function registerPlayer(state: TradeBookState, userId: string, name: string, email: string | undefined, now: number) {
  const cleanName = name.trim().slice(0, 64)
  if (!cleanName) return
  state.players[userId] = { name: cleanName, email: email?.trim().slice(0, 128) || undefined, seenAt: now }
}

/** Find a player by display name or email (case-insensitive). */
export function findPlayer(state: TradeBookState, query: string, excludeId: string): BookResult<{ id: string; name: string }> {
  const q = query.trim().toLowerCase()
  if (!q) return fail('Enter the name of the player to trade with')
  const matches = Object.entries(state.players).filter(
    ([id, p]) => id !== excludeId && (p.name.toLowerCase() === q || p.email?.toLowerCase() === q),
  )
  if (matches.length === 0) return fail(`No player named "${query.trim()}" (they must have opened the app at least once)`)
  if (matches.length > 1) return fail(`More than one player is named "${query.trim()}" — use their email instead`)
  const [id, p] = matches[0]
  return ok({ id, name: p.name })
}

// ---- Trades -----------------------------------------------------------------

/** Mark overdue pending trades expired and drop old finished ones. */
export function sweep(state: TradeBookState, now: number): void {
  for (const trade of Object.values(state.trades)) {
    if (trade.status === 'pending' && now > trade.expiresAt) {
      trade.status = 'expired'
      trade.resolvedAt = trade.expiresAt
    }
    if (trade.status !== 'pending') {
      const settled = trade.ackedBy.includes(trade.from) && (trade.status !== 'accepted' || trade.ackedBy.includes(trade.to))
      if (settled || now - (trade.resolvedAt ?? trade.createdAt) > RETENTION_MS) delete state.trades[trade.id]
    }
  }
}

export function validateRequest(input: TradeRequestInput): string | null {
  if (typeof input.to !== 'string') return 'Enter the name of the player to trade with'
  if (input.side !== 'buy' && input.side !== 'sell') return 'Side must be "buy" or "sell"'
  if (!isTradable(input.resource)) return 'Unknown resource'
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAX_QUANTITY) {
    return `Quantity must be a whole number from 1 to ${MAX_QUANTITY}`
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0 || input.unitPrice > MAX_UNIT_PRICE) {
    return 'Price must be zero or more'
  }
  return null
}

export function createTrade(
  state: TradeBookState,
  userId: string,
  input: TradeRequestInput,
  id: string,
  now: number,
): BookResult<Trade> {
  sweep(state, now)
  // Clients choose the id so they can reserve funds before the server answers.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) return fail('Invalid trade id')
  if (state.trades[id]) return fail('Duplicate trade id')
  const invalid = validateRequest(input)
  if (invalid) return fail(invalid)
  const sender = state.players[userId]
  if (!sender) return fail('Your player profile is not registered yet — try again in a moment')
  const target = findPlayer(state, input.to, userId)
  if (isFail(target)) return target
  const trade: Trade = {
    id,
    from: userId,
    fromName: sender.name,
    to: target.value.id,
    toName: target.value.name,
    side: input.side,
    resource: input.resource,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    total: round2(input.quantity * input.unitPrice),
    createdAt: now,
    expiresAt: now + TRADE_TTL_MS,
    status: 'pending',
    ackedBy: [],
  }
  state.trades[id] = trade
  return ok(trade)
}

function getPending(state: TradeBookState, id: string, now: number): BookResult<Trade> {
  sweep(state, now)
  const trade = state.trades[id]
  if (!trade) return fail('Trade not found')
  if (trade.status === 'expired') return fail('This trade request expired')
  if (trade.status !== 'pending') return fail(`This trade was already ${trade.status}`)
  return ok(trade)
}

function resolve(trade: Trade, status: Trade['status'], now: number) {
  trade.status = status
  trade.resolvedAt = now
}

/** Recipient accepts. Succeeds at most once, and only inside the window. */
export function acceptTrade(state: TradeBookState, userId: string, id: string, now: number): BookResult<Trade> {
  const found = getPending(state, id, now)
  if (isFail(found)) return found
  if (found.value.to !== userId) return fail('This trade was not offered to you')
  resolve(found.value, 'accepted', now)
  return ok(found.value)
}

export function declineTrade(state: TradeBookState, userId: string, id: string, now: number): BookResult<Trade> {
  const found = getPending(state, id, now)
  if (isFail(found)) return found
  if (found.value.to !== userId) return fail('This trade was not offered to you')
  resolve(found.value, 'declined', now)
  return ok(found.value)
}

export function cancelTrade(state: TradeBookState, userId: string, id: string, now: number): BookResult<Trade> {
  const found = getPending(state, id, now)
  if (isFail(found)) return found
  if (found.value.from !== userId) return fail('Only the requester can cancel a trade')
  resolve(found.value, 'cancelled', now)
  return ok(found.value)
}

/** The party reports it has applied the final outcome locally. */
export function ackTrade(state: TradeBookState, userId: string, id: string, now: number): void {
  const trade = state.trades[id]
  if (trade && trade.status !== 'pending' && (trade.from === userId || trade.to === userId) && !trade.ackedBy.includes(userId)) {
    trade.ackedBy.push(userId)
  }
  sweep(state, now)
}

/**
 * Trades the user still needs to see: anything pending, plus finished trades
 * they have not acked. The requester settles every outcome (escrow release or
 * payout); the recipient only needs to hear about accepted trades.
 */
export function tradesFor(state: TradeBookState, userId: string, now: number): Trade[] {
  sweep(state, now)
  return Object.values(state.trades)
    .filter((t) => {
      if (t.from !== userId && t.to !== userId) return false
      if (t.status === 'pending') return true
      if (t.ackedBy.includes(userId)) return false
      return t.from === userId || t.status === 'accepted'
    })
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** Names of known players (no emails), for autocomplete. */
export function playerNames(state: TradeBookState, excludeId: string): string[] {
  return [...new Set(Object.entries(state.players).filter(([id]) => id !== excludeId).map(([, p]) => p.name))].sort()
}
