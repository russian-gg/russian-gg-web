import { pickContent } from '../../lib/content'
import { TOPIC_ORDER } from '../../lib/format'
import type { Dictionary, Locale } from '../../lib/i18n'
import type { MissionSummary, MissionTopic } from '../../lib/types'

/**
 * Where the learner stands with a mission, read off the server's own fields only.
 *
 * A mission tried but not yet passed counts as in progress: that is the only "under way" the
 * server records, since a conversation is not resumed half way through. Locked is the
 * server's `isLocked`, and nothing else — the map's order never unlocks or locks anything.
 */
export type MissionStatus = 'done' | 'inProgress' | 'notStarted'

/** A mission as the map and the panel show it. */
export type MissionRow = {
  mission: MissionSummary
  /** Its place in the usual order, starting at 1. */
  number: number
  title: string
  status: MissionStatus
  locked: boolean
  isProLock: boolean
}

/**
 * One path, in situation order. Untagged missions go last. The sort is stable, so the
 * server's order holds inside a situation.
 */
export function buildMissionRows(missions: MissionSummary[], locale: Locale): MissionRow[] {
  const rank = (topic: MissionTopic) => {
    const index = topic === 'Unset' ? -1 : TOPIC_ORDER.indexOf(topic)
    return index < 0 ? TOPIC_ORDER.length : index
  }

  return [...missions]
    .sort((a, b) => rank(a.topic) - rank(b.topic))
    .map((mission, index) => ({
      mission,
      number: index + 1,
      title: pickContent(locale, { uz: mission.titleUz, ru: mission.titleRu, en: mission.titleEn }),
      status: mission.isCompleted ? 'done' : mission.bestScore != null ? 'inProgress' : 'notStarted',
      locked: mission.isLocked,
      isProLock: mission.isLocked && (mission.lockReason?.toLowerCase().includes('pro') ?? false),
    }))
}

/** The word for a mission's state. The map and the panel say the same thing in the same words. */
export function missionStatusLabel(row: MissionRow, t: Dictionary): string {
  if (row.locked) return row.isProLock ? t.path.needsPro : t.path.locked
  if (row.status === 'done') return t.practice.statDone
  if (row.status === 'inProgress') return t.practice.statInProgress
  return t.practice.statNotStarted
}

/**
 * The mission the path points at: the first one open to the learner and not yet finished.
 * It only decides which node starts selected and which is drawn as "up next".
 */
export function currentMissionId(rows: MissionRow[]): string | undefined {
  return rows.find((row) => !row.locked && row.status !== 'done')?.mission.id
}
