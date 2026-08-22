import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { readAudioPreferences, storeAudioPreferences } from '../../lib/audio-preferences'
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
    obstacles: [
      { lane: 0, z: 0.52 },
      { lane: 2, z: 0.82 },
    ],
    coins: Array.from({ length: 6 }, (_, index) => ({
      lane: Math.floor(Math.random() * 3),
      z: 0.22 + index * 0.14,
    })),
    jumpUntil: 0,
    score: 0,
    collected: 0,
    lives: 3,
    distance: 0,
    nextObstacleAt: 0.68,
    nextCoinAt: 0.38,
    lastTime: performance.now(),
  }
}

export function GenderRunnerGame() {
  const navigate = useNavigate()
  const gameRootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const worldRef = useRef<World>(makeWorld())
  const phaseRef = useRef<Phase>('ready')
  const mutedRef = useRef(readAudioPreferences().muted)
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
    return readRunnerHighScore()
  })
  const [muted, setMuted] = useState(mutedRef.current)

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const endGame = useCallback(() => {
    const score = worldRef.current.score
    const nextHigh = Math.max(score, highScore)
    if (nextHigh !== highScore) {
      setHighScore(nextHigh)
      try {
        localStorage.setItem('rgg_gender_runner_highscore', String(nextHigh))
      } catch {
        // A blocked storage API must not stop the current run from finishing.
      }
    }
    changePhase('gameover')
  }, [changePhase, highScore])

  const loseLife = useCallback((message: string) => {
    const world = worldRef.current
    world.lives -= 1
    playGameSound('wrong', mutedRef.current)
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
    speakRussianWord(world.word.text, mutedRef.current)
  }, [changePhase])

  const move = useCallback((direction: -1 | 1) => {
    if (phaseRef.current !== 'playing') return
    const world = worldRef.current
    const next = Math.max(0, Math.min(2, world.lane + direction))
    if (next === world.lane) return
    world.lane = next
    playGameSound('whoosh', mutedRef.current)
  }, [])

  const jump = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const world = worldRef.current
    const now = performance.now()
    if (world.jumpUntil > now) return
    world.jumpUntil = now + 700
    playGameSound('jump', mutedRef.current)
  }, [])

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    const preferences = readAudioPreferences()
    storeAudioPreferences({ ...preferences, muted: next })
    if (next) window.speechSynthesis?.cancel()
    else {
      playUiSound('select')
      speakRussianWord(worldRef.current.word.text, false)
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void gameRootRef.current?.requestFullscreen()
  }, [])

  const finishGesture = useCallback((x: number, y: number) => {
    const startAt = pointerStartRef.current
    pointerStartRef.current = null
    if (!startAt) return
    const horizontal = x - startAt.x
    const vertical = y - startAt.y
    if (Math.abs(horizontal) > 34 && Math.abs(horizontal) > Math.abs(vertical)) move(horizontal > 0 ? 1 : -1)
    else if (vertical < -28 || Math.abs(horizontal) < 12 && Math.abs(vertical) < 12) jump()
  }, [jump, move])

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

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  useEffect(() => {
    const pauseInBackground = () => {
      if (document.hidden && phaseRef.current === 'playing') changePhase('paused')
    }
    document.addEventListener('visibilitychange', pauseInBackground)
    return () => document.removeEventListener('visibilitychange', pauseInBackground)
  }, [changePhase])

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
      speakRussianWord(world.word.text, mutedRef.current)
    }

    const update = (now: number) => {
      const world = worldRef.current
      const delta = Math.min(40, Math.max(0, now - world.lastTime))
      world.lastTime = now
      if (phaseRef.current !== 'playing') return

      const step = delta * 0.00028
      world.distance += step
      world.displayedLane += (world.lane - world.displayedLane) * Math.min(1, delta / 100)
      world.gateZ -= step
      world.obstacles.forEach((item) => { item.z -= step })
      world.coins.forEach((item) => { item.z -= step })

      if (world.distance >= world.nextCoinAt) {
        world.coins.push({ lane: Math.floor(Math.random() * 3), z: 1 })
        world.nextCoinAt = world.distance + 0.35 + Math.random() * 0.2
      }
      if (world.distance >= world.nextObstacleAt) {
        world.obstacles.push({ lane: Math.floor(Math.random() * 3), z: 1 })
        world.nextObstacleAt = world.distance + 0.72 + Math.random() * 0.35
      }

      for (const coin of world.coins) {
        if (!coin.hit && coin.z < 0.1 && coin.z > -0.04 && coin.lane === world.lane) {
          coin.hit = true
          world.collected += 1
          playGameSound('coin', mutedRef.current)
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

      if (phaseRef.current !== 'playing') return

      if (world.gateZ <= 0.08) {
        const chosen = world.options[world.lane]
        if (chosen === world.word.gender) {
          world.score += 1
          playGameSound('correct', mutedRef.current)
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
    <main ref={gameRootRef} className="min-h-[100dvh] bg-[#0b0f19] text-white">
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate('/games')} className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg font-black text-white/75 hover:text-white" aria-label="O‘yinlardan chiqish">
              ×
            </button>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black sm:text-base">Gender Runner</strong>
              <span className="hidden text-[10px] font-bold tracking-[0.12em] text-amber-300 uppercase min-[390px]:block">3D o‘rmon yugurishi</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-black sm:gap-3 sm:text-sm">
            <span className="rounded-lg bg-white/10 px-2 py-1">⭐ {status.score}</span>
            <span className="rounded-lg bg-white/10 px-2 py-1">🪙 {status.coins}</span>
            <span className="hidden sm:inline" aria-label={`${status.lives} ta jon`}>{lifeMarks.join(' ')}</span>
            <button type="button" onClick={toggleMuted} data-ui-sound="none" className="grid size-9 place-items-center rounded-xl bg-white/10" aria-label={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}>
              {muted ? '🔇' : '🔊'}
            </button>
            <button type="button" onClick={toggleFullscreen} className="hidden size-9 place-items-center rounded-xl bg-white/10 sm:grid" aria-label="To‘liq ekran">
              ⛶
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between bg-slate-900 px-4 py-1.5 text-[11px] font-black sm:hidden">
          <span aria-label={`${status.lives} ta jon`}>{lifeMarks.join(' ')}</span>
          <span className="text-emerald-300">Rekord: {highScore}</span>
        </div>

        <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-2 sm:p-4">
          <canvas
            ref={canvasRef}
            onPointerDown={(event) => { pointerStartRef.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId) }}
            onPointerUp={(event) => finishGesture(event.clientX, event.clientY)}
            onPointerCancel={() => { pointerStartRef.current = null }}
            className="aspect-[4/3] max-h-[calc(100dvh-200px)] w-full max-w-5xl touch-none rounded-2xl bg-[#0b0f19] sm:aspect-[16/10] sm:max-h-[calc(100dvh-150px)]"
          />

          <div className="pointer-events-none absolute top-4 left-1/2 w-[min(88%,520px)] -translate-x-1/2 text-center sm:top-7">
            <p className="text-[10px] font-black tracking-[0.18em] text-amber-200 uppercase">Rodini aniqlang</p>
            <div className="mt-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-600 bg-amber-50 px-4 py-2 text-amber-950 shadow-2xl">
              <span className="text-xl font-black tracking-wide sm:text-3xl">«{status.word.text}»</span>
              <button type="button" className="pointer-events-auto grid size-8 place-items-center rounded-full bg-amber-200 text-sm" data-ui-sound="none" onClick={() => speakRussianWord(status.word.text, mutedRef.current)} aria-label="So‘zni tinglash">▶</button>
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
            <GameOverlay title="Gender Runner" icon="🐼">
              <p className="text-[11px] font-black tracking-[0.15em] text-amber-300 uppercase">Rodlar bo‘ylab 3D yugurish</p>
              <p className="max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
                Pandani uch yo‘lakdan boshqaring: ruscha otning rodini toping, tangalarni yig‘ing va yog‘ochlardan sakrab o‘ting.
              </p>
              <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-[11px] font-bold leading-relaxed text-slate-100 sm:text-xs">
                <strong className="mb-1 block text-amber-300">O‘yin qoidasi:</strong>
                <span className="block">• Chap yo‘lak = ekrandagi chap rod</span>
                <span className="block">• O‘rta yo‘lak = ekrandagi o‘rta rod</span>
                <span className="block">• O‘ng yo‘lak = ekrandagi o‘ng rod</span>
                <span className="block">• Tangalarni yig‘ing, yog‘ochlardan sakrang</span>
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
          <ControlButton onClick={() => move(-1)} disabled={phase !== 'playing'} label="Chapga (A)" icon="←" />
          <ControlButton onClick={jump} disabled={phase !== 'playing'} label="Sakrash" icon="↑" accent />
          <ControlButton onClick={() => move(1)} disabled={phase !== 'playing'} label="O‘ngga (D)" icon="→" />
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
  drawPanda(context, player.x, player.y - jumpHeight, Math.max(0.68, width / 650), phase === 'playing', now)
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

function drawPanda(context: CanvasRenderingContext2D, x: number, y: number, scale: number, running: boolean, now: number) {
  const stride = running ? Math.sin(now / 75) : 0
  const bob = running ? Math.abs(Math.sin(now / 75)) * 3 : 0
  context.save()
  context.translate(x, y + bob)
  context.scale(scale, scale)
  context.fillStyle = 'rgba(0,0,0,.25)'
  context.beginPath()
  context.ellipse(0, 18, 28, 8, 0, 0, Math.PI * 2)
  context.fill()

  context.save()
  context.translate(-12, 8)
  context.rotate(stride * 0.42)
  context.fillStyle = '#111827'
  roundRect(context, -6, -3, 12, 30, 6)
  context.fill()
  context.restore()
  context.save()
  context.translate(12, 8)
  context.rotate(-stride * 0.42)
  context.fillStyle = '#111827'
  roundRect(context, -6, -3, 12, 30, 6)
  context.fill()
  context.restore()

  const bodyGradient = context.createLinearGradient(0, -30, 0, 16)
  bodyGradient.addColorStop(0, '#ffffff')
  bodyGradient.addColorStop(1, '#dbe4ee')
  context.fillStyle = bodyGradient
  context.beginPath()
  context.ellipse(0, -8, 24, 31, 0, 0, Math.PI * 2)
  context.fill()

  context.save()
  context.translate(-22, -10)
  context.rotate(-stride * 0.55)
  context.fillStyle = '#111827'
  roundRect(context, -6, -4, 12, 30, 6)
  context.fill()
  context.restore()
  context.save()
  context.translate(22, -10)
  context.rotate(stride * 0.55)
  context.fillStyle = '#111827'
  roundRect(context, -6, -4, 12, 30, 6)
  context.fill()
  context.restore()

  context.fillStyle = '#111827'
  context.beginPath()
  context.arc(-17, -43, 11, 0, Math.PI * 2)
  context.arc(17, -43, 11, 0, Math.PI * 2)
  context.fill()
  const faceGradient = context.createRadialGradient(-7, -47, 2, 0, -38, 31)
  faceGradient.addColorStop(0, '#ffffff')
  faceGradient.addColorStop(1, '#e2e8f0')
  context.fillStyle = faceGradient
  context.beginPath()
  context.ellipse(0, -38, 27, 24, 0, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#111827'
  context.beginPath()
  context.ellipse(-10, -40, 7, 10, -0.35, 0, Math.PI * 2)
  context.ellipse(10, -40, 7, 10, 0.35, 0, Math.PI * 2)
  context.fill()

  context.fillStyle = '#ffffff'
  context.beginPath()
  context.arc(-9, -42, 2.5, 0, Math.PI * 2)
  context.arc(9, -42, 2.5, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#111827'
  context.beginPath()
  context.arc(0, -31, 4, 0, Math.PI * 2)
  context.fill()

  context.strokeStyle = '#ef4444'
  context.lineWidth = 6
  context.beginPath()
  context.arc(0, -19, 20, 0.15, Math.PI - 0.15)
  context.stroke()
  context.fillStyle = '#ef4444'
  context.beginPath()
  context.moveTo(11, -18)
  context.lineTo(28 + stride * 3, -7)
  context.lineTo(14, -5)
  context.closePath()
  context.fill()
  context.restore()
}

function playGameSound(sound: Parameters<typeof playUiSound>[0], muted: boolean) {
  if (!muted) playUiSound(sound)
}

function speakRussianWord(text: string, muted: boolean) {
  if (muted || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.toLocaleLowerCase('ru-RU'))
  utterance.lang = 'ru-RU'
  utterance.rate = Math.max(0.75, readAudioPreferences().speed * 0.88)
  window.speechSynthesis.speak(utterance)
}

function readRunnerHighScore() {
  try {
    const saved = Number(localStorage.getItem('rgg_gender_runner_highscore'))
    return Number.isFinite(saved) ? saved : 0
  } catch {
    return 0
  }
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, Math.max(1, radius))
}
