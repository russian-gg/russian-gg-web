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

export const LESSON_ONE_SECTIONS = [
  { id: 'tests', eyebrow: '1', title: 'Yengil test', progressTitle: 'Yengil test' },
  { id: 'phonetics', eyebrow: '2', title: 'Fonetik qoida', progressTitle: 'A, O, U va urg‘u' },
  { id: 'grammar', eyebrow: '3', title: 'Grammatik qoida', progressTitle: 'Otlarning rodi' },
  { id: 'phrases', eyebrow: '4', title: '15 ta asosiy ibora', progressTitle: '15 ta ibora' },
  { id: 'game', eyebrow: '5', title: 'Rangli uy', progressTitle: 'Rangli uy o‘yini' },
  { id: 'missions', eyebrow: '6', title: 'Dialog va AI savollari', progressTitle: 'AI missiyasi' },
  { id: 'vocabulary', eyebrow: '7', title: 'Lug‘at', progressTitle: 'Lug‘at' },
  { id: 'picture', eyebrow: '8', title: 'Rasmli mashq', progressTitle: 'Rasmli mashq' },
  { id: 'complete', eyebrow: '9', title: 'Dars yakuni', progressTitle: 'Dars yakuni' },
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
  if (typeof window === 'undefined' || !userId) return { completed: [], isComplete: false }

  try {
    const stored = localStorage.getItem(lessonOneStorageKey(userId))
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
