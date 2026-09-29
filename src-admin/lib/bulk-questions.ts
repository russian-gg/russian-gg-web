/**
 * The plain-text format the "Ommaviy qo'shish" dialog reads, so a whole test can be pasted from
 * a document instead of typed one form at a time:
 *
 *     Как тебя зовут?
 *     + Меня зовут Али.
 *     - Я зовут Али.
 *     - Мне зовут Али.
 *     = "Меня зовут" — ismni aytishning to'g'ri shakli.
 *
 *     Следующий вопрос…
 *
 * One question per paragraph (blank lines between). Unmarked lines are the question; `+` marks
 * the right option and `-` every other one, in the order the learner will see them; `=` is the
 * rule or explanation. The rules mirror the server's, so the preview shows every mistake before
 * anything is sent — the server still checks, and still rejects the batch as a whole.
 */

export const MIN_OPTIONS = 3
export const MAX_OPTIONS = 8

export type ParsedQuestion = {
  text: string
  options: string[]
  correctOptionIndex: number
  explanation: string
}

export type ParseProblem = { number: number; message: string }

export type ParseResult = {
  questions: ParsedQuestion[]
  problems: ParseProblem[]
}

export const BULK_EXAMPLE = `Как тебя зовут?
+ Меня зовут Али.
- Я зовут Али.
- Мне зовут Али.
= "Меня зовут" — ismni aytishning to'g'ri shakli.

Где ты живёшь?
- Я живу Ташкент.
+ Я живу в Ташкенте.
- Я живу в Ташкент.
= "в" dan keyin shahar nomi old ko'makchili kelishikda: в Ташкенте.`

export function parseBulkQuestions(source: string): ParseResult {
  const blocks = source
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0)

  const questions: ParsedQuestion[] = []
  const problems: ParseProblem[] = []

  blocks.forEach((lines, index) => {
    const number = index + 1
    const text: string[] = []
    const options: string[] = []
    const explanation: string[] = []
    let correct = -1
    let correctCount = 0

    for (const line of lines) {
      const marker = line[0]
      const rest = line.slice(1).trim()
      if (marker === '+' || marker === '-') {
        if (marker === '+') {
          correct = options.length
          correctCount += 1
        }
        options.push(rest)
      } else if (marker === '=') {
        explanation.push(rest)
      } else if (options.length === 0 && explanation.length === 0) {
        text.push(line)
      } else {
        problems.push({ number, message: `"${line}" — satr belgisiz. Variantlar "+" yoki "-", izoh "=" bilan boshlanadi.` })
      }
    }

    const report = (message: string) => problems.push({ number, message })
    if (text.length === 0) report('Savol matni yo‘q.')
    if (options.length < MIN_OPTIONS) report(`Kamida ${MIN_OPTIONS} ta variant kerak (hozir ${options.length}).`)
    if (options.length > MAX_OPTIONS) report(`Ko‘pi bilan ${MAX_OPTIONS} ta variant bo‘ladi (hozir ${options.length}).`)
    if (options.some((option) => option === '')) report('Bo‘sh variant bor.')
    if (correctCount === 0) report('To‘g‘ri variant "+" bilan belgilanmagan.')
    if (correctCount > 1) report('Faqat bitta variant "+" bilan belgilanadi.')
    if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) report('Variantlar takrorlanmoqda.')
    if (explanation.length === 0) report('Izoh ("=" bilan) yo‘q.')

    questions.push({
      text: text.join('\n'),
      options,
      correctOptionIndex: Math.max(correct, 0),
      explanation: explanation.join('\n'),
    })
  })

  return { questions, problems }
}
