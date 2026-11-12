import type { LessonData, Mascot } from './foundation-lessons'

/**
 * What the lesson page sends to prompt audio, in one place.
 *
 * The server stores a lesson's audio ahead of time, addressed by a hash of the exact text and
 * voice — so a line it makes must be spelled exactly as the page asks for it, or the stored
 * clip is paid for and never played. The page and the export the server reads
 * (scripts/export-lesson-speech.mjs) both build their text from these helpers, which is what
 * keeps the two from drifting apart.
 */

export type SpeechLine = { text: string; character?: Mascot }

/** Emoji and dashes read badly aloud: the mascot marks go, a dash becomes a pause. */
export function cleanSpeechText(text: string) {
  return text.replace(/🐧|🐼|🪶|🎭|🎙️/gu, '').replaceAll('—', ',').trim()
}

/** A dialogue line without its "Пингвин: …" label, which the voice itself now says. */
export function dialogueSpeechText(line: string) {
  const separator = line.indexOf(':')
  return separator < 0 ? line : line.slice(separator + 1).trim()
}

const DIALOGUE_SPEAKERS: Record<string, Mascot> = { Пингвин: 'penguin', Панда: 'panda', Перо: 'pero' }

/** The character a dialogue line belongs to, read from its "Пингвин: …" label. */
export function dialogueSpeaker(line: string): Mascot | undefined {
  const separator = line.indexOf(':')
  return separator < 0 ? undefined : DIALOGUE_SPEAKERS[line.slice(0, separator).trim()]
}

/**
 * One segment per speaker turn, not one flat string. A mascot's line carries its `character`
 * so playback switches to that mascot's own Gemini voice; unattributed narration (title,
 * plain paragraphs, tables) has none and falls back to the learner's base voice.
 */
export function ruleSpeechSegments(rule: LessonData['phonetics']): SpeechLine[] {
  return [
    { text: rule.title },
    ...rule.body.map((paragraph): SpeechLine => typeof paragraph === 'string'
      ? { text: paragraph }
      : 'speaker' in paragraph
        ? { text: paragraph.text, character: paragraph.speaker }
        : { text: paragraph.table.rows.map((row) => row.join(', ')).join('. ') }),
  ]
}

export type LessonSpeechLine = SpeechLine & { key: string }

/**
 * Every line a learner can play in a lesson, keyed by where it sits, with the text exactly as
 * it reaches the server (cleaned and trimmed, as playPromptAudio sends it).
 *
 * Left out on purpose: what the learner writes themselves (the exercise read-back) and the
 * feedback on their answers — personal text is spoken live and never stored.
 */
export function lessonSpeechLines(lesson: LessonData): LessonSpeechLine[] {
  const lines: LessonSpeechLine[] = []
  const add = (key: string, text: string, character?: Mascot) => {
    const cleaned = cleanSpeechText(text)
    if (cleaned) lines.push(character ? { key, text: cleaned, character } : { key, text: cleaned })
  }

  for (const [name, rule] of [['phonetics', lesson.phonetics], ['grammar', lesson.grammar]] as const) {
    ruleSpeechSegments(rule).forEach((segment, index) => add(`${name}:${index}`, segment.text, segment.character))
    rule.examples.forEach((example, index) => add(`${name}:example:${index}`, example))
    if (rule.tongueTwister) add(`${name}:twister`, rule.tongueTwister.ru)
  }

  lesson.phrases.forEach((phrase, index) => add(`phrase:${index}`, phrase.ru))

  // Only the gender-houses board has a speaker on each word; the other games are silent.
  if (lesson.game.kind === 'gender-houses') {
    lesson.game.pairs.forEach((pair, index) => add(`game:${index}`, pair.left))
  }

  lesson.dialogue.forEach((line, index) => add(`dialogue:${index}`, dialogueSpeechText(line), dialogueSpeaker(line)))
  lesson.questions.forEach((question, index) => add(`question:${index}`, question.question))
  lesson.vocabulary.forEach((word, index) => add(`vocabulary:${index}`, word.ru))

  return lines
}
