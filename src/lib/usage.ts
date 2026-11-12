import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { TurnFeedback, UsageAllowance } from './types'

/** Error codes the server uses for each daily limit (UsageLimitCodes on the server). */
export const LIMIT_CODES = {
  lessonDailyLimit: 'lesson_daily_limit',
  liveTrialsUsed: 'live_trials_used',
  aiBudgetReached: 'ai_budget_reached',
  gameDailyLimit: 'game_daily_limit',
} as const

const USAGE_KEY = ['usage-today'] as const

/** Today's allowance. Refetched on focus so a new day shows without a reload. */
export function useUsageToday(enabled = true) {
  return useQuery({
    queryKey: USAGE_KEY,
    queryFn: () => api.get<UsageAllowance>('/usage/today'),
    enabled,
    staleTime: 30_000,
  })
}

export function invalidateUsage(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: USAGE_KEY })
}

/** Whole hours and minutes until a moment, never negative. */
export function timeUntil(iso: string | null | undefined, now = Date.now()) {
  const left = iso ? Math.max(0, new Date(iso).getTime() - now) : 0
  const totalMinutes = Math.ceil(left / 60_000)
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
}

/** "HH:MM" in the learner's own clock. */
export function clockTime(iso: string | null | undefined) {
  if (!iso) return '00:00'
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** An answer that came back without a grade because the day's scoring is used up. */
export function isScoringPaused(feedback: Pick<TurnFeedback, 'scored' | 'review' | 'scoringResumesAt'> | null | undefined) {
  return Boolean(feedback && feedback.scored === false && !feedback.review && feedback.scoringResumesAt)
}

/**
 * How the trials on the card split: the day's own that are left, the one carried from
 * yesterday, streak trials, and the day's own already used.
 */
export function trialChips(usage: UsageAllowance) {
  const carried = Math.min(usage.liveTrialsCarried, usage.liveTrialsLeft)
  const bonus = Math.min(usage.liveTrialsBonus, Math.max(0, usage.liveTrialsLeft - carried))
  const today = Math.max(0, usage.liveTrialsLeft - carried - bonus)
  const used = Math.max(0, usage.liveTrialsPerDay - today)
  return { today, carried, bonus, used }
}
