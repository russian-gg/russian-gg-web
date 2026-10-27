import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { useAuth } from './auth-context'
import { readFoundationLessonProgress } from './demo-lesson-one'
import { hasFoundationLesson } from './foundation-days'
import type { CourseDayView } from './types'

export const COURSE_DAYS = 90

/**
 * Which course days are finished, counted one way for every screen.
 *
 * The server's course day is where the learner is, not how much they have done: the level test
 * can place a learner at day 4 with days 1–3 open behind them. Counting "done" from it made the
 * side rail say "3/90" beside a course map showing one day finished. Every "days done" now
 * counts the way the course map does: the server's record of a day, or a lesson finished in this
 * browser that has not synced yet. The day the learner is on stays the server's.
 */
export function useCourseDays() {
  const { user } = useAuth()
  const { data: courseMap } = useQuery({
    queryKey: ['course-map'],
    queryFn: () => api.get<CourseDayView[]>('/course/map'),
    staleTime: 60_000,
    retry: false,
  })

  const isDone = (dayNumber: number) => {
    const day = courseMap?.find((entry) => entry.day === dayNumber)
    if (!day) return false
    if (day.completedMissionCount >= day.requiredMissionCount) return true
    return day.isUnlocked && hasFoundationLesson(day.day) && readFoundationLessonProgress(user?.id, day.day).isComplete
  }

  const finished = courseMap ? courseMap.filter((day) => isDone(day.day)).length : null

  return {
    ready: Boolean(courseMap),
    isDone,
    /** Days finished, or null until the course map is in. */
    finished,
  }
}
