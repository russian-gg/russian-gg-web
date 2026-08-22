import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { playUiSound } from '../../lib/ui-sounds'
import { cx } from '../../lib/cx'

type Gender = 'masculine' | 'feminine' | 'neuter'
type Phase = 'ready' | 'playing' | 'paused' | 'gameover'

type Word = {
  text: string
  gender: Gender
}

type TrackItem = {
  lane: number
  z: number
  hit?: boolean
}

type World = {
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
  nextObstacleAt: number
  nextCoinAt: number
  lastTime: number
}

const GENDERS: Record<Gender, { label: string; short: string; color: string }> = {
  masculine: { label: 'Мужской род', short: 'МУЖСКОЙ', color: '#0000FF' },
  feminine: { label: 'Женский род', short: 'ЖЕНСКИЙ', color: '#FF2400' },
  neuter: { label: 'Средний род', short: 'СРЕДНИЙ', color: '#D6A800' },
}

const WORDS: Word[] = [
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

function randomWord(previous?: string) {
  const available = WORDS.filter((word) => word.text !== previous)
  return available[Math.floor(Math.random() * available.length)]
}

function shuffledGenders() {
  return (['masculine', 'feminine', 'neuter'] as Gender[])
    .map((gender) => ({ gender, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ gender }) => gender)
}

function makeWorld(): World {
  return {
    lane: 1,
    displayedLane: 1,
    word: randomWord(),
    options: shuffledGenders(),
    gateZ: 1,
    obstacles: [],
    coins: [],
    jumpUntil: 0,
    score: 0,
    collected: 0,
    lives: 3,
    distance: 0,
    nextObstacleAt: 2.8,
    nextCoinAt: 1.2,
    lastTime: performance.now(),
  }
}

export function GenderRunnerGame() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World>(makeWorld())
  const phaseRef = useRef<Phase>('ready')
  const [phase, setPhase] = useState<Phase>('ready')
  const [status, setStatus] = useState({
    score: 0,
    coins: 0,
    lives: 3,
    word: worldRef.current.word,
    message: '',
    messageKind: '' as '' | 'correct' | 'wrong',
  })
  const [highScore, setHighScore] = useState(() => {
    const saved = Number(localStorage.getItem('rgg_gender_runner_highscore'))
    return Number.isFinite(saved) ? saved : 0
  })

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const endGame = useCallback(() => {
    const score = worldRef.current.score
    const nextHigh = Math.max(score, highScore)
    if (nextHigh !== highScore) {
      setHighScore(nextHigh)
      localStorage.setItem('rgg_gender_runner_highscore', String(nextHigh))
    }
    changePhase('gameover')
  }, [changePhase, highScore])

  const loseLife = useCallback((message: string) => {
    const world = worldRef.current
    world.lives -= 1
    playUiSound('wrong')
    setStatus((current) => ({
      ...current,
      lives: world.lives,
      message,
      messageKind: 'wrong',
    }))
    if (world.lives <= 0) endGame()
  }, [endGame])

  const start = useCallback(() => {
    worldRef.current = makeWorld()
    const world = worldRef.current
    setStatus({ score: 0, coins: 0, lives: 3, word: world.word, message: '', messageKind: '' })
    changePhase('playing')
  }, [changePhase])

  const move = useCallback((direction: -1 | 1) => {
    if (phaseRef.current !== 'playing') return
    const world = worldRef.current
    const next = Math.max(0, Math.min(2, world.lane + direction))
    if (next === world.lane) return
    world.lane = next
    playUiSound('whoosh')
  }, [])

  const jump = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const world = worldRef.current
    const now = performance.now()
    if (world.jumpUntil > now) return
    world.jumpUntil = now + 700
    playUiSound('jump')
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') move(-1)
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') move(1)
      if (event.key === ' ' || event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') {
        event.preventDefault()
        jump()
      }
      if (event.key === 'Escape') {
        if (phaseRef.current === 'playing') changePhase('paused')
        else if (phaseRef.current === 'paused') changePhase('playing')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [changePhase, jump, move])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrame = 0
    let messageTimer = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const showMessage = (message: string, kind: 'correct' | 'wrong') => {
      window.clearTimeout(messageTimer)
      setStatus((current) => ({ ...current, message, messageKind: kind }))
      messageTimer = window.setTimeout(() => {
        setStatus((current) => ({ ...current, message: '', messageKind: '' }))
      }, 1200)
    }

    const nextGate = () => {
      const world = worldRef.current
      world.word = randomWord(world.word.text)
      world.options = shuffledGenders()
      world.gateZ = 1
      setStatus((current) => ({ ...current, word: world.word }))
    }

    const update = (now: number) => {
      const world = worldRef.current
      const delta = Math.min(40, Math.max(0, now - world.lastTime))
      world.lastTime = now
      if (phaseRef.current !== 'playing') return

      const step = delta * 0.00014
      world.distance += step
      world.displayedLane += (world.lane - world.displayedLane) * Math.min(1, delta / 100)
      world.gateZ -= step
      world.obstacles.forEach((item) => { item.z -= step })
      world.coins.forEach((item) => { item.z -= step })

      if (world.distance >= world.nextCoinAt) {
        world.coins.push({ lane: Math.floor(Math.random() * 3), z: 1 })
        world.nextCoinAt = world.distance + 0.75 + Math.random() * 0.45
      }
      if (world.distance >= world.nextObstacleAt) {
        world.obstacles.push({ lane: Math.floor(Math.random() * 3), z: 1 })
        world.nextObstacleAt = world.distance + 1.6 + Math.random() * 0.7
      }

      for (const coin of world.coins) {
        if (!coin.hit && coin.z < 0.1 && coin.z > -0.04 && coin.lane === world.lane) {
          coin.hit = true
          world.collected += 1
          playUiSound('coin')
          setStatus((current) => ({ ...current, coins: world.collected }))
        }
      }

      for (const obstacle of world.obstacles) {
        if (!obstacle.hit && obstacle.z < 0.1 && obstacle.z > -0.04 && obstacle.lane === world.lane) {
          obstacle.hit = true
          if (world.jumpUntil <= now) loseLife('To‘siqqa urildingiz — sakrashni unutmang!')
        }
      }

      world.coins = world.coins.filter((item) => item.z > -0.12 && !item.hit)
      world.obstacles = world.obstacles.filter((item) => item.z > -0.12)

      if (world.gateZ <= 0.08) {
        const chosen = world.options[world.lane]
        if (chosen === world.word.gender) {
          world.score += 1
          playUiSound('correct')
          setStatus((current) => ({ ...current, score: world.score }))
          showMessage('To‘g‘ri rod! +1', 'correct')
        } else {
          loseLife(`Xato: «${world.word.text}» — ${GENDERS[world.word.gender].label}`)
        }
        if (world.lives > 0) nextGate()
      }
    }

    const loop = (now: number) => {
      update(now)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      drawWorld(context, canvas.width / ratio, canvas.height / ratio, worldRef.current, phaseRef.current, now)
      animationFrame = requestAnimationFrame(loop)
    }

    animationFrame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.clearTimeout(messageTimer)
      observer.disconnect()
    }
  }, [loseLife])

  const lifeMarks = Array.from({ length: 3 }, (_, index) => index < status.lives ? '❤️' : '🖤')

  return (
    <main className="min-h-[100dvh] bg-[#0b0f19] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => navigate('/games')} className="text-sm font-black text-white/75 hover:text-white">
            ← O‘yinlar
          </button>
          <div className="flex items-center gap-3 text-xs font-black sm:text-sm">
            <span>⭐ {status.score}</span>
            <span>🪙 {status.coins}</span>
            <span aria-label={`${status.lives} ta jon`}>{lifeMarks.join(' ')}</span>
          </div>
        </header>

        <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-2 sm:p-4">
          <canvas ref={canvasRef} className="aspect-[4/3] max-h-[calc(100dvh-168px)] w-full max-w-5xl rounded-2xl bg-[#0b0f19] sm:aspect-[16/10]" />

          <div className="pointer-events-none absolute top-4 left-1/2 w-[min(88%,520px)] -translate-x-1/2 text-center sm:top-7">
            <p className="text-[10px] font-black tracking-[0.18em] text-amber-200 uppercase">So‘zni to‘g‘ri rod yo‘lagiga olib boring</p>
            <div className="mt-1 rounded-2xl border border-white/20 bg-black/65 px-4 py-2 shadow-2xl backdrop-blur-sm">
              <span className="text-xl font-black tracking-wide sm:text-3xl">{status.word.text}</span>
            </div>
            {status.message && (
              <p className={cx(
                'mt-2 rounded-xl px-3 py-2 text-xs font-black shadow-lg sm:text-sm',
                status.messageKind === 'correct' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white',
              )}>
                {status.message}
              </p>
            )}
          </div>

          {phase === 'ready' && (
            <GameOverlay title="Rod Runner" icon="🏃">
              <p className="max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
                Ruscha otning rodini topib, pingvinni to‘g‘ri yo‘lakka o‘tkazing. Tangalarni yig‘ing va to‘siqlardan sakrang.
              </p>
              <div className="grid w-full max-w-md grid-cols-3 gap-2 text-[11px] font-black sm:text-xs">
                <span className="rounded-xl border border-blue-400 bg-blue-500/20 p-2">← Chap/o‘ng →</span>
                <span className="rounded-xl border border-amber-400 bg-amber-500/20 p-2">↑ Sakrash</span>
                <span className="rounded-xl border border-rose-400 bg-rose-500/20 p-2">3 ta jon</span>
              </div>
              <Button block onClick={start}>O‘yinni boshlash</Button>
            </GameOverlay>
          )}

          {phase === 'paused' && (
            <GameOverlay title="Pauza" icon="⏸️">
              <Button block onClick={() => changePhase('playing')}>Davom etish</Button>
              <button type="button" onClick={start} className="text-sm font-black text-white/70 hover:text-white">Qayta boshlash</button>
            </GameOverlay>
          )}

          {phase === 'gameover' && (
            <GameOverlay title="O‘yin tugadi" icon="🏁">
              <div className="grid w-full max-w-sm grid-cols-3 gap-2">
                <Result label="Ball" value={status.score} />
                <Result label="Tangalar" value={status.coins} />
                <Result label="Rekord" value={highScore} />
              </div>
              <Button block onClick={start}>Yana o‘ynash</Button>
              <button type="button" onClick={() => navigate('/games')} className="text-sm font-black text-white/70 hover:text-white">O‘yinlarga qaytish</button>
            </GameOverlay>
          )}

          {phase === 'playing' && (
            <button
              type="button"
              onClick={() => changePhase('paused')}
              className="absolute top-3 right-3 grid size-10 place-items-center rounded-xl border border-white/20 bg-black/55 text-lg backdrop-blur-sm sm:top-5 sm:right-5"
              aria-label="Pauza"
            >
              ⏸
            </button>
          )}
        </section>

        <div className="grid grid-cols-3 gap-2 border-t border-white/10 bg-[#111827] p-3 sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-t-2xl">
          <ControlButton onClick={() => move(-1)} disabled={phase !== 'playing'} label="Chapga" icon="←" />
          <ControlButton onClick={jump} disabled={phase !== 'playing'} label="Sakrash" icon="↑" accent />
          <ControlButton onClick={() => move(1)} disabled={phase !== 'playing'} label="O‘ngga" icon="→" />
        </div>
      </div>
    </main>
  )
}

function GameOverlay({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="absolute inset-2 z-10 flex items-center justify-center rounded-2xl bg-black/75 p-4 backdrop-blur-sm sm:inset-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border border-white/15 bg-slate-900/95 p-5 text-center shadow-2xl sm:p-7">
        <span className="text-4xl" aria-hidden>{icon}</span>
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Result({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <span className="block text-[10px] font-bold text-white/60 uppercase">{label}</span>
      <strong className="mt-1 block text-xl">{value}</strong>
    </div>
  )
}

function ControlButton({ onClick, disabled, label, icon, accent = false }: {
  onClick: () => void
  disabled: boolean
  label: string
  icon: string
  accent?: boolean
}) {
  return (
    <button
      type="button"
      data-ui-sound="none"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'flex min-h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-black transition active:scale-95 disabled:opacity-35',
        accent ? 'border-amber-400 bg-amber-600 text-white' : 'border-slate-600 bg-slate-800 text-white',
      )}
    >
      <span className="text-xl">{icon}</span>
      <span className="hidden min-[360px]:inline">{label}</span>
    </button>
  )
}

function drawWorld(context: CanvasRenderingContext2D, width: number, height: number, world: World, phase: Phase, now: number) {
  context.clearRect(0, 0, width, height)
  const horizon = height * 0.3
  const bottom = height * 0.96
  const center = width / 2

  const sky = context.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, '#1e3a8a')
  sky.addColorStop(0.55, '#3b82f6')
  sky.addColorStop(1, '#fde68a')
  context.fillStyle = sky
  context.fillRect(0, 0, width, horizon)

  context.fillStyle = '#fef08a'
  context.beginPath()
  context.arc(width * 0.78, horizon * 0.46, Math.max(12, width * 0.035), 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#1e293b'
  context.beginPath()
  context.moveTo(0, horizon)
  for (let x = 0; x <= width; x += Math.max(20, width / 24)) {
    context.lineTo(x, horizon - 10 - Math.sin(x * 0.018) * 18)
  }
  context.lineTo(width, horizon)
  context.closePath()
  context.fill()

  context.fillStyle = '#15803d'
  context.fillRect(0, horizon, width, height - horizon)
  context.fillStyle = '#0284c7'
  context.beginPath()
  context.moveTo(center + width * 0.1, horizon)
  context.lineTo(width, horizon)
  context.lineTo(width, height)
  context.lineTo(width * 0.84, height)
  context.closePath()
  context.fill()

  context.fillStyle = '#b45309'
  context.beginPath()
  context.moveTo(center - width * 0.075, horizon)
  context.lineTo(center + width * 0.075, horizon)
  context.lineTo(center + width * 0.43, bottom)
  context.lineTo(center - width * 0.43, bottom)
  context.closePath()
  context.fill()
  context.strokeStyle = '#78350f'
  context.lineWidth = Math.max(3, width * 0.007)
  context.stroke()

  context.setLineDash([14, 14])
  context.strokeStyle = '#fde68a'
  context.lineWidth = Math.max(1.5, width * 0.003)
  for (const laneLine of [-0.5, 0.5]) {
    context.beginPath()
    context.moveTo(center + laneLine * width * 0.05, horizon)
    context.lineTo(center + laneLine * width * 0.285, bottom)
    context.stroke()
  }
  context.setLineDash([])

  for (let index = 0; index < 10; index += 1) {
    const z = ((index / 10 + world.distance * 0.6) % 1)
    const projected = project(index % 2 === 0 ? -2.4 : 2.4, z, width, height)
    drawTree(context, projected.x, projected.y, projected.scale)
  }

  for (const coin of [...world.coins].sort((a, b) => b.z - a.z)) {
    const point = project(coin.lane - 1, coin.z, width, height)
    drawCoin(context, point.x, point.y - 24 * point.scale, point.scale, now)
  }

  for (const obstacle of [...world.obstacles].sort((a, b) => b.z - a.z)) {
    const point = project(obstacle.lane - 1, obstacle.z, width, height)
    drawLog(context, point.x, point.y, point.scale)
  }

  drawGate(context, width, height, world)

  const jumpProgress = world.jumpUntil > now ? 1 - (world.jumpUntil - now) / 700 : 0
  const jumpHeight = world.jumpUntil > now ? Math.sin(jumpProgress * Math.PI) * height * 0.14 : 0
  const player = project(world.displayedLane - 1, 0.03, width, height)
  drawPenguin(context, player.x, player.y - jumpHeight, Math.max(0.7, width / 620), phase === 'playing', now)
}

function project(lane: number, z: number, width: number, height: number) {
  const clamped = Math.max(0, Math.min(1, z))
  const depth = 1 - clamped
  const horizon = height * 0.3
  const bottom = height * 0.91
  const spacing = width * (0.035 + depth * 0.245)
  return {
    x: width / 2 + lane * spacing,
    y: horizon + depth * (bottom - horizon),
    scale: 0.12 + depth * 0.88,
  }
}

function drawGate(context: CanvasRenderingContext2D, width: number, height: number, world: World) {
  const left = project(-1, world.gateZ, width, height)
  const right = project(1, world.gateZ, width, height)
  const scale = left.scale
  if (scale <= 0.1) return
  const top = left.y - 105 * scale
  const signWidth = Math.max(54, width * 0.18 * scale)
  const signHeight = Math.max(18, 40 * scale)

  context.fillStyle = '#854d0e'
  context.fillRect(left.x - signWidth * 0.7, top, 10 * scale, 105 * scale)
  context.fillRect(right.x + signWidth * 0.7 - 10 * scale, top, 10 * scale, 105 * scale)
  context.fillRect(left.x - signWidth * 0.7, top, right.x - left.x + signWidth * 1.4, 12 * scale)

  world.options.forEach((gender, lane) => {
    const point = project(lane - 1, world.gateZ, width, height)
    const details = GENDERS[gender]
    context.fillStyle = '#fff7dc'
    context.strokeStyle = details.color
    context.lineWidth = Math.max(1.5, 3 * scale)
    roundRect(context, point.x - signWidth / 2, top + 18 * scale, signWidth, signHeight, 8 * scale)
    context.fill()
    context.stroke()
    context.fillStyle = details.color
    context.font = `900 ${Math.max(8, 13 * scale)}px Nunito, sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(details.short, point.x, top + 18 * scale + signHeight / 2)
  })
}

function drawTree(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.fillStyle = '#78350f'
  context.fillRect(x - 4 * scale, y - 34 * scale, 8 * scale, 34 * scale)
  context.fillStyle = '#166534'
  context.beginPath()
  context.arc(x, y - 42 * scale, 23 * scale, 0, Math.PI * 2)
  context.fill()
}

function drawCoin(context: CanvasRenderingContext2D, x: number, y: number, scale: number, now: number) {
  const width = Math.max(3, Math.abs(Math.cos(now / 180)) * 13 * scale)
  context.fillStyle = '#f59e0b'
  context.beginPath()
  context.ellipse(x, y, width, 15 * scale, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#fde047'
  context.beginPath()
  context.ellipse(x, y, width * 0.68, 11 * scale, 0, 0, Math.PI * 2)
  context.fill()
}

function drawLog(context: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  context.fillStyle = '#78350f'
  roundRect(context, x - 28 * scale, y - 14 * scale, 56 * scale, 16 * scale, 6 * scale)
  context.fill()
  context.fillStyle = '#fef3c7'
  context.beginPath()
  context.ellipse(x - 26 * scale, y - 6 * scale, 4 * scale, 7 * scale, 0, 0, Math.PI * 2)
  context.fill()
}

function drawPenguin(context: CanvasRenderingContext2D, x: number, y: number, scale: number, running: boolean, now: number) {
  const bob = running ? Math.sin(now / 75) * 3 : 0
  context.save()
  context.translate(x, y + bob)
  context.scale(scale, scale)
  context.fillStyle = 'rgba(0,0,0,.25)'
  context.beginPath()
  context.ellipse(0, 16, 24, 7, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#111827'
  context.beginPath()
  context.ellipse(0, -15, 25, 37, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f8fafc'
  context.beginPath()
  context.ellipse(0, -9, 16, 26, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#f59e0b'
  context.beginPath()
  context.moveTo(-5, -33)
  context.lineTo(13, -27)
  context.lineTo(-5, -21)
  context.closePath()
  context.fill()
  context.fillStyle = '#111827'
  context.beginPath()
  context.arc(-7, -38, 3, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, Math.max(1, radius))
}
