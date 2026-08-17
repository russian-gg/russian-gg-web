export const LESSON_ONE_STORAGE_KEY = 'rgg.demostage.lesson-one.v1'

export const LESSON_ONE_SECTIONS = [
  { id: 'welcome', eyebrow: '', title: 'Знакомство', progressTitle: 'Знакомство' },
  { id: 'tests', eyebrow: '1–2', title: '', progressTitle: '2 ta tezkor test' },
  { id: 'learn', eyebrow: '3', title: 'Rodlar va talaffuz', progressTitle: 'Rodlar va talaffuz' },
  { id: 'walk', eyebrow: '4', title: 'Чайхана bo‘ylab sayr', progressTitle: 'Чайхана bo‘ylab sayr' },
  { id: 'game', eyebrow: '5', title: 'Vaqt va salomlashuv', progressTitle: 'Vaqt va salomlashuv' },
  { id: 'missions', eyebrow: '6', title: 'AI bilan missiya', progressTitle: 'AI bilan missiya' },
  { id: 'vocabulary', eyebrow: '7', title: 'Словарь', progressTitle: 'Словарь' },
  { id: 'city', eyebrow: '8', title: 'Russian.gg shahri', progressTitle: 'Russian.gg shahri' },
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

export function readLessonOneProgress(): LessonOneProgress {
  if (typeof window === 'undefined') return { completed: [], isComplete: false }

  try {
    const stored = localStorage.getItem(LESSON_ONE_STORAGE_KEY)
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
