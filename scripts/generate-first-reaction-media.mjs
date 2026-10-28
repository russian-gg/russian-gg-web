import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import ffmpeg from 'ffmpeg-static'

const run = promisify(execFile)
sharp.cache(false)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = path.join(root, 'public/games/first-reaction/media-v2')
const content = JSON.parse(await fs.readFile(path.join(root, '../russian-gg-server/src/RussianGg.Application/SpeakingGames/Data/content.json'), 'utf8'))
const sceneNames = [...new Set(content.situations.map(({ scene }) => scene.replace(/\.gif$/, '')))]
const width = 640
const height = 360
const frames = 12
const fps = 6
const durationMs = frames / fps * 1000
const availableOnly = process.argv.includes('--available')
const force = process.argv.includes('--force')
const checkOnly = process.argv.includes('--check')
const selected = process.argv.find((arg) => arg.startsWith('--scene='))?.slice(8)
if (sceneNames.length !== 60 || sceneNames.some((name) => !/^[a-z0-9_]+$/.test(name)) || selected && !sceneNames.includes(selected)) throw new Error('Invalid first reaction scene inventory')
await fs.mkdir(output, { recursive: true })
const exists = async (file) => fs.stat(file).then(() => true, () => false)
const validAnimation = async (file) => {
  try {
    const metadata = await sharp(file, { animated: true }).metadata()
    return metadata.width === width && metadata.pageHeight === height && metadata.pages === frames && metadata.loop === 0
      && Math.abs(metadata.delay.reduce((sum, delay) => sum + delay, 0) - durationMs) <= 2
  } catch { return false }
}
const scenes = []
for (const name of sceneNames.filter((name) => !selected || selected === name)) {
  const poster = path.join(output, `${name}.webp`)
  if (!await exists(poster)) {
    if (availableOnly) continue
    throw new Error(`Missing generated scene poster: ${poster}`)
  }
  const metadata = await sharp(poster).metadata()
  if (metadata.width !== width || metadata.height !== height || metadata.pages > 1) throw new Error(`Invalid poster: ${name}`)
  scenes.push(name)
}
const filter = `scale=1280:720,zoompan=z='1.025+0.006*(1-cos(2*PI*on/${frames}))':x='iw/2-iw/(zoom*2)+3*sin(2*PI*on/${frames})':y='ih/2-ih/(zoom*2)':d=1:s=${width}x${height}:fps=${fps}`
const priority = ['talking_cat', 'promotion', 'lost_wallet', 'missed_plane', 'million_win']
const queue = [...scenes].sort((left, right) => (priority.includes(left) ? priority.indexOf(left) : priority.length) - (priority.includes(right) ? priority.indexOf(right) : priority.length))
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let name; (name = queue.shift());) {
    const poster = path.join(output, `${name}.webp`)
    const animation = path.join(output, `${name}.anim.webp`)
    const current = await exists(animation) && (await fs.stat(animation)).mtimeMs >= (await fs.stat(poster)).mtimeMs && await validAnimation(animation)
    if (!checkOnly && (force || !current)) {
      const temporary = `${animation}.partial.webp`
      await run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', String(fps), '-t', String(durationMs / 1000), '-i', poster,
        '-vf', filter, '-frames:v', String(frames), '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '60', '-compression_level', '6', '-loop', '0', '-an', '-vsync', '0', temporary], { timeout: 120000, maxBuffer: 1024 * 1024 })
      if (!await validAnimation(temporary)) throw new Error(`Invalid generated animation: ${name}`)
      await fs.rename(temporary, animation)
    }
    if (!await validAnimation(animation)) throw new Error(`Invalid animation: ${name}`)
    process.stdout.write(`${name}: ${(await fs.stat(animation)).size} bytes\n`)
  }
}))
if (!availableOnly && !selected || scenes.length === sceneNames.length) {
  const items = await Promise.all(sceneNames.map(async (name) => ({
    scene: `${name}.gif`,
    animation: `${name}.anim.webp`,
    poster: `${name}.webp`,
    bytes: (await fs.stat(path.join(output, `${name}.anim.webp`))).size,
  })))
  await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ width, height, frames, durationMs, format: 'animated-webp', animation: 'seamless camera drift', scenes: items }, null, 2) + '\n')
}
process.stdout.write(`Validated ${scenes.length}/${sceneNames.length} lifelike scenes.\n`)
