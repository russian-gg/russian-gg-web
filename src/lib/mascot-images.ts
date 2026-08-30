import type { Mascot } from './foundation-lessons'

/**
 * The landing page and the lessons show the same three characters, so both read their artwork
 * from here. The penguin's file is named the Uzbek way (`pingvin`), which is why this is an
 * explicit map rather than interpolating the mascot key into the path.
 */
const MASCOT_IMAGES: Record<Mascot, string> = {
  penguin: '/characters/pingvin.png',
  panda: '/characters/panda.png',
  pero: '/characters/pero.png',
}

const MASCOT_ALT: Record<Mascot, string> = {
  penguin: 'Pingvin ustoz',
  panda: 'Panda murabbiy',
  pero: 'Pero yordamchi',
}

export function mascotImage(mascot: Mascot): string {
  return MASCOT_IMAGES[mascot]
}

export function mascotAlt(mascot: Mascot): string {
  return MASCOT_ALT[mascot]
}
