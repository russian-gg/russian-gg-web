import type { LessonData, Mascot } from './foundation-lessons'
import { cleanSpeechText, dialogueSpeaker, dialogueSpeechText } from './lesson-speech'

/*
  The dialogue workshop: what a learner on the plan without AI does in the lesson's sixth step,
  where the other plan reads the dialogue aloud for a model to judge.

  Everything here is built from what the lesson already has — its dialogue and its questions —
  so every lesson has a workshop without anybody writing one. The same lesson always builds the
  same workshop (the shuffles are seeded by the day), which is what lets progress be saved by
  position and found again after a reload.

  Six stages, from hearing the dialogue to saying it:
    1. listen     the whole dialogue, each line in its character's voice
    2. order      put the shuffled lines back in order
    3. reply      for a line, pick the line that answers it
    4. gap        a line with one word missing; pick the word
    5. questions  the lesson's questions, answered by picking
    6. read       each line: hear it, say it, hear yourself next to the model
*/

export const WORKSHOP_STAGES = ['listen', 'order', 'reply', 'gap', 'questions', 'read'] as const
export type WorkshopStage = (typeof WORKSHOP_STAGES)[number]

export interface WorkshopLine {
  /** Position in the lesson's dialogue. */
  index: number
  /** The line without its "Пингвин: …" label. */
  text: string
  /** Exactly what prompt audio is asked for, so the stored clip is the one that plays. */
  speech: string
  speaker?: Mascot
}

export interface ChoiceItem {
  options: string[]
  correct: number
}

export interface ReplyItem extends ChoiceItem {
  prompt: WorkshopLine
}

export interface GapItem extends ChoiceItem {
  line: WorkshopLine
  before: string
  after: string
  answer: string
}

export interface QuestionItem extends ChoiceItem {
  question: string
}

export interface Workshop {
  lines: WorkshopLine[]
  /** The opening of the dialogue, which the "order" stage has put back together. */
  ordering: WorkshopLine[]
  /** Those lines' indexes in the order the stage lays them out. */
  shuffled: number[]
  /** The lines read aloud in the last stage, taken from across the dialogue. */
  reading: WorkshopLine[]
  replies: ReplyItem[]
  gaps: GapItem[]
  questions: QuestionItem[]
}

/** How far a learner is. Saved with the rest of the lesson's state. */
export interface WorkshopProgress {
  stage: number
  /** Stage 2: how many lines are back in place. */
  ordered: number
  /** Stages 3–5: the item being answered. */
  item: number
  /** Stage 6: the lines recorded (or read without a microphone). */
  read: number[]
  micSkipped: boolean
  /** Answers right on the first try, out of `asked`, across stages 2–5. */
  firstTry: number
  asked: number
}

export const emptyWorkshopProgress: WorkshopProgress = {
  stage: 0,
  ordered: 0,
  item: 0,
  read: [],
  micSkipped: false,
  firstTry: 0,
  asked: 0,
}

export function isWorkshopDone(progress: WorkshopProgress | undefined) {
  return (progress?.stage ?? 0) >= WORKSHOP_STAGES.length
}

/** Reply and gap stages stay short: enough to work the dialogue, not every line again. */
const MAX_REPLIES = 4
const MAX_GAPS = 4

/**
 * A dialogue runs to twenty lines. Ordering or recording every one of them would turn one step
 * of nine into the whole lesson, so both stages take eight.
 */
const MAX_ORDERED = 8
const MAX_READ = 8

export function buildWorkshop(lesson: LessonData): Workshop {
  const random = seeded(lesson.day * 7919 + lesson.dialogue.length)
  const lines: WorkshopLine[] = lesson.dialogue.map((raw, index) => {
    const text = dialogueSpeechText(raw)
    return { index, text, speech: cleanSpeechText(text), speaker: dialogueSpeaker(raw) }
  })

  const ordering = lines.slice(0, MAX_ORDERED)

  return {
    lines,
    ordering,
    shuffled: shuffledAwayFromOrder(ordering.map((line) => line.index), random),
    reading: spread(lines, MAX_READ),
    replies: buildReplies(lines, random),
    gaps: buildGaps(lesson, lines, random),
    questions: buildQuestions(lesson, lines, random),
  }
}

function buildReplies(lines: WorkshopLine[], random: () => number): ReplyItem[] {
  const prompts = spread(lines.slice(0, -1), MAX_REPLIES)
  return prompts.flatMap((prompt) => {
    const answer = lines[prompt.index + 1]
    // Wrong replies are other lines of the same dialogue, the answering character's first:
    // a reply in the wrong voice would be picked out by its speaker, not by its meaning.
    const others = lines.filter((line) => line.index !== answer.index && line.index !== prompt.index && line.text !== answer.text)
    const sameSpeaker = shuffle(others.filter((line) => line.speaker === answer.speaker), random)
    const rest = shuffle(others.filter((line) => line.speaker !== answer.speaker), random)
    const wrong = unique([...sameSpeaker, ...rest].map((line) => line.text)).slice(0, 2)
    return wrong.length < 2 ? [] : [{ prompt, ...choice(answer.text, wrong, random) }]
  })
}

const WORD = /[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/gu

function buildGaps(lesson: LessonData, lines: WorkshopLine[], random: () => number): GapItem[] {
  // Words the lesson teaches are the ones worth taking out; any long word otherwise.
  const taught = new Set(
    [...lesson.vocabulary.map((word) => word.ru), ...lesson.phrases.map((phrase) => phrase.ru)]
      .flatMap((text) => plain(text).match(WORD) ?? [])
      .map((word) => word.toLowerCase())
      .filter((word) => word.length >= 3),
  )

  const candidates = lines.flatMap((line) => {
    const words = [...line.text.matchAll(WORD)].filter((match) => match[0].length >= 3)
    if (words.length < 2) return []
    const pick = words.find((match) => taught.has(match[0].toLowerCase()))
      ?? [...words].sort((a, b) => b[0].length - a[0].length)[0]
    const at = pick.index ?? 0
    return [{ line, answer: pick[0], before: line.text.slice(0, at), after: line.text.slice(at + pick[0].length) }]
  })

  const chosen = spread(candidates, MAX_GAPS)
  const bank = unique([
    ...candidates.map((candidate) => candidate.answer),
    ...lesson.vocabulary.flatMap((word) => plain(word.ru).match(WORD) ?? []),
  ].map((word) => word.toLowerCase()))

  return chosen.flatMap((gap) => {
    const answer = gap.answer.toLowerCase()
    const wrong = shuffle(bank.filter((word) => word !== answer), random).slice(0, 2)
    return wrong.length < 2 ? [] : [{ ...gap, ...choice(answer, wrong, random) }]
  })
}

function buildQuestions(lesson: LessonData, lines: WorkshopLine[], random: () => number): QuestionItem[] {
  return lesson.questions.flatMap((item) => {
    // The other questions' answers are the wrong ones: sentences of the same shape, about the
    // same people. A lesson with fewer than three questions borrows lines of the dialogue.
    const pool = unique([
      ...lesson.questions.map((other) => other.answer),
      ...lines.map((line) => line.text),
    ]).filter((text) => text !== item.answer)
    const wrong = shuffle(pool.slice(0, Math.max(lesson.questions.length - 1, 2)), random).slice(0, 2)
    return wrong.length < 2 ? [] : [{ question: item.question, ...choice(item.answer, wrong, random) }]
  })
}

function choice(answer: string, wrong: string[], random: () => number): ChoiceItem {
  const options = shuffle([answer, ...wrong], random)
  return { options, correct: options.indexOf(answer) }
}

/** Stress marks are written into the lesson's words; a dialogue line does not carry them. */
function plain(text: string) {
  return text.normalize('NFD').replace(/́/gu, '').normalize('NFC')
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}

/** Up to `count` items taken evenly from across the list, in their own order. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  return Array.from({ length: count }, (_, step) => items[Math.floor((step * items.length) / count)])
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

/** A shuffle that never hands the lines back already in order — that would be no task at all. */
function shuffledAwayFromOrder(indexes: number[], random: () => number): number[] {
  if (indexes.length < 2) return indexes
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = shuffle(indexes, random)
    if (result.some((value, position) => value !== indexes[position])) return result
  }
  return [...indexes].reverse()
}

/** mulberry32: small, fast and the same on every device, which is all a seeded shuffle needs. */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
