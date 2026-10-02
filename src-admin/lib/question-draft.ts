/**
 * The questions an admin is writing for a test before they are saved.
 *
 * The "Savol qo'shish" dialog holds one or more question cards and saves them in one request.
 * Until then they live in localStorage, one draft per test, so a refresh, a closed dialog or a
 * dropped session does not throw away half an hour of typing. The server never sees a draft.
 *
 * The rules mirror the server's (`TestQuestion.SetContent`) so every mistake shows on its card
 * before anything is sent — the server still checks, and still rejects the batch as a whole.
 */

import type { TestCategory } from './types'

export const MIN_OPTIONS = 3
/** A new question starts with this many option rows; they cannot be removed, only the ones added after. */
export const DEFAULT_OPTIONS = 4
export const MAX_OPTIONS = 8
export const MAX_QUESTIONS = 200
export const MAX_TEXT_LENGTH = 1000
export const MAX_OPTION_LENGTH = 300
export const MAX_EXPLANATION_LENGTH = 2000

export type QuestionDraft = {
  /** Only for React keys; never sent. */
  key: string
  /** The section this question counts under in a learner's block. */
  category: TestCategory
  text: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

const storageKey = (testId: string) => `rgg.admin.test-draft.${testId}`

const newKey = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

const CATEGORIES: readonly TestCategory[] = ['Grammar', 'Phonetics', 'Vocabulary']

/** A new card takes the section of the one before it: questions are usually written a section at a time. */
export function emptyQuestion(category: TestCategory = 'Grammar'): QuestionDraft {
  return { key: newKey(), category, text: '', options: Array(DEFAULT_OPTIONS).fill(''), correctOptionIndex: 0, explanation: '' }
}

function isBlank(question: QuestionDraft) {
  return question.text.trim() === '' && question.explanation.trim() === '' && question.options.every((o) => o.trim() === '')
}

/** A stored draft is checked, not trusted: an older build or a hand edit could have left anything there. */
function readQuestion(value: unknown): QuestionDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Record<string, unknown>
  if (typeof raw.text !== 'string' || typeof raw.explanation !== 'string') return null
  if (!Array.isArray(raw.options) || !raw.options.every((o) => typeof o === 'string')) return null

  const options = (raw.options as string[]).slice(0, MAX_OPTIONS)
  while (options.length < MIN_OPTIONS) options.push('')
  const correct = typeof raw.correctOptionIndex === 'number' ? raw.correctOptionIndex : 0

  return {
    key: typeof raw.key === 'string' ? raw.key : newKey(),
    category: CATEGORIES.includes(raw.category as TestCategory) ? (raw.category as TestCategory) : 'Grammar',
    text: raw.text,
    options,
    correctOptionIndex: correct >= 0 && correct < options.length ? correct : 0,
    explanation: raw.explanation,
  }
}

export function loadDraft(testId: string): QuestionDraft[] | null {
  try {
    const stored = localStorage.getItem(storageKey(testId))
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return null
    const questions = parsed.map(readQuestion).filter((q): q is QuestionDraft => q !== null)
    return questions.length > 0 && !questions.every(isBlank) ? questions : null
  } catch {
    // Private mode, blocked storage or a broken value: start with an empty form.
    return null
  }
}

/** A form nobody has typed into is not a draft, so it is not kept. */
export function saveDraft(testId: string, questions: QuestionDraft[]) {
  try {
    if (questions.every(isBlank)) localStorage.removeItem(storageKey(testId))
    else localStorage.setItem(storageKey(testId), JSON.stringify(questions))
  } catch {
    // Not being able to keep the draft should not stop the admin typing.
  }
}

export function clearDraft(testId: string) {
  try {
    localStorage.removeItem(storageKey(testId))
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function hasDraft(testId: string) {
  return loadDraft(testId) !== null
}

/** What is wrong with one card, in the server's words where it has them. Empty means it can be sent. */
export function questionProblems(question: QuestionDraft): string[] {
  const problems: string[] = []
  const text = question.text.trim()
  const options = question.options.map((o) => o.trim())
  const explanation = question.explanation.trim()

  if (text === '') problems.push('Savol matnini kiriting.')
  else if (text.length > MAX_TEXT_LENGTH) problems.push('Savol matni juda uzun.')

  if (options.some((o) => o === '')) problems.push("Bo'sh javob varianti bo'lmasligi kerak.")
  if (options.some((o) => o.length > MAX_OPTION_LENGTH)) problems.push('Javob varianti juda uzun.')
  const filled = options.filter((o) => o !== '').map((o) => o.toLowerCase())
  if (new Set(filled).size !== filled.length) problems.push("Javob variantlari takrorlanmasligi kerak.")

  if (question.correctOptionIndex < 0 || question.correctOptionIndex >= options.length) {
    problems.push("To'g'ri javobni belgilang.")
  }

  if (explanation === '') problems.push('Qoida yoki izohni kiriting.')
  else if (explanation.length > MAX_EXPLANATION_LENGTH) problems.push('Izoh juda uzun.')

  return problems
}

/** The request body row for one card. */
export function toRequest(question: QuestionDraft) {
  return {
    category: question.category,
    text: question.text.trim(),
    options: question.options.map((o) => o.trim()),
    correctOptionIndex: question.correctOptionIndex,
    explanation: question.explanation.trim(),
    isActive: true,
  }
}
