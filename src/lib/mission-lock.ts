import type { Dictionary } from './i18n'
import type { MissionSummary } from './types'

export type MissionLock = 'pro' | 'progress'

/**
 * What opens a locked mission, or null when it is open.
 *
 * The server says so in `lockKind`. A server from before that field only sent the sentence,
 * so its wording is the fallback — the way every card used to decide, and the reason a card
 * could call a Pro lesson "later".
 */
export function missionLock(mission: Pick<MissionSummary, 'isLocked' | 'lockKind' | 'lockReason'>): MissionLock | null {
  if (!mission.isLocked) return null
  if (mission.lockKind === 'Pro') return 'pro'
  if (mission.lockKind === 'Progress') return 'progress'
  return mission.lockReason?.toLowerCase().includes('pro') ? 'pro' : 'progress'
}

/** Where a locked mission's button goes: the plans for Pro, the path for a day not reached yet. */
export function missionLockDestination(lock: MissionLock) {
  return lock === 'pro' ? '/paywall' : '/path'
}

/**
 * The sentence that says what opens it. A progress lock uses the server's, which names the
 * day to finish first; the Pro one is ours, because the server's lists the free days in a
 * form that reads badly on a one-day plan.
 */
export function missionLockText(
  mission: Pick<MissionSummary, 'lockReason'>,
  lock: MissionLock,
  t: Dictionary,
) {
  return lock === 'pro' ? t.practice.lockedProBody : mission.lockReason || t.path.lockedFallback
}
