/** What a map coin stands for (see `Coin.tsx`). */
export type CoinTone = 'done' | 'current' | 'open' | 'pro' | 'locked'
export type CoinBadge = 'done' | 'pro' | 'locked' | 'tried' | null

/** Height from the coin's top to the anchor point it stands on. */
export function coinHeight(size: number, tone: CoinTone) {
  const d = Math.round(size * (tone === 'current' ? 1.22 : 1.05))
  return d + Math.max(4, Math.round(d * 0.1)) - Math.round(size * 0.2)
}
