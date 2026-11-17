import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth-context'
import type { EntitlementView } from './types'

/*
  A language center can buy the course without AI ("Sinf"). Its students get the same course
  with a different exercise wherever the other plan has an AI one: the lesson's speaking step
  becomes the dialogue workshop, a live conversation becomes a story with written turns, and
  the game shelf holds the games with one right answer.

  The server decides this and enforces it — every AI route refuses such a learner with
  `ai_not_in_plan` — so this module only tells a screen which of its two versions to draw.
*/

export interface AiAccess {
  /** False only once the server has said so. An individual learner is never false. */
  aiAccess: boolean
  /**
   * The entitlement has arrived. A screen with two versions waits for this before drawing
   * either: showing the AI one first and swapping it would open a microphone prompt, or a
   * live session, that this learner is not meant to see.
   */
  known: boolean
}

export function useAiAccess(): AiAccess {
  const { user } = useAuth()
  const { data: entitlement, isError } = useQuery({
    queryKey: ['entitlement'],
    queryFn: () => api.get<EntitlementView>('/billing/entitlement'),
    staleTime: 60_000,
    retry: false,
    enabled: Boolean(user),
  })

  return {
    aiAccess: entitlement?.aiAccess !== false,
    // A failed read falls back to the ordinary version; the server still holds the line.
    known: Boolean(entitlement) || isError || !user,
  }
}

/** The error code every AI route answers with for a learner whose plan has no AI. */
export const AI_NOT_IN_PLAN = 'ai_not_in_plan'
