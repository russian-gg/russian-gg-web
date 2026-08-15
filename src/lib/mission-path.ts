import type { MissionSummary } from './types'

/**
 * Day one is a complete lesson journey on the demo-stage release. Every other mission keeps
 * using the focused voice player, and the day-one journey hands off to that player for its
 * AI conversation section.
 */
export function missionPath(mission: Pick<MissionSummary, 'id' | 'slug' | 'courseDay'>) {
  if (mission.slug === 'work-introduce-yourself' && mission.courseDay === 1) {
    return `/lessons/1/${mission.id}`
  }

  return `/missions/${mission.id}`
}
