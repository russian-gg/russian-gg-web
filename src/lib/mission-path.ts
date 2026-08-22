import type { MissionSummary } from './types'

/**
 * The first ten curriculum days use the complete mobile lesson journey. Later days keep
 * using the focused voice player until their extended lesson content is authored.
 */
export function missionPath(mission: Pick<MissionSummary, 'id' | 'slug' | 'courseDay'>) {
  if (mission.courseDay != null && mission.courseDay >= 1 && mission.courseDay <= 10) {
    return `/lessons/${mission.courseDay}/${mission.id}`
  }

  return `/missions/${mission.id}`
}
