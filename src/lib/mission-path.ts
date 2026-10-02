import { hasFoundationLesson } from './foundation-days'
import type { MissionSummary } from './types'

/**
 * The curriculum days with an authored lesson use the complete mobile lesson journey. The
 * other days keep using the focused voice player until their extended lesson content is
 * authored.
 *
 * A converted mission is the exception: it is one live conversation with a character and opens
 * on its own brief screen, whatever day it belongs to. The lessons are untouched — a day whose
 * mission has not been converted still opens exactly as it did.
 */
export function missionPath(
  mission: Pick<MissionSummary, 'id' | 'slug' | 'courseDay'> & { isDialogue?: boolean },
) {
  if (mission.isDialogue) {
    return `/missions/${mission.id}`
  }

  if (hasFoundationLesson(mission.courseDay)) {
    return `/lessons/${mission.courseDay}/${mission.id}`
  }

  return `/missions/${mission.id}`
}
