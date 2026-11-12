// Writes every line a learner can play in the foundation lessons to the server, so its lesson
// audio job can make them ahead of time with the full TTS model instead of on first play.
//
//   npm run export:lesson-speech            write ../russian-gg-server/.../web-lesson-lines.json
//   npm run export:lesson-speech -- --check fail if that file is out of date
//   ... -- --out <path>                      another server checkout
//
// Run it after any change to src/lib/foundation-lessons.ts or src/lib/lesson-speech.ts, and
// commit the JSON in the server repo. Node 23.6+ runs the TypeScript sources directly.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foundationLessons } from '../src/lib/foundation-lessons.ts'
import { lessonSpeechLines } from '../src/lib/lesson-speech.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const outIndex = args.indexOf('--out')
const out = outIndex >= 0
  ? resolve(args[outIndex + 1])
  : resolve(root, '../russian-gg-server/src/RussianGg.Infrastructure/Voice/web-lesson-lines.json')

// The hash the server test compares against the web sources, when both checkouts are present.
const sources = ['src/lib/foundation-lessons.ts', 'src/lib/lesson-speech.ts']
const hash = createHash('sha256')
for (const file of sources) hash.update(readFileSync(resolve(root, file), 'utf8').replace(/\r\n/g, '\n'))

const lessons = Object.values(foundationLessons)
  .sort((a, b) => a.day - b.day)
  .map((lesson) => ({ day: lesson.day, lines: lessonSpeechLines(lesson) }))

const json = JSON.stringify({
  source: 'russian-gg-web: src/lib/foundation-lessons.ts via src/lib/lesson-speech.ts (scripts/export-lesson-speech.mjs)',
  sourceHash: hash.digest('hex'),
  lessons,
}, null, 2) + '\n'

const count = lessons.reduce((sum, lesson) => sum + lesson.lines.length, 0)

if (check) {
  const current = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : null
  if (current !== json) {
    console.error(`${relative(process.cwd(), out)} is out of date. Run: npm run export:lesson-speech`)
    process.exit(1)
  }
  console.log(`Lesson speech export is current: ${lessons.length} lessons, ${count} lines.`)
} else {
  writeFileSync(out, json)
  console.log(`Wrote ${lessons.length} lessons, ${count} lines to ${relative(process.cwd(), out)}`)
}
