const LESSON_ONE_STORAGE_PREFIX = 'rgg.demostage.lesson-one.v4'

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

export const LESSON_ONE_SECTIONS = [
  { id: 'tests', eyebrow: '1', title: 'Uyg‘oning!', progressTitle: 'Kirish dialogi va test' },
  { id: 'phonetics', eyebrow: '2', title: 'Aniq gapiring!', progressTitle: 'А, О, У talaffuzi' },
  { id: 'phrases', eyebrow: '3', title: 'Taqlid qiling!', progressTitle: '15 ta asosiy ibora' },
  { id: 'grammar', eyebrow: '4', title: 'To‘g‘ri gapiring!', progressTitle: 'Otlar jinsi' },
  { id: 'game', eyebrow: '5', title: 'O‘ynang!', progressTitle: 'Rangli uy o‘yini' },
  { id: 'missions', eyebrow: '6', title: 'Mashq qiling!', progressTitle: 'Dialog va AI savollari' },
  { id: 'vocabulary', eyebrow: '7', title: 'So‘zlarni o‘rganing!', progressTitle: '20 ta lug‘at kartasi' },
  { id: 'picture', eyebrow: '8', title: 'Sinab ko‘ring!', progressTitle: 'Ijodiy topshiriq' },
  { id: 'complete', eyebrow: '9', title: 'Maqtaning!', progressTitle: 'Refleksiya va yakun' },
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
