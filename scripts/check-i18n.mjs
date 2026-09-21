#!/usr/bin/env node
/**
 * Two checks that together stop the learner app drifting back out of its own dictionaries.
 *
 * The product supports uz / ru / en, and for a long time the three dictionaries were in
 * perfect shape while the biggest screens — both lesson players, the placement flow, the
 * games — never read from them at all. Nothing caught that, because nothing was looking:
 * TypeScript sees a string literal in JSX as a string literal.
 *
 *     node scripts/check-i18n.mjs
 *
 * 1. **Parity.** Every key in `uz` exists in `ru` and `en`, and neither has keys `uz` does
 *    not. `uz` is the source of truth for the shape (see `lib/i18n.ts`).
 *
 * 2. **Stray copy.** No user-visible literal is hardcoded in a screen. Russian text is
 *    expected — it is the subject being taught, not the interface — so only Uzbek-looking
 *    strings are flagged, and the check runs over the routes and components rather than the
 *    content modules under `lib/`.
 *
 * Exits non-zero on a finding, so it can go in CI beside `lint` and `typecheck`.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const locales = ['uz', 'ru', 'en'].map((name) => ({
  name,
  file: path.join(root, 'src/lib/locales', `${name}.ts`),
}))

/* --------------------------------------------------------------------------- parity */

function keysOf(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), 99, true)
  const out = new Set()

  function walk(node, prefix) {
    if (!ts.isObjectLiteralExpression(node)) return
    for (const property of node.properties) {
      if (!property.name) continue
      const key = (prefix ? prefix + '.' : '') + property.name.getText().replace(/['"]/g, '')
      if (property.initializer && ts.isObjectLiteralExpression(property.initializer)) {
        walk(property.initializer, key)
      } else {
        out.add(key)
      }
    }
  }

  function find(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      walk(node.initializer, '')
    }
    ts.forEachChild(node, find)
  }

  find(src)
  return out
}

function checkParity() {
  const [uz, ru, en] = locales.map((locale) => keysOf(locale.file))
  const problems = []

  const compare = (a, b, label) => {
    const missing = [...a].filter((key) => !b.has(key))
    if (missing.length) problems.push(`${label}: ${missing.length} key(s) — ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`)
  }

  compare(uz, ru, 'missing from ru')
  compare(uz, en, 'missing from en')
  compare(ru, uz, 'in ru but not uz')
  compare(en, uz, 'in en but not uz')

  console.log(`locales: uz ${uz.size}, ru ${ru.size}, en ${en.size}`)
  problems.forEach((problem) => console.log('  ✗ ' + problem))
  return problems.length
}

/* ---------------------------------------------------------------------- stray copy */

/** Attributes whose value reaches a person: on screen, or as an accessible name. */
const TEXT_PROPS = new Set(['label', 'title', 'placeholder', 'aria-label', 'alt', 'body', 'hint', 'subtitle'])
/** Never descend into these: they carry class lists, routes and SVG path data. */
const SKIP_PROPS = new Set(['className', 'class', 'style', 'key', 'id', 'href', 'to', 'src', 'd', 'viewBox', 'type', 'name', 'role', 'lang', 'data-ui-sound'])

/**
 * Uzbek stems, matched as whole words. Russian and English strings are left alone: Russian is
 * the content being taught, and an English literal in this codebase is nearly always an
 * identifier rather than copy.
 */
const UZBEK =
  /\b(va|uchun|bilan|kerak|kun|dars|hafta|javob|savol|daraja|qayta|davom|ochish|yopish|tanlang|bering|urinib|tinglang|gapiring|boshlash|yakunlandi|qiling|qilish|izoh|nima|hozircha|bo['‘’]lim|yo['‘’]q|so['‘’]z)\b/i

/**
 * A class list, a CSS value or a path fragment is not copy. They arrive here because they sit
 * in the same string positions — and `var(--radius-card)` happens to contain the Uzbek word
 * for "and", which is what made the first version of this check unusable.
 */
/**
 * Screens only staff ever open. They follow the admin panel's rule — Uzbek inline, no i18n
 * layer — because the people who use them all read Uzbek, and a dictionary for an audience of
 * four is a dictionary that goes stale. Keep the list short, and move a file off it the
 * moment a learner can reach it.
 */
const STAFF_ONLY = ['AdminContent.tsx']

const MACHINE = [
  /var\(--/,
  /--[a-z]/,
  // Two or more Tailwind-shaped tokens in a row is a class list, not a sentence.
  /(^|\s)[a-z-]+(-\[[^\]]+\]|-[\w./]+)(\s|$).*(^|\s)[a-z-]+(-\[[^\]]+\]|-[\w./]+)(\s|$)/,
  /^(rounded|flex|grid|inline|absolute|relative|block|min-h|max-w|size|overflow|fill|stroke|animate|transition)[\s-]/,
]

function strayCopy(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), 99, true)
  const found = []

  const note = (raw, node) => {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (text.length < 3) return
    if (MACHINE.some((pattern) => pattern.test(text))) return
    if (!UZBEK.test(text)) return
    found.push({ line: src.getLineAndCharacterOfPosition(node.getStart()).line + 1, text })
  }

  function walk(node) {
    if (ts.isJsxText(node)) note(node.text, node)

    if (ts.isJsxAttribute(node) && node.name) {
      const attr = node.name.getText()
      if (SKIP_PROPS.has(attr)) return
      if (TEXT_PROPS.has(attr) && node.initializer) {
        const collect = (n) => { if (ts.isStringLiteral(n)) note(n.text, n); ts.forEachChild(n, collect) }
        collect(node.initializer)
      }
    }

    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const collect = (n) => { if (ts.isStringLiteral(n)) note(n.text, n); ts.forEachChild(n, collect) }
      collect(node.expression)
    }

    ts.forEachChild(node, walk)
  }

  walk(src)
  return found
}

function checkStrayCopy() {
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.tsx')) files.push(full)
    }
  }

  // The routes and components only. `lib/` holds the lesson content, which is a separate
  // question — see the note at the top of the `lessonOne` block in the dictionaries.
  walk(path.join(root, 'src/routes'))
  walk(path.join(root, 'src/components'))

  let total = 0
  for (const file of files.sort()) {
    if (STAFF_ONLY.some((name) => file.endsWith(name))) continue
    const found = strayCopy(file)
    if (!found.length) continue
    total += found.length
    console.log(`  ✗ ${path.relative(root, file)}`)
    for (const { line, text } of found.slice(0, 5)) {
      console.log(`      ${line}: ${text.slice(0, 80)}`)
    }
    if (found.length > 5) console.log(`      …and ${found.length - 5} more`)
  }

  console.log(`hardcoded copy: ${total} string(s) outside the dictionaries`)
  return total
}

const failures = checkParity() + checkStrayCopy()
process.exit(failures === 0 ? 0 : 1)
