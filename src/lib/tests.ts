import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { ProgressView } from './types'

export type TestCategory = 'Grammar' | 'Phonetics' | 'Vocabulary'

export type TestDifficulty = 'Easy' | 'Medium' | 'Hard'

/*
 * The API leaves null fields out of its JSON (`WhenWritingNull`), so every "may be empty" field
 * here is optional rather than `| null` — an unanswered item has no `answer` key at all.
 */

/** The result of one finished sitting of a test. */
export type TestScore = {
  blockId: string
  correctCount: number
  totalCount: number
  completedAt: string
}

/**
 * One test on the Tests tab. Each test is sat on its own, as often as the learner likes; the
 * server lists only active tests that have questions, in the order they were created.
 */
export type TestListItem = {
  id: string
  title: string
  difficulty: TestDifficulty
  /** How long a sitting started now would be. */
  questionCount: number
  /** An unfinished sitting of this test to continue. */
  openBlockId?: string
  /** Finished sittings. */
  attempts: number
  last?: TestScore
  best?: TestScore
}

/**
 * The server keeps the right answer until the learner commits; an answered item carries it,
 * an unanswered one does not. Option indexes are places on screen in this sitting: the options
 * arrive already shuffled.
 */
export type TestAnswerResult = {
  chosenOptionIndex: number
  isCorrect: boolean
  correctOptionIndex: number
  explanation: string
  blockCompleted: boolean
}

export type TestBlockItem = {
  id: string
  order: number
  category: TestCategory
  difficulty: TestDifficulty
  text: string
  options: string[]
  answer?: TestAnswerResult
}

/** One sitting of one test, its questions in the order shuffled for this sitting. */
export type TestBlock = {
  id: string
  /** Missing only on sittings from before tests were sat one at a time. */
  testId?: string
  testTitle: string
  startedAt: string
  completedAt?: string
  items: TestBlockItem[]
}

export type TestReviewItem = {
  id: string
  order: number
  category: TestCategory
  difficulty: TestDifficulty
  text: string
  options: string[]
  chosenOptionIndex?: number
  correctOptionIndex: number
  isCorrect: boolean
  explanation: string
}

export type TestBlockReview = {
  id: string
  testId?: string
  testTitle: string
  correctCount: number
  totalCount: number
  startedAt: string
  completedAt?: string
  items: TestReviewItem[]
}

export const testsApi = {
  list: () => api.get<TestListItem[]>('/tests'),
  /** Continues the unfinished sitting of this test if there is one, otherwise starts a new one. */
  start: (testId: string) => api.post<TestBlock>(`/tests/${testId}/blocks`),
  block: (blockId: string) => api.get<TestBlock>(`/tests/blocks/${blockId}`),
  answer: (blockId: string, itemId: string, optionIndex: number) =>
    api.post<TestAnswerResult>(`/tests/blocks/${blockId}/items/${itemId}/answer`, { optionIndex }),
  review: (blockId: string) => api.get<TestBlockReview>(`/tests/blocks/${blockId}/review`),
}

/**
 * The course day the learner is on, for colouring a question's Russian only as far as their
 * lessons have taught. Tests are not tied to a day, so the learner's own day is the measure.
 * It reads the same cached query the app shell keeps, so it costs no extra request.
 */
export function useLearnerDay() {
  const { data } = useQuery({
    queryKey: ['progress'],
    queryFn: () => api.get<ProgressView>('/course/progress'),
    staleTime: 60_000,
    retry: false,
  })
  return data?.currentDay ?? 1
}

/**
 * Whether the Tests tab has anything behind it: at least one test the learner can sit. While
 * there is none, the menu shows the tab as "coming soon" instead of leading to an empty screen.
 *
 * Unknown counts as available — while the list is loading, or if it fails — so the tab does
 * not flash "coming soon" on every load for the ordinary case where tests exist.
 */
export function useTestsAvailable() {
  const { data } = useQuery({
    queryKey: testQueryKeys.list,
    queryFn: testsApi.list,
    staleTime: 60_000,
    retry: false,
  })
  return !data || data.length > 0
}

export const testQueryKeys = {
  list: ['tests', 'list'] as const,
  block: (blockId: string) => ['tests', 'block', blockId] as const,
  review: (blockId: string) => ['tests', 'review', blockId] as const,
}
