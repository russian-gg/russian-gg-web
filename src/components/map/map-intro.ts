import { useState } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * How long the opening takes, in seconds: until then the coins are still landing. The coins'
 * pulsing ring and «Start» tag wait for it.
 */
export const INTRO_SECONDS = 2.6

/**
 * Whether this map opens with its cloud curtain: every time it is opened, and never for anyone
 * who asks for less motion. Decided once, when the map first renders, so it does not change
 * under the learner's eyes.
 */
export function useMapIntro(): boolean {
  const reduced = useReducedMotion()
  const [play] = useState(() => !reduced)
  return play
}
