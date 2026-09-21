#!/usr/bin/env node
/**
 * Re-encodes everything under `public/` into the formats this audience can afford.
 *
 * The learner this product is built for is on a mid-range Android phone paying for mobile
 * data, and `public/` is served as-is — Vite does not touch it, so nothing here is optimised
 * by the build. Before this script ran, the first-run path pulled ~5 MB of PNG and a 1 MB
 * uncompressed WAV.
 *
 * Run it whenever a new raster or the onboarding recording is added:
 *
 *     node scripts/optimize-assets.mjs           # convert, keep the originals
 *     node scripts/optimize-assets.mjs --prune   # convert, then delete the originals
 *
 * It is idempotent: a file whose `.webp` is already newer than it is skipped, and the icons
 * are never touched (see ICONS below).
 */

import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const ffmpeg = require('ffmpeg-static')
const run = promisify(execFile)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const prune = process.argv.includes('--prune')

/**
 * Left as PNG on purpose. The web app manifest, `apple-touch-icon` and the `.ico` are read by
 * installers and crawlers rather than by the page, and several of them still do not accept
 * WebP — an icon that fails to decode is a blank app tile on somebody's home screen.
 */
const ICONS = 'icons/'

/**
 * Referenced by nothing in `src/` or `src-admin/` — verified by grepping every string and
 * template literal that builds a path under `public/`. They are 5.6 MB of the deploy and zero
 * bytes of what a learner downloads, so they are skipped rather than converted: re-encoding an
 * image no screen asks for would only add a second dead file beside the first.
 *
 * They are still in git. Removing them from the working tree is a deliberate call for whoever
 * knows whether a feature is coming that wants them back.
 */
const UNREFERENCED = ['lesson-mascots/', 'lesson/']

/**
 * Longest edge, per directory. Every one of these is generously above the largest size the
 * image is ever *drawn* at, doubled for a 2× screen — the point is to stop shipping a 1254px
 * illustration to a 96px slot, not to cut quality.
 */
const RULES = [
  // Drawn at 56–96px (games shelf, mission brief, lesson scenes). 480 is 2.5× the largest.
  { match: /^characters\//, max: 480, quality: 82 },
  /*
   * The phone mockup on the landing page. It is a tall portrait drawn at `max-w-[19rem]`
   * (304px), so the cap has to clear 608px of *width* on a 2× screen — capping the longest
   * edge instead would have bound the height and left a 210px-wide image to stretch.
   */
  { match: /^mobile\//, max: 890, quality: 80 },
  // A 36px circle beside the tutor's messages in the player.
  { match: /^tutor-avatar\./, max: 192, quality: 80 },
  // Reels: small cards in a marquee that scrolls past.
  { match: /^reels\//, max: 360, quality: 75 },
  { match: /^games\//, max: 848, quality: 78 },
  { match: /^lesson-scenes\//, max: 640, quality: 78 },
]

function ruleFor(relative) {
  const posix = relative.split(path.sep).join('/')
  return RULES.find((rule) => rule.match.test(posix)) ?? { max: 1024, quality: 80 }
}

async function* rasters(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* rasters(full)
    } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
      yield full
    }
  }
}

async function convertImages() {
  let saved = 0

  for await (const file of rasters(publicDir)) {
    const relative = path.relative(publicDir, file)
    const posix = relative.split(path.sep).join('/')
    if (posix.startsWith(ICONS)) continue
    if (UNREFERENCED.some((dir) => posix.startsWith(dir))) continue

    const target = file.replace(/\.(png|jpe?g)$/i, '.webp')
    const rule = ruleFor(relative)
    const before = (await fs.stat(file)).size

    await sharp(file)
      // `withoutEnlargement` so a source already smaller than the cap is re-encoded, not
      // upscaled into a bigger file than it started as.
      .resize({ width: rule.max, height: rule.max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: rule.quality, effort: 6 })
      .toFile(target)

    const after = (await fs.stat(target)).size
    saved += before - after

    console.log(
      `${String(Math.round(before / 1024)).padStart(5)} KB → ${String(Math.round(after / 1024)).padStart(4)} KB  ${relative}`,
    )

    if (prune) await fs.unlink(file)
  }

  console.log(`\nimages: ${Math.round(saved / 1024)} KB saved`)
}

/**
 * The onboarding brief, in the two formats that between them cover every browser a learner
 * might open this in.
 *
 * Opus is what Android, Chrome, Firefox and Edge get: 22 seconds of mono speech lands around
 * 40 KB at 24 kbps, which is transparent for a voice. Safari does not reliably decode Opus in
 * an Ogg container, so it gets an MP3 — bigger, but still a twentieth of the WAV. The picker
 * is `pickAudioSource` in `src/lib/audio-source.ts`.
 */
async function convertAudio() {
  const sources = (await fs.readdir(path.join(publicDir, 'audio'))).filter((name) =>
    name.endsWith('.wav'),
  )

  for (const name of sources) {
    const file = path.join(publicDir, 'audio', name)
    const before = (await fs.stat(file)).size
    const stem = file.replace(/\.wav$/, '')

    await run(ffmpeg, ['-y', '-i', file, '-c:a', 'libopus', '-b:a', '24k', '-ac', '1', `${stem}.opus`])
    await run(ffmpeg, ['-y', '-i', file, '-c:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', `${stem}.mp3`])

    const opus = (await fs.stat(`${stem}.opus`)).size
    const mp3 = (await fs.stat(`${stem}.mp3`)).size

    console.log(
      `${String(Math.round(before / 1024)).padStart(5)} KB → ${Math.round(opus / 1024)} KB opus / ${Math.round(mp3 / 1024)} KB mp3  audio/${name}`,
    )

    if (prune) await fs.unlink(file)
  }
}

await convertImages()
await convertAudio()
