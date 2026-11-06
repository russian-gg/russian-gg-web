/**
 * Лёд и род, the world and how it is drawn — shared by the game and by the moving preview on
 * the games page, so the preview is the game's own picture and not a likeness of it.
 *
 * Nothing in here touches React or the DOM beyond the canvas it is handed.
 */

export type Gender = 'masculine' | 'feminine' | 'neuter'
export type Phase = 'ready' | 'playing' | 'paused' | 'falling' | 'gameover'

export type Word = {
  text: string
  gender: Gender
}

export type TrackItem = {
  lane: number
  z: number
  hit?: boolean
}

export type World = {
  lane: number
  displayedLane: number
  word: Word
  options: Gender[]
  gateZ: number
  obstacles: TrackItem[]
  coins: TrackItem[]
  jumpUntil: number
  score: number
  collected: number
  lives: number
  distance: number
  animationTime: number
  nextObstacleAt: number
  nextCoinAt: number
  lastTime: number
  fallStartedAt: number
}

export const GENDERS: Record<Gender, { label: string; short: string; color: string }> = {
  masculine: { label: 'МУЖСКОЙ РОД', short: 'МУЖСКОЙ', color: '#147aff' },
  feminine: { label: 'ЖЕНСКИЙ РОД', short: 'ЖЕНСКИЙ', color: '#ff4364' },
  neuter: { label: 'СРЕДНИЙ РОД', short: 'СРЕДНИЙ', color: '#ffc928' },
}

export const RUNNER_LANES: Gender[] = ['feminine', 'masculine', 'neuter']

export const WORDS: Word[] = [
  { text: 'ПЕРСИК', gender: 'masculine' },
  { text: 'ДОМ', gender: 'masculine' },
  { text: 'СТОЛ', gender: 'masculine' },
  { text: 'ХЛЕБ', gender: 'masculine' },
  { text: 'ДЕНЬ', gender: 'masculine' },
  { text: 'ГОРОД', gender: 'masculine' },
  { text: 'СЛОН', gender: 'masculine' },
  { text: 'СТУЛ', gender: 'masculine' },
  { text: 'ЛЕС', gender: 'masculine' },
  { text: 'КОТ', gender: 'masculine' },
  { text: 'ДРУГ', gender: 'masculine' },
  { text: 'КАРАНДАШ', gender: 'masculine' },
  { text: 'САМОЛЁТ', gender: 'masculine' },
  { text: 'АВТОБУС', gender: 'masculine' },
  { text: 'СНЕГ', gender: 'masculine' },
  { text: 'ДОЖДЬ', gender: 'masculine' },
  { text: 'ЧАЙ', gender: 'masculine' },
  { text: 'ОГОНЬ', gender: 'masculine' },
  { text: 'КНИГА', gender: 'feminine' },
  { text: 'МАШИНА', gender: 'feminine' },
  { text: 'КОШКА', gender: 'feminine' },
  { text: 'СОБАКА', gender: 'feminine' },
  { text: 'РЕКА', gender: 'feminine' },
  { text: 'ЗЕМЛЯ', gender: 'feminine' },
  { text: 'ТЕТРАДЬ', gender: 'feminine' },
  { text: 'НОЧЬ', gender: 'feminine' },
  { text: 'ЛУНА', gender: 'feminine' },
  { text: 'ЗВЕЗДА', gender: 'feminine' },
  { text: 'ШКОЛА', gender: 'feminine' },
  { text: 'СТРАНА', gender: 'feminine' },
  { text: 'ДВЕРЬ', gender: 'feminine' },
  { text: 'РЫБА', gender: 'feminine' },
  { text: 'ЧАШКА', gender: 'feminine' },
  { text: 'ВОДА', gender: 'feminine' },
  { text: 'СЕМЬЯ', gender: 'feminine' },
  { text: 'ЯБЛОКО', gender: 'neuter' },
  { text: 'СОЛНЦЕ', gender: 'neuter' },
  { text: 'ОКНО', gender: 'neuter' },
  { text: 'МОРЕ', gender: 'neuter' },
  { text: 'ПИСЬМО', gender: 'neuter' },
  { text: 'ДЕРЕВО', gender: 'neuter' },
  { text: 'КОЛЬЦО', gender: 'neuter' },
  { text: 'ИМЯ', gender: 'neuter' },
  { text: 'ВРЕМЯ', gender: 'neuter' },
  { text: 'ОБЛАКО', gender: 'neuter' },
  { text: 'ПЛАТЬЕ', gender: 'neuter' },
  { text: 'ЗЕРКАЛО', gender: 'neuter' },
  { text: 'УТРО', gender: 'neuter' },
  { text: 'ПАЛЬТО', gender: 'neuter' },
  { text: 'ОЗЕРО', gender: 'neuter' },
]

export function randomWord(previous?: string) {
  const available = WORDS.filter((word) => word.text !== previous)
  return available[Math.floor(Math.random() * available.length)]
}

export function makeWorld(): World {
  return {
    lane: 1,
    displayedLane: 1,
    word: randomWord(),
    options: [...RUNNER_LANES],
    gateZ: 1,
    obstacles: [{ lane: 0, z: 0.58 }, { lane: 2, z: 0.88 }],
    coins: makeCoinWave(0.28, 2),
    jumpUntil: 0,
    score: 0,
    collected: 0,
    lives: 3,
    distance: 0,
    animationTime: 0,
    nextObstacleAt: 0.68,
    nextCoinAt: 0.62,
    lastTime: performance.now(),
    fallStartedAt: 0,
  }
}

export function makeCoinWave(startZ: number, repeats = 2): TrackItem[] {
  const zigzag = [0, 1, 2, 2, 1, 0, 0, 1, 2]
  const count = repeats === 3 ? 9 : 6
  return zigzag.slice(0, count).map((lane, index) => ({ lane, z: startZ + index * 0.09 }))
}

/**
 * `compact` is for small canvases (the games page previews): the game is laid out for a
 * screen-sized canvas, where the word sign, the penguin and the ice keep a fixed pixel size.
 * In a card that size swallows the scene, so here they scale with the canvas instead.
 */
export function drawWorld(context: CanvasRenderingContext2D, width: number, height: number, world: World, phase: Phase, now: number, compact = false) {
  const unit = compact ? height / 350 : 1
  context.clearRect(0, 0, width, height)
  const horizon = height * 0.42
  const bottom = height * 0.96
  const center = width / 2
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#00b4d8')
  sky.addColorStop(.5, '#90e0ef')
  sky.addColorStop(1, '#e4faff')
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)
  const canyon = getRunnerCanyon()
  if (canyon.complete && canyon.naturalWidth) {
    const scale = Math.max(width / canyon.naturalWidth, height / canyon.naturalHeight) * 1.04
    const w = canyon.naturalWidth * scale
    const h = canyon.naturalHeight * scale
    const drift = Math.sin(world.distance * .08) * width * .008 - (world.displayedLane - 1) * width * .006
    context.drawImage(canyon, (width - w) / 2 + drift, (height - h) / 2, w, h)
  }
  const aurora = context.createLinearGradient(0, 0, width, horizon)
  aurora.addColorStop(0, '#afffe000')
  aurora.addColorStop(.5, '#b0ffe644')
  aurora.addColorStop(1, '#afffe000')
  context.save()
  context.strokeStyle = aurora
  context.lineWidth = height * .025
  context.filter = 'blur(7px)'
  context.beginPath()
  context.moveTo(0, horizon * .3)
  context.bezierCurveTo(width * .3, horizon * (.05 + Math.sin(world.animationTime * .00015) * .08), width * .6, horizon * .65, width, horizon * .15)
  context.stroke()
  context.restore()

  world.options.forEach((gender, lane) => {
    const color = GENDERS[gender].color
    const farLeft = center + (lane - 1.5) * width * .035
    const farRight = center + (lane - .5) * width * .035
    const nearLeft = center + (lane - 1.5) * width * .285
    const nearRight = center + (lane - .5) * width * .285
    const ice = context.createLinearGradient(0, horizon, 0, bottom)
    ice.addColorStop(0, '#e6fcffb0')
    ice.addColorStop(.5, '#d7f8ff80')
    ice.addColorStop(1, `${color}30`)
    context.fillStyle = ice
    context.beginPath()
    context.moveTo(farLeft, horizon)
    context.lineTo(farRight, horizon)
    context.lineTo(nearRight, bottom)
    context.lineTo(nearLeft, bottom)
    context.closePath()
    context.fill()
    context.save()
    context.strokeStyle = color
    context.lineWidth = Math.max(2, width * .003)
    context.shadowColor = color
    context.shadowBlur = world.lane === lane ? 20 : 9
    context.globalAlpha = world.lane === lane ? .95 : .55
    for (const [a, b] of [[farLeft, nearLeft], [farRight, nearRight]]) {
      context.beginPath()
      context.moveTo(a, horizon)
      context.lineTo(b, bottom)
      context.stroke()
    }
    context.restore()
  })
  for (let index = 0; index < 22; index++) {
    const depth = (index / 22 + world.distance * .18) % 1
    const y = horizon + depth ** 2 * (bottom - horizon)
    const half = width * (.052 + depth ** 2 * .375)
    context.strokeStyle = `rgba(255,255,255,${.12 + depth * .3})`
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(center - half, y)
    context.bezierCurveTo(center - half * .3, y - depth * 10, center + half * .2, y + depth * 6, center + half, y)
    context.stroke()
  }
  for (const coin of world.coins) {
    if (coin.z > 1.04) continue
    const point = project(coin.lane - 1, coin.z, width, height)
    drawCoin(context, point.x, point.y - 24 * point.scale * unit, point.scale * unit, now)
  }

  for (const obstacle of world.obstacles) {
    if (obstacle.z > 1.04) continue
    const point = project(obstacle.lane - 1, obstacle.z, width, height)
    drawIceBlock(context, point.x, point.y, point.scale * unit)
  }

  drawApproachingWord(context, width, height, world, compact)

  const jumpProgress = world.jumpUntil > now ? 1 - (world.jumpUntil - now) / 700 : 0
  const jumpHeight = world.jumpUntil > now ? Math.sin(jumpProgress * Math.PI) * height * 0.14 : 0
  const fallProgress = phase === 'falling' ? Math.min(1, (now - world.fallStartedAt) / 1500) : 0
  const slideDepth = fallProgress < 0.58 ? fallProgress / 0.58 * 0.48 : 0.48
  const player = project(world.displayedLane - 1, 0.03 + slideDepth, width, height)
  const drop = fallProgress > 0.58 ? ((fallProgress - 0.58) / 0.42) ** 2 * height * 0.7 : 0
  if (phase === 'falling') drawIceHole(context, player.x, player.y + 22, Math.max(0.45, player.scale))
  const shadowScale = 1 - (jumpHeight / (height * 0.14)) * 0.35
  context.save()
  context.fillStyle = 'rgba(12,61,87,.36)'
  context.filter = 'blur(1px)'
  context.beginPath()
  context.ellipse(player.x + 15 * unit, player.y + 7 * unit, 42 * shadowScale * unit, 10 * shadowScale * unit, -.12, 0, Math.PI * 2)
  context.fill()
  context.restore()
  if (phase === 'playing' && jumpHeight < 8) {
    for (let i = 0; i < 12; i++) {
      const age = (world.animationTime * .002 + i / 12) % 1
      context.fillStyle = `rgba(240,254,255,${1 - age})`
      context.beginPath()
      context.ellipse(player.x + (i % 2 ? 1 : -1) * (12 + age * 36), player.y + age * 30 - Math.sin(age * Math.PI) * 18, 1 + age * 3, 2 + age * 2, age * 4, 0, Math.PI * 2)
      context.fill()
    }
  }
  drawProjectPenguin(
    context,
    player.x,
    player.y - jumpHeight + drop,
    (compact ? height / 360 : Math.max(0.8, Math.min(1.45, width / 390))) * (1 - fallProgress * 0.35),
    phase === 'playing',
    world.animationTime,
    Math.max(0, world.jumpUntil - now),
    world.lane - world.displayedLane,
    -fallProgress * 1.1,
  )
  for (let i = 0; i < 35; i++) {
    const age = (world.animationTime * .00006 * (1 + i % 3) + i / 35) % 1
    const x = ((i * 139.3) % width + age * 30) % width
    const y = age * height
    context.fillStyle = `rgba(255,255,255,${.25 + age * .6})`
    context.beginPath()
    context.arc(x, y, .6 + age * 2.1, 0, Math.PI * 2)
    context.fill()
  }
}

function project(lane: number, z: number, width: number, height: number) {
  const clamped = Math.max(0, Math.min(1, z))
  const depth = 1 - clamped
  const horizon = height * 0.42
  const bottom = height * 0.91
  const spacing = width * (0.035 + depth * 0.245)
  return {
    x: width / 2 + lane * spacing,
    y: horizon + depth * (bottom - horizon),
    scale: 0.12 + depth * 0.88,
  }
}

function drawApproachingWord(context: CanvasRenderingContext2D, width: number, height: number, world: World, compact = false) {
  const depth = Math.max(0, Math.min(1, 1 - world.gateZ))
  const scale = .64 + depth * .58
  const y = compact ? height * .2 + depth * height * .03 : Math.max(104, height * .18) + depth * Math.min(18, height * .025)
  context.save()
  context.translate(width / 2, y)
  context.scale(scale, scale)
  context.font = `950 ${compact ? Math.min(height * .1, 34) : Math.min(34, width * .074)}px Nunito, sans-serif`
  const wordWidth = context.measureText(world.word.text).width + 42
  context.fillStyle = '#ffffffea'
  context.shadowColor = '#03577b44'
  context.shadowBlur = 24
  context.shadowOffsetY = 8
  roundRect(context, -wordWidth / 2, -29, wordWidth, 58, 18)
  context.fill()
  context.shadowBlur = 0
  context.shadowOffsetY = 0
  context.strokeStyle = '#ffffff'
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = '#124967'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(world.word.text, 0, 1)
  context.restore()
}

let runnerCanyon: HTMLImageElement | null = null
function getRunnerCanyon() {
  if (!runnerCanyon) {
    runnerCanyon = new Image()
    runnerCanyon.decoding = 'async'
    runnerCanyon.src = '/games/rod-runner/sunny-canyon.webp'
  }
  return runnerCanyon
}

function drawCoin(context: CanvasRenderingContext2D, x: number, y: number, scale: number, now: number) {
  const width = Math.max(2.2, Math.abs(Math.cos(now / 240)) * 13)
  context.save()
  context.translate(x, y)
  context.scale(scale, scale)
  const edge = context.createLinearGradient(-width, -15, width, 15)
  edge.addColorStop(0, '#fff6b5')
  edge.addColorStop(.4, '#f7b42b')
  edge.addColorStop(.7, '#9e540b')
  edge.addColorStop(1, '#ffdc69')
  context.fillStyle = edge
  context.shadowColor = '#ffdd6480'
  context.shadowBlur = 8
  context.beginPath()
  context.ellipse(1.8, 1, width + 1, 15, 0, 0, Math.PI * 2)
  context.fill()
  context.shadowBlur = 0
  const gold = context.createLinearGradient(-width, -14, width, 14)
  gold.addColorStop(0, '#fffde0')
  gold.addColorStop(.25, '#ffe789')
  gold.addColorStop(.5, '#ffbc26')
  gold.addColorStop(.75, '#fff1a0')
  gold.addColorStop(1, '#e9940f')
  context.fillStyle = gold
  context.strokeStyle = '#ffed9c'
  context.lineWidth = 1.2
  context.beginPath()
  context.ellipse(0, 0, width, 14.5, 0, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.strokeStyle = '#b86c2590'
  context.lineWidth = .9
  context.beginPath()
  context.ellipse(0, 0, width * .76, 11.5, 0, 0, Math.PI * 2)
  context.stroke()
  if (width > 4) {
    context.save()
    context.scale(width / 13, 1)
    context.fillStyle = '#ba730c'
    context.beginPath()
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5 - Math.PI / 2
      const radius = i % 2 ? 3 : 6.5
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
    }
    context.closePath()
    context.fill()
    context.restore()
  }
  const glint = .45 + Math.sin(now / 180 + x) * .35
  context.strokeStyle = `rgba(255,255,240,${glint})`
  context.lineWidth = 1.8
  context.beginPath()
  context.ellipse(0, 0, width * .87, 13, 0, Math.PI * 1.08, Math.PI * 1.68)
  context.stroke()
  if (scale > .45 && width > 8) {
    context.strokeStyle = `rgba(255,255,255,${glint})`
    context.lineWidth = 1.3
    context.beginPath()
    context.moveTo(-width * .65 - 3, -10)
    context.lineTo(-width * .65 + 3, -10)
    context.moveTo(-width * .65, -14)
    context.lineTo(-width * .65, -6)
    context.stroke()
  }
  context.restore()
}

function drawIceBlock(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const block = context.createLinearGradient(x, y - 36 * scale, x, y)
  block.addColorStop(0, '#ecfeff')
  block.addColorStop(0.48, '#67e8f9')
  block.addColorStop(1, '#0284c7')
  context.fillStyle = block
  context.strokeStyle = '#cffafe'
  context.lineWidth = Math.max(1, 2 * scale)
  context.beginPath()
  context.moveTo(x - 30 * scale, y)
  context.lineTo(x - 22 * scale, y - 25 * scale)
  context.lineTo(x - 8 * scale, y - 18 * scale)
  context.lineTo(x + 2 * scale, y - 36 * scale)
  context.lineTo(x + 16 * scale, y - 20 * scale)
  context.lineTo(x + 30 * scale, y)
  context.closePath()
  context.fill()
  context.stroke()
}

function drawIceHole(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.fillStyle = 'rgba(2,30,55,.92)'
  context.strokeStyle = '#d9fbff'
  context.lineWidth = Math.max(2, 4 * scale)
  context.beginPath()
  context.ellipse(x, y, 42 * scale, 14 * scale, 0, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.strokeStyle = 'rgba(224,251,255,.9)'
  context.lineWidth = Math.max(1, 2 * scale)
  for (const direction of [-1, 1]) {
    context.beginPath()
    context.moveTo(x + direction * 32 * scale, y)
    context.lineTo(x + direction * 53 * scale, y - 12 * scale)
    context.lineTo(x + direction * 70 * scale, y - 7 * scale)
    context.stroke()
  }
}

let runnerPenguins: { forward: HTMLImageElement; turning: HTMLImageElement } | null = null

export function getRunnerPenguins() {
  if (!runnerPenguins && typeof Image !== 'undefined') {
    const forward = new Image()
    const turning = new Image()
    forward.decoding = turning.decoding = 'async'
    forward.src = '/games/rod-runner/runner-penguin-forward-sprites.png'
    turning.src = '/games/rod-runner/runner-penguin-sprites.png'
    runnerPenguins = { forward, turning }
  }
  return runnerPenguins
}

function drawProjectPenguin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  running: boolean,
  animationTime: number,
  jumpRemaining: number,
  laneDelta: number,
  rotation: number,
) {
  const sprites = getRunnerPenguins()
  const facing = Math.abs(laneDelta) < 0.02 ? 'forward' : laneDelta < 0 ? 'left' : 'right'
  const preferred = facing === 'forward' ? sprites?.forward : sprites?.turning
  const alternate = facing === 'forward' ? sprites?.turning : sprites?.forward
  const image = preferred?.complete && preferred.naturalWidth > 0 ? preferred : alternate
  context.save()
  context.translate(x, y)
  context.scale(scale, scale)
  context.rotate(rotation + laneDelta * 0.18)
  if (image?.complete && image.naturalWidth > 0) {
    const frame = jumpRemaining > 0
      ? jumpRemaining > 550 ? 6 : 7
      : running ? Math.floor(animationTime * 0.012) % 6 : 0
    const frameWidth = image.naturalWidth / 4
    const frameHeight = image.naturalHeight / 2
    if (facing === 'left') context.scale(-1, 1)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'medium'
    context.drawImage(
      image,
      (frame % 4) * frameWidth, Math.floor(frame / 4) * frameHeight,
      frameWidth, frameHeight,
      -68, -128, 136, 136,
    )
  } else {
    drawFallbackPenguin(context)
  }
  context.restore()
}

function drawFallbackPenguin(context: CanvasRenderingContext2D) {
  context.fillStyle = '#172554'
  context.beginPath()
  context.ellipse(0, -39, 27, 45, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fff7dc'
  context.beginPath()
  context.ellipse(0, -34, 18, 33, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f59e0b'
  context.beginPath()
  context.moveTo(-4, -50)
  context.lineTo(18, -43)
  context.lineTo(-4, -36)
  context.closePath()
  context.fill()
  context.fillStyle = '#1d4ed8'
  roundRect(context, -21, -24, 42, 24, 7)
  context.fill()
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, Math.max(1, radius))
}

/**
 * One step of a run with nobody at the keys, for the previews: the bot reads the word, moves
 * to its lane once it is close enough to read, and jumps the ice in its own lane. It never
 * loses, and the step returns whether the word it just passed scored.
 */
export function advanceDemo(world: World, now: number): boolean {
  const delta = Math.min(40, Math.max(0, now - world.lastTime))
  world.lastTime = now
  world.animationTime += delta
  const step = delta * 0.00028
  world.distance += step
  world.gateZ -= step
  world.displayedLane += (world.lane - world.displayedLane) * Math.min(1, delta / 100)
  world.obstacles.forEach((item) => { item.z -= step })
  world.coins.forEach((item) => { item.z -= step })
  if (world.distance >= world.nextCoinAt) {
    world.coins.push(...makeCoinWave(1, Math.random() > 0.5 ? 3 : 2))
    world.nextCoinAt = world.distance + 0.56 + Math.random() * 0.28
  }
  if (world.distance >= world.nextObstacleAt) {
    world.obstacles.push({ lane: Math.floor(Math.random() * 3), z: 1 })
    world.nextObstacleAt = world.distance + 0.72 + Math.random() * 0.35
  }
  if (world.gateZ < 0.62) world.lane = world.options.indexOf(world.word.gender)
  for (const item of world.obstacles) {
    if (item.lane === world.lane && item.z < 0.2 && item.z > 0.1 && world.jumpUntil <= now) world.jumpUntil = now + 700
  }
  world.coins = world.coins.filter((item) => item.z > -0.12 && !(item.z < 0.1 && item.lane === world.lane))
  world.obstacles = world.obstacles.filter((item) => item.z > -0.12)
  if (world.gateZ > 0.08) return false
  world.score += 1
  world.word = randomWord(world.word.text)
  world.gateZ = 1
  return true
}
