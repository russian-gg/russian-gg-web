import { centerLockText, type CenterLock } from './center'
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

/**
 * Where a locked mission's button goes: the plans for Pro, the path for a day not reached yet.
 *
 * A language center's student (`centerLock`, from `useCenterStudent`) is never sent to the
 * plans: their Pro is the center's to open, so the button goes to their profile, where the
 * center's state is spelled out.
 */
export function missionLockDestination(lock: MissionLock, centerLock?: CenterLock | null) {
  if (lock === 'pro') return centerLock ? '/settings' : '/paywall'
  return '/path'
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
  /** Set for a center's student: the center's state stands in for the offer. */
  centerLock?: CenterLock | null,
) {
  if (lock === 'pro') return centerLock ? centerLockText(centerLock, t) : t.practice.lockedProBody
  return mission.lockReason || t.path.lockedFallback
}

/** The short label on a locked card: "needs Pro" is an offer, so a center's student reads "locked". */
export function missionLockLabel(lock: MissionLock, t: Dictionary, centerLock?: CenterLock | null) {
  return lock === 'pro' && !centerLock ? t.path.needsPro : t.path.locked
}
