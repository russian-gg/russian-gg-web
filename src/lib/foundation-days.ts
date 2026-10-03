/**
 * The course days that have a full lesson in `foundation-lessons.ts`.
 *
 * The list lives apart from the lessons themselves because the screens that only need to know
 * *whether* a day is a lesson — the home page, the mission cards, the course map — must not pull
 * the lesson content into their bundle to find out. `foundation-lessons.ts` types its registry
 * from this tuple, so a day added to one and not the other fails the typecheck.
 *
 * The days are not contiguous: 16 and 20 have no lesson yet and keep the voice player.
 */
export const FOUNDATION_LESSON_DAYS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  17, 18, 19,
  21, 22, 23, 24, 25,
] as const

export type FoundationLessonDay = (typeof FOUNDATION_LESSON_DAYS)[number]

export function hasFoundationLesson(day: number | null | undefined): day is FoundationLessonDay {
  return day != null && (FOUNDATION_LESSON_DAYS as readonly number[]).includes(day)
}
