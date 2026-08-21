import { api } from './api'
import type { StartAttemptResponse } from './types'

const inFlight = new Map<string, Promise<void>>()

/**
 * The extended first lesson stores its section progress in the browser, while the 90-day
 * path is server-authoritative. Completing the final section must therefore close the path
 * mission as well, otherwise day two remains locked despite the visible completion tick.
 */
export function syncLessonOneCompletion(missionId: string): Promise<void> {
  const running = inFlight.get(missionId)
  if (running) return running

  const request = (async () => {
    const attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
    if (attempt.requiresExplicitRestart) return

    await api.post<unknown>(`/missions/attempts/${attempt.attemptId}/complete`)
  })().finally(() => {
    inFlight.delete(missionId)
  })

  inFlight.set(missionId, request)
  return request
}
