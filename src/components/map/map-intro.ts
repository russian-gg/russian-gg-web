import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * How long the opening takes, in seconds: until then the coins are still landing. The coins'
 * pulsing ring and «Start» tag wait for it.
 */
export const INTRO_SECONDS = 2.6

const storageKey = (key: string) => `rgg:map-intro:${key}`

function seen(key: string): boolean {
  try {
    return sessionStorage.getItem(storageKey(key)) !== null
  } catch {
    // Storage can be off (private mode); then the curtain simply plays.
    return false
  }
}

/**
 * Whether this map opens with its cloud curtain: once per visit (per browser tab), and never
 * for anyone who asks for less motion. Coming back to the map later in the same visit shows it
 * straight away — the opening is a welcome, not a loading screen to sit through every time.
 *
 * Decided once, when the map first renders, so it does not change under the learner's eyes.
 * The visit is marked only after the map has mounted: a render that is thrown away (React
 * renders twice in development) must not use up the opening.
 */
export function useMapIntro(key: string): boolean {
  const reduced = useReducedMotion()
  const [play] = useState(() => !reduced && !seen(key))
  useEffect(() => {
    if (!play) return
    try {
      sessionStorage.setItem(storageKey(key), '1')
    } catch {
      // Nothing to remember it in; it plays again next time.
    }
  }, [play, key])
  return play
}
