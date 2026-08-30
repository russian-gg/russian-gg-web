import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { readAudioPreferences, storeAudioPreferences } from '../../lib/audio-preferences'
import { playUiSound } from '../../lib/ui-sounds'
import { cx } from '../../lib/cx'
import { mascotImage } from '../../lib/mascot-images'

type Gender = 'masculine' | 'feminine' | 'neuter'
type Phase = 'ready' | 'playing' | 'paused' | 'falling' | 'gameover'
type Difficulty = 'normal' | 'high' | 'expert'

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
  fallStartedAt: number
}

const GENDERS: Record<Gender, { label: string; short: string; color: string }> = {
  masculine: { label: 'Мужской род', short: 'МУЖСКОЙ', color: '#0000FF' },
  feminine: { label: 'Женский род', short: 'ЖЕНСКИЙ', color: '#FF2400' },
  neuter: { label: 'Средний род', short: 'СРЕДНИЙ', color: '#D6A800' },
}

const DIFFICULTIES: Record<Difficulty, { label: string; speed: number; caption: string; color: string }> = {
  normal: { label: 'Normal', speed: 1, caption: 'Hozirgi tezlik', color: 'border-cyan-300 bg-cyan-400/20 text-cyan-100' },
  high: { label: 'High', speed: 1.25, caption: '25% tezroq', color: 'border-amber-300 bg-amber-400/20 text-amber-100' },
  expert: { label: 'Expert', speed: 1.5, caption: '50% tezroq', color: 'border-rose-300 bg-rose-400/20 text-rose-100' },
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
    obstacles: [{ lane: 0, z: 0.58 }, { lane: 2, z: 0.88 }],
    coins: makeCoinWave(0.28, 2),
    jumpUntil: 0,
    score: 0,
    collected: 0,
    lives: 3,
    distance: 0,
    nextObstacleAt: 0.68,
    nextCoinAt: 0.62,
    lastTime: performance.now(),
    fallStartedAt: 0,
  }
}

function makeCoinWave(startZ: number, repeats = 2): TrackItem[] {
  const zigzag = [0, 1, 2, 2, 1, 0, 0, 1, 2]
  const count = repeats === 3 ? 9 : 6
  return zigzag.slice(0, count).map((lane, index) => ({ lane, z: startZ + index * 0.09 }))
}

export function GenderRunnerGame() {
  const navigate = useNavigate()
  const gameRootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const worldRef = useRef<World>(makeWorld())
  const phaseRef = useRef<Phase>('ready')
  const difficultyRef = useRef<Difficulty>('normal')
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
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

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

  useEffect(() => {
    if (phase !== 'falling') return
    const timer = window.setTimeout(endGame, 1500)
    return () => window.clearTimeout(timer)
  }, [endGame, phase])

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
    if (world.lives <= 0) {
      world.fallStartedAt = performance.now()
      window.speechSynthesis?.cancel()
      changePhase('falling')
    }
  }, [changePhase])

  const start = useCallback(() => {
    worldRef.current = makeWorld()
    const world = worldRef.current
    setStatus({ score: 0, coins: 0, lives: 3, word: world.word, message: '', messageKind: '' })
    changePhase('playing')
    speakRussianWord(world.word.text, mutedRef.current)
  }, [changePhase])

  const chooseDifficulty = useCallback((next: Difficulty) => {
    difficultyRef.current = next
    setDifficulty(next)
    playGameSound('select', mutedRef.current)
  }, [])

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

      const speed = DIFFICULTIES[difficultyRef.current].speed
      const step = delta * 0.00028 * speed
      world.distance += step
      world.displayedLane += (world.lane - world.displayedLane) * Math.min(1, delta / 100)
      world.gateZ -= step
      world.obstacles.forEach((item) => { item.z -= step })
      world.coins.forEach((item) => { item.z -= step })

      if (world.distance >= world.nextCoinAt) {
        const repeats = Math.random() > 0.5 ? 3 : 2
        world.coins.push(...makeCoinWave(1, repeats))
        world.nextCoinAt = world.distance + (0.56 + Math.random() * 0.28) * speed
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
              <strong className="block truncate text-sm font-black sm:text-base">Penguin Ice Runner</strong>
              <span className="hidden text-[10px] font-bold tracking-[0.12em] text-cyan-200 uppercase min-[390px]:block">3D muzlik yugurishi</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-black sm:gap-3 sm:text-sm">
            <span className="rounded-lg bg-white/10 px-2 py-1">⭐ {status.score}</span>
            <span className="rounded-lg bg-white/10 px-2 py-1">🪙 {status.coins}</span>
            <span className="hidden sm:inline" aria-label={`${status.lives} ta jon`}>{lifeMarks.join(' ')}</span>
            <span className="hidden rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100 md:inline">{DIFFICULTIES[difficulty].label}</span>
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
            <GameOverlay title="Penguin Ice Runner" icon="🐧">
              <p className="text-[11px] font-black tracking-[0.15em] text-cyan-200 uppercase">Rodlar bo‘ylab 3D muzlik yugurishi</p>
              <p className="max-w-md text-sm leading-relaxed text-slate-200 sm:text-base">
                Pingvinni uchta muz yo‘lakdan boshqaring: ruscha otning rodini toping, tanga to‘lqinlarini yig‘ing va muz to‘siqlaridan sakrang.
              </p>
              <DifficultyPicker value={difficulty} onChange={chooseDifficulty} />
              <div className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-left text-[11px] font-bold leading-relaxed text-slate-100 sm:text-xs">
                <strong className="mb-1 block text-amber-300">O‘yin qoidasi:</strong>
                <span className="block">• Chap yo‘lak = ekrandagi chap rod</span>
                <span className="block">• O‘rta yo‘lak = ekrandagi o‘rta rod</span>
                <span className="block">• O‘ng yo‘lak = ekrandagi o‘ng rod</span>
                <span className="block">• Z-shakldagi tangalarni yig‘ing, muzlardan sakrang</span>
              </div>
              <Button block onClick={start}>O‘yinni boshlash</Button>
            </GameOverlay>
          )}

          {phase === 'paused' && (
            <GameOverlay title="Pauza" icon="⏸️">
              <DifficultyPicker value={difficulty} onChange={chooseDifficulty} />
              <Button block onClick={() => changePhase('playing')}>Davom etish</Button>
              <button type="button" onClick={start} className="text-sm font-black text-white/70 hover:text-white">Qayta boshlash</button>
            </GameOverlay>
          )}

          {phase === 'falling' && (
            <div className="pointer-events-none absolute inset-x-4 bottom-7 z-10 rounded-2xl border border-cyan-200/30 bg-slate-950/75 px-4 py-3 text-center text-sm font-black text-cyan-100 shadow-2xl backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2">
              Muz yorildi! Pingvin sirpanib ketdi…
            </div>
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

function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (difficulty: Difficulty) => void }) {
  return (
    <div className="w-full max-w-md">
      <span className="mb-2 block text-left text-[10px] font-black tracking-[0.14em] text-white/60 uppercase">Tezlik darajasi</span>
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(DIFFICULTIES) as [Difficulty, (typeof DIFFICULTIES)[Difficulty]][]).map(([key, option]) => (
          <button
            key={key}
            type="button"
            data-ui-sound="none"
            onClick={() => onChange(key)}
            className={cx(
              'rounded-xl border p-2 text-center transition active:scale-95',
              value === key ? option.color : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10',
            )}
          >
            <strong className="block text-xs font-black sm:text-sm">{option.label}</strong>
            <span className="mt-0.5 block text-[9px] font-bold sm:text-[10px]">{option.caption}</span>
          </button>
        ))}
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
  sky.addColorStop(0, '#071c4a')
  sky.addColorStop(0.55, '#176ca7')
  sky.addColorStop(1, '#b9efff')
  context.fillStyle = sky
  context.fillRect(0, 0, width, horizon)

  const aurora = context.createLinearGradient(0, 0, width, horizon)
  aurora.addColorStop(0, 'rgba(103,232,249,0)')
  aurora.addColorStop(0.45, 'rgba(103,232,249,.2)')
  aurora.addColorStop(0.7, 'rgba(167,243,208,.24)')
  aurora.addColorStop(1, 'rgba(103,232,249,0)')
  context.strokeStyle = aurora
  context.lineWidth = Math.max(14, height * 0.045)
  context.beginPath()
  context.moveTo(-20, horizon * 0.42)
  for (let x = 0; x <= width + 20; x += width / 12) {
    context.lineTo(x, horizon * (0.42 + Math.sin(x * 0.015 + now * 0.0003) * 0.1))
  }
  context.stroke()

  for (let index = 0; index < 34; index += 1) {
    const x = (index * 83 + now * 0.012 * (index % 3 + 1)) % width
    const y = (index * 47 + now * 0.008 * (index % 2 + 1)) % height
    const radius = 0.8 + index % 3
    context.fillStyle = `rgba(255,255,255,${0.28 + index % 4 * 0.08})`
    context.beginPath()
    context.arc(x, y, radius, 0, Math.PI * 2)
    context.fill()
  }

  drawMountainRange(context, width, horizon, '#9ed9ee', 0.72, 0.09)
  drawMountainRange(context, width, horizon, '#e8f8ff', 0.84, 0.065)

  context.fillStyle = '#0d4e73'
  context.fillRect(0, horizon, width, height - horizon)

  const iceRoad = context.createLinearGradient(0, horizon, 0, bottom)
  iceRoad.addColorStop(0, '#d9f7ff')
  iceRoad.addColorStop(0.55, '#8bd7ee')
  iceRoad.addColorStop(1, '#d9fbff')
  context.fillStyle = iceRoad
  context.beginPath()
  context.moveTo(center - width * 0.075, horizon)
  context.lineTo(center + width * 0.075, horizon)
  context.lineTo(center + width * 0.43, bottom)
  context.lineTo(center - width * 0.43, bottom)
  context.closePath()
  context.fill()
  context.strokeStyle = '#e0fbff'
  context.lineWidth = Math.max(3, width * 0.007)
  context.stroke()

  const sheen = context.createLinearGradient(center - width * 0.35, 0, center + width * 0.35, 0)
  sheen.addColorStop(0, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.48, 'rgba(255,255,255,.42)')
  sheen.addColorStop(0.63, 'rgba(255,255,255,.08)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = sheen
  context.beginPath()
  context.moveTo(center - width * 0.05, horizon)
  context.lineTo(center + width * 0.02, horizon)
  context.lineTo(center + width * 0.18, bottom)
  context.lineTo(center - width * 0.15, bottom)
  context.closePath()
  context.fill()

  context.setLineDash([12, 15])
  context.strokeStyle = 'rgba(255,255,255,.8)'
  context.lineWidth = Math.max(1.5, width * 0.003)
  for (const laneLine of [-0.5, 0.5]) {
    context.beginPath()
    context.moveTo(center + laneLine * width * 0.05, horizon)
    context.lineTo(center + laneLine * width * 0.285, bottom)
    context.stroke()
  }
  context.setLineDash([])

  for (let index = 0; index < 14; index += 1) {
    const z = ((index / 14 + world.distance * 0.52) % 1)
    const projected = project(index % 2 === 0 ? -2.4 : 2.4, z, width, height)
    drawIceberg(context, projected.x, projected.y, projected.scale, index)
  }

  for (const coin of world.coins) {
    if (coin.z > 1.04) continue
    const point = project(coin.lane - 1, coin.z, width, height)
    drawCoin(context, point.x, point.y - 24 * point.scale, point.scale, now)
  }

  for (const obstacle of world.obstacles) {
    if (obstacle.z > 1.04) continue
    const point = project(obstacle.lane - 1, obstacle.z, width, height)
    drawIceBlock(context, point.x, point.y, point.scale)
  }

  drawGate(context, width, height, world)

  const jumpProgress = world.jumpUntil > now ? 1 - (world.jumpUntil - now) / 700 : 0
  const jumpHeight = world.jumpUntil > now ? Math.sin(jumpProgress * Math.PI) * height * 0.14 : 0
  const fallProgress = phase === 'falling' ? Math.min(1, (now - world.fallStartedAt) / 1500) : 0
  const slideDepth = fallProgress < 0.58 ? fallProgress / 0.58 * 0.48 : 0.48
  const player = project(world.displayedLane - 1, 0.03 + slideDepth, width, height)
  const drop = fallProgress > 0.58 ? ((fallProgress - 0.58) / 0.42) ** 2 * height * 0.7 : 0
  if (phase === 'falling') drawIceHole(context, player.x, player.y + 22, Math.max(0.45, player.scale))
  drawProjectPenguin(
    context,
    player.x,
    player.y - jumpHeight + drop,
    Math.max(0.5, width / 690) * (1 - fallProgress * 0.38),
    phase === 'playing',
    now,
    -fallProgress * 1.15,
  )
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

  const gateIce = context.createLinearGradient(left.x, top, right.x, top)
  gateIce.addColorStop(0, '#67e8f9')
  gateIce.addColorStop(0.5, '#ecfeff')
  gateIce.addColorStop(1, '#38bdf8')
  context.fillStyle = gateIce
  context.fillRect(left.x - signWidth * 0.7, top, 10 * scale, 105 * scale)
  context.fillRect(right.x + signWidth * 0.7 - 10 * scale, top, 10 * scale, 105 * scale)
  context.fillRect(left.x - signWidth * 0.7, top, right.x - left.x + signWidth * 1.4, 12 * scale)

  context.fillStyle = 'rgba(224,251,255,.9)'
  for (let index = 0; index < 7; index += 1) {
    const icicleX = left.x - signWidth * 0.55 + index * (right.x - left.x + signWidth) / 7
    context.beginPath()
    context.moveTo(icicleX, top + 10 * scale)
    context.lineTo(icicleX + 7 * scale, top + 10 * scale)
    context.lineTo(icicleX + 3 * scale, top + (23 + index % 3 * 5) * scale)
    context.closePath()
    context.fill()
  }

  world.options.forEach((gender, lane) => {
    const point = project(lane - 1, world.gateZ, width, height)
    const details = GENDERS[gender]
    context.fillStyle = 'rgba(240,253,255,.96)'
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

function drawMountainRange(
  context: CanvasRenderingContext2D,
  width: number,
  horizon: number,
  color: string,
  baseline: number,
  peak: number,
) {
  context.fillStyle = color
  context.beginPath()
  context.moveTo(0, horizon)
  context.lineTo(0, horizon * baseline)
  for (let x = 0; x <= width; x += width / 8) {
    context.lineTo(x + width / 16, horizon * (baseline - peak - (x / width % 0.25) * 0.13))
    context.lineTo(x + width / 8, horizon * baseline)
  }
  context.lineTo(width, horizon)
  context.closePath()
  context.fill()
}

function drawIceberg(context: CanvasRenderingContext2D, x: number, y: number, scale: number, variant: number) {
  const size = (34 + variant % 4 * 7) * scale
  const ice = context.createLinearGradient(x - size, y - size, x + size, y)
  ice.addColorStop(0, '#f0fdff')
  ice.addColorStop(0.55, '#a5e8f5')
  ice.addColorStop(1, '#3da8cd')
  context.fillStyle = ice
  context.strokeStyle = 'rgba(255,255,255,.7)'
  context.lineWidth = Math.max(1, 2 * scale)
  context.beginPath()
  context.moveTo(x - size, y)
  context.lineTo(x - size * 0.55, y - size * 0.75)
  context.lineTo(x - size * 0.12, y - size * 0.48)
  context.lineTo(x + size * 0.28, y - size)
  context.lineTo(x + size * 0.7, y - size * 0.34)
  context.lineTo(x + size, y)
  context.closePath()
  context.fill()
  context.stroke()
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
  if (scale > 0.35) {
    context.fillStyle = '#a16207'
    context.font = `900 ${Math.max(7, 10 * scale)}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('★', x, y)
  }
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

let projectPenguinImage: HTMLImageElement | null = null

function getProjectPenguin() {
  if (!projectPenguinImage && typeof Image !== 'undefined') {
    projectPenguinImage = new Image()
    projectPenguinImage.decoding = 'async'
    projectPenguinImage.src = mascotImage('penguin')
  }
  return projectPenguinImage
}

function drawProjectPenguin(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  running: boolean,
  now: number,
  rotation: number,
) {
  const stride = running ? Math.sin(now / 75) : 0
  const bob = running ? Math.abs(Math.sin(now / 75)) * 3 : 0
  const image = getProjectPenguin()
  context.save()
  context.translate(x, y + bob + 10)
  context.rotate(rotation + stride * 0.035)
  context.scale(scale, scale)
  context.fillStyle = 'rgba(0,0,0,.25)'
  context.beginPath()
  context.ellipse(0, 5, 31, 8, 0, 0, Math.PI * 2)
  context.fill()
  if (image?.complete && image.naturalWidth > 0) {
    context.drawImage(image, 110, 0, 930, 1254, -38, -94, 76, 94)
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
