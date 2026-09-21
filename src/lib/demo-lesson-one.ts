const LESSON_ONE_STORAGE_PREFIX = 'rgg.demostage.lesson-one.v3'

/**
 * Lesson one is currently a client-side demo lesson, so its draft progress lives in the
 * browser. The account id is part of the key because the same browser can be used by more
 * than one learner. A new version intentionally leaves the old, unscoped key unread: there
 * is no safe way to know which account owned that legacy progress.
 */
export function lessonOneStorageKey(userId: string): string {
  return `${LESSON_ONE_STORAGE_PREFIX}.${encodeURIComponent(userId)}`
}

export function foundationLessonStorageKey(userId: string, day: number): string {
  return day === 1
    ? lessonOneStorageKey(userId)
    : `rgg.demostage.foundation-lesson.v1.${encodeURIComponent(userId)}.${day}`
}

/**
 * The lesson's nine steps, in order. Only the order and the ids live here now — the names
 * are copy, so they are `t.lessonOne.sections[id]`, keyed by the same id.
 */
export const LESSON_ONE_SECTIONS = [
  { id: 'tests', eyebrow: '1' },
  { id: 'phonetics', eyebrow: '2' },
  { id: 'grammar', eyebrow: '3' },
  { id: 'phrases', eyebrow: '4' },
  { id: 'game', eyebrow: '5' },
  { id: 'missions', eyebrow: '6' },
  { id: 'vocabulary', eyebrow: '7' },
  { id: 'picture', eyebrow: '8' },
  { id: 'complete', eyebrow: '9' },
] as const

export type LessonOneSection = (typeof LESSON_ONE_SECTIONS)[number]['id']

type StoredLessonOneState = {
  sectionIndex?: number
  completed?: unknown
}

export type LessonOneProgress = {
  completed: LessonOneSection[]
  isComplete: boolean
}

export function readLessonOneProgress(userId: string | null | undefined): LessonOneProgress {
  return readFoundationLessonProgress(userId, 1)
}

export function readFoundationLessonProgress(
  userId: string | null | undefined,
  day: number,
): LessonOneProgress {
  if (typeof window === 'undefined' || !userId) return { completed: [], isComplete: false }

  try {
    const stored = localStorage.getItem(foundationLessonStorageKey(userId, day))
    if (!stored) return { completed: [], isComplete: false }

    const candidate = JSON.parse(stored) as StoredLessonOneState
    const completedValues = Array.isArray(candidate.completed) ? candidate.completed : []
    const completed = LESSON_ONE_SECTIONS
      .map((section) => section.id)
      .filter((id) => completedValues.includes(id))

    return {
      completed,
      isComplete: completed.length === LESSON_ONE_SECTIONS.length,
    }
  } catch {
    return { completed: [], isComplete: false }
  }
}
