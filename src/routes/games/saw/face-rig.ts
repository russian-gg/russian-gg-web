import type { SawCharacter } from './model'

// Where the eyes, brows and mouth sit in each 768px portrait, plus the eyelid colour.
export type SawFacePatch = readonly [left: number, top: number, width: number, height: number]
type Face = { eyes: readonly SawFacePatch[]; brows: readonly SawFacePatch[]; mouth: SawFacePatch; lid: string }
export type SawPose = 'idle' | 'confident' | 'danger'

export const sawFaces: Record<SawCharacter, Record<SawPose, Face>> = {
  penguin: {
    idle: {
      eyes: [[337, 154, 53, 49], [426, 171, 66, 50]],
      brows: [[330, 109, 48, 24], [454, 141, 48, 25]],
      mouth: [345, 198, 115, 59],
      lid: '#8a8174',
    },
    confident: {
      eyes: [[328, 130, 57, 48], [410, 146, 71, 51]],
      brows: [[322, 90, 48, 26], [453, 120, 57, 25]],
      mouth: [336, 168, 111, 61],
      lid: '#84766a',
    },
    danger: {
      eyes: [[364, 152, 53, 53], [454, 174, 68, 56]],
      brows: [[345, 113, 59, 26], [491, 150, 58, 24]],
      mouth: [387, 200, 94, 107],
      lid: '#7e756d',
    },
  },
  panda: {
    idle: {
      eyes: [[241, 190, 72, 77], [364, 211, 78, 81]],
      brows: [[280, 137, 47, 29], [389, 150, 47, 38]],
      mouth: [307, 292, 37, 26],
      lid: '#302725',
    },
    confident: {
      eyes: [],
      brows: [[291, 136, 55, 30], [417, 154, 52, 41]],
      mouth: [313, 278, 74, 51],
      lid: '#302725',
    },
    danger: {
      eyes: [[248, 186, 72, 69], [369, 209, 83, 74]],
      brows: [[284, 148, 61, 26], [376, 153, 64, 36]],
      mouth: [308, 281, 46, 31],
      lid: '#302725',
    },
  },
  pero: {
    idle: {
      eyes: [[315, 270, 37, 29], [368, 286, 48, 27]],
      brows: [[315, 239, 44, 27], [375, 247, 48, 30]],
      mouth: [332, 306, 46, 34],
      lid: '#cf8522',
    },
    confident: {
      eyes: [[310, 248, 38, 38], [359, 273, 49, 31]],
      brows: [[312, 221, 43, 28], [375, 238, 50, 27]],
      mouth: [324, 298, 48, 28],
      lid: '#cb811a',
    },
    danger: {
      eyes: [[313, 256, 49, 50], [376, 270, 48, 47]],
      brows: [[314, 224, 50, 34], [381, 247, 51, 29]],
      mouth: [339, 310, 43, 38],
      lid: '#d29331',
    },
  },
}

export const sawSpriteSize = 768
