import type { Dictionary } from './i18n'
import type { MissionCharacter } from './types'

/**
 * Each character's own colours, sampled from their artwork in `public/characters`.
 *
 * The penguin is the exception: its saturated pixels are the orange beak and feet, and its
 * body is a near-black navy that would read as "switched off" on a glowing sphere. Its hue is
 * kept and brightened to the product's own blue.
 */
const PALETTES: Record<MissionCharacter, { light: string; deep: string }> = {
  Penguin: { light: '#5B9BF5', deep: '#2D76DD' },
  Panda: { light: '#F86FBA', deep: '#BF356E' },
  Pero: { light: '#FABC06', deep: '#C96E01' },
  None: { light: '#5B9BF5', deep: '#2D76DD' },
}

export function characterPalette(character: MissionCharacter) {
  return PALETTES[character] ?? PALETTES.None
}

export function characterColors(character: MissionCharacter): [string, string] {
  const palette = characterPalette(character)
  return [palette.light, palette.deep]
}

export function characterName(character: MissionCharacter, t: Dictionary) {
  return t.missionLive.characters[character] ?? t.missionLive.characters.None
}
