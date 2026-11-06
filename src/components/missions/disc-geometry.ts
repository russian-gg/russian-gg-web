/** What a mission disc stands for (see `MissionDisc.tsx`). */
export type DiscTone = 'done' | 'current' | 'open' | 'locked'

/** The disc lies flat in the clearing, seen from above at the picture's angle. */
export const discFace = (size: number) => Math.round(size * 0.56)
export const discThickness = (size: number) => Math.max(6, Math.round(size * 0.13))
