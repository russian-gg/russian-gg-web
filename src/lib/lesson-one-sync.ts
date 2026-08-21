import { api } from './api'
import type { StartAttemptResponse } from './types'

const inFlight = new Map<string, Promise<void>>()

/**
 * Extended lessons store section progress in the browser, while the 90-day path is
 * server-authoritative. Completing the final section therefore closes the path mission too.
 */
export function syncLessonOneCompletion(missionId: string): Promise<void> {
  const running = inFlight.get(missionId)
  if (running) return running

  const request = (async () => {
    let attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts`)
    if (attempt.requiresExplicitRestart) {
      attempt = await api.post<StartAttemptResponse>(`/missions/${missionId}/attempts?restart=true`)
    }

    await api.post<unknown>(`/missions/attempts/${attempt.attemptId}/complete`)
  })().finally(() => {
    inFlight.delete(missionId)
  })

  inFlight.set(missionId, request)
  return request
}
