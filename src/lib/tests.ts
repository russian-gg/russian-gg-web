import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { ProgressView } from './types'

export type TestCategory = 'Grammar' | 'Phonetics' | 'Vocabulary'

export type TestDifficulty = 'Easy' | 'Medium' | 'Hard'

/** What the Tests tab shows before a block starts. `availableQuestions` 0 means nothing to start. */
export type TestSummary = {
  availableQuestions: number
  learnedQuestions: number
  openBlockId?: string
}

/*
 * The API leaves null fields out of its JSON (`WhenWritingNull`), so every "may be empty" field
 * here is optional rather than `| null` — an unanswered item has no `answer` key at all.
 */

/**
 * The server keeps the right answer until the learner commits; an answered item carries it,
 * an unanswered one does not. `correctStreak` is only set on the response to the answer itself.
 */
export type TestAnswerResult = {
  chosenOptionIndex: number
  isCorrect: boolean
  correctOptionIndex: number
  explanation: string
  correctStreak?: number
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

export type TestBlock = {
  id: string
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
  correctCount: number
  totalCount: number
  startedAt: string
  completedAt?: string
  items: TestReviewItem[]
}

/** A question is learned after this many right answers in a row; mirrors the server. */
export const LEARNED_STREAK = 3

export const testsApi = {
  summary: () => api.get<TestSummary>('/tests/summary'),
  /** Continues the unfinished block if there is one, otherwise starts a new one. */
  start: () => api.post<TestBlock>('/tests/blocks'),
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

export const testQueryKeys = {
  summary: ['tests', 'summary'] as const,
  block: (blockId: string) => ['tests', 'block', blockId] as const,
  review: (blockId: string) => ['tests', 'review', blockId] as const,
}
