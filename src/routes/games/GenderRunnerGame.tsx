import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bird,
  Coins,
  Trophy,
  RotateCcw,
  Heart,
  HeartCrack,
  Maximize,
  Pause,
  Play,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { fill, useT } from '../../lib/i18n'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { readAudioPreferences, storeAudioPreferences } from '../../lib/audio-preferences'
import { playUiSound } from '../../lib/ui-sounds'
import { cx } from '../../lib/cx'
import './runner.css'

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
  animationTime: number
  nextObstacleAt: number
  nextCoinAt: number
  lastTime: number
  fallStartedAt: number
}

const GENDERS: Record<Gender, { label: string; short: string; color: string }> = {
  masculine: { label: 'МУЖСКОЙ РОД', short: 'МУЖСКОЙ', color: '#147aff' },
  feminine: { label: 'ЖЕНСКИЙ РОД', short: 'ЖЕНСКИЙ', color: '#ff4364' },
  neuter: { label: 'СРЕДНИЙ РОД', short: 'СРЕДНИЙ', color: '#ffc928' },
}

const RUNNER_LANES: Gender[] = ['feminine', 'masculine', 'neuter']

/**
 * Speed and paint only. The label and the caption under it are copy, so they live in the
 * dictionary under the same difficulty key — `t.arcade.runner.difficulty[key]`.
 */
const DIFFICULTIES: Record<Difficulty, { speed: number; color: string }> = {
  normal: { speed: 1, color: 'border-cyan-300 bg-cyan-400/20 text-cyan-100' },
  high: { speed: 1.25, color: 'border-amber-300 bg-amber-400/20 text-amber-100' },
  expert: { speed: 1.5, color: 'border-rose-300 bg-rose-400/20 text-rose-100' },
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

function makeWorld(): World {
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

function makeCoinWave(startZ: number, repeats = 2): TrackItem[] {
  const zigzag = [0, 1, 2, 2, 1, 0, 0, 1, 2]
  const count = repeats === 3 ? 9 : 6
  return zigzag.slice(0, count).map((lane, index) => ({ lane, z: startZ + index * 0.09 }))
}

export function GenderRunnerGame() {
  const t = useT().arcade.runner
  const shelf = useT().arcade
  /* The animation loop is not re-created on a language change, so it reads through a ref. */
  const copy = useRef(t)
  copy.current = t
  const navigate = useNavigate()
  const gameRootRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
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
  const [activeLane, setActiveLane] = useState(1)
  const [newRecord, setNewRecord] = useState(false)

  const changePhase = useCallback((next: Phase) => {
    pointerStartRef.current = null
    phaseRef.current = next
    setPhase(next)
  }, [])

  const endGame = useCallback(() => {
    const score = worldRef.current.score
    const nextHigh = Math.max(score, highScore)
    setNewRecord(score > highScore)
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
    setActiveLane(world.lane)
    setNewRecord(false)
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
    setActiveLane(next)
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

  const startGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (phaseRef.current !== 'playing' || !event.isPrimary || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return
    pointerStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const updateGesture = (event: ReactPointerEvent<HTMLElement>) => {
    const startAt = pointerStartRef.current
    if (!startAt || startAt.pointerId !== event.pointerId) return
    const horizontal = event.clientX - startAt.x
    const vertical = event.clientY - startAt.y
    if (Math.max(Math.abs(horizontal), Math.abs(vertical)) < 28) return
    pointerStartRef.current = null
    if (Math.abs(horizontal) > Math.abs(vertical)) move(horizontal > 0 ? 1 : -1)
    else if (vertical < 0) jump()
  }

  const cancelGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerStartRef.current?.pointerId === event.pointerId) pointerStartRef.current = null
  }

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    updateGesture(event)
    const startAt = pointerStartRef.current
    if (event.pointerType === 'mouse' && startAt?.pointerId === event.pointerId
      && Math.abs(event.clientX - startAt.x) < 12 && Math.abs(event.clientY - startAt.y) < 12) jump()
    cancelGesture(event)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

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
    getRunnerPenguins()

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
      world.gateZ = 1
      setStatus((current) => ({ ...current, word: world.word }))
      speakRussianWord(world.word.text, mutedRef.current)
    }

    const update = (now: number) => {
      const world = worldRef.current
      const delta = Math.min(40, Math.max(0, now - world.lastTime))
      world.lastTime = now
      if (phaseRef.current !== 'playing') return

      world.animationTime += delta
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
          if (world.jumpUntil <= now) loseLife(copy.current.hitObstacle)
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
          showMessage(copy.current.correct, 'correct')
        } else {
          loseLife(fill(copy.current.wrong, { word: world.word.text, gender: GENDERS[world.word.gender].label }))
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

  const lives = Array.from({ length: 3 }, (_, index) => index < status.lives)

  return (
    <main ref={gameRootRef} className="runner-game" data-phase={phase}>
      <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => navigate('/games')} className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-lg font-black text-white/75 hover:text-white" aria-label={t.exit}>
              ×
            </button>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black sm:text-base">{shelf.runnerTitle}</strong>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-black sm:gap-3 sm:text-sm">
            <span aria-label={t.score} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
              <Star aria-hidden="true" className="size-3.5 fill-amber-300 text-amber-300" strokeWidth={0} />
              {status.score}
            </span>
            <span aria-label={t.coins} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
              <Coins aria-hidden="true" className="size-3.5 text-amber-200" strokeWidth={2} />
              {status.coins}
            </span>
            <span className="hidden items-center gap-0.5 sm:inline-flex" aria-label={fill(t.lives, { count: status.lives })}>
              <Lives lives={lives} />
            </span>
            <span className="hidden rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100 md:inline">{t.difficulty[difficulty].label}</span>
            <button type="button" onClick={toggleMuted} data-ui-sound="none" className="grid size-9 place-items-center rounded-xl bg-white/10" aria-label={muted ? t.soundOn : t.soundOff}>
              {muted
                ? <VolumeX aria-hidden="true" className="size-4" strokeWidth={2} />
                : <Volume2 aria-hidden="true" className="size-4" strokeWidth={2} />}
            </button>
            <button type="button" onClick={toggleFullscreen} className="hidden size-9 place-items-center rounded-xl bg-white/10 sm:grid" aria-label={t.fullscreen}>
              <Maximize aria-hidden="true" className="size-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="runner-mobile-hud flex items-center justify-between px-4 py-1.5 text-[11px] font-black sm:hidden">
          <span className="inline-flex items-center gap-0.5" aria-label={fill(t.lives, { count: status.lives })}>
            <Lives lives={lives} />
          </span>
          <span>{shelf.record}: {highScore}</span>
        </div>

        <section
          onPointerDown={startGesture}
          onPointerMove={updateGesture}
          onPointerUp={finishGesture}
          onPointerCancel={cancelGesture}
          onLostPointerCapture={cancelGesture}
          className="runner-stage"
        >
          <canvas
            ref={canvasRef}
            className="runner-canvas"
          />

          <div className="runner-signs" lang="ru">{RUNNER_LANES.map((gender, lane) => <span key={gender} data-active={activeLane === lane} style={{ '--lane-color': GENDERS[gender].color } as CSSProperties}>{GENDERS[gender].short}</span>)}</div>
          <div className="runner-feedback">
            <button type="button" className="runner-listen" data-ui-sound="none" onClick={() => speakRussianWord(status.word.text, mutedRef.current)} aria-label={`${t.listen}: ${status.word.text}`}><Volume2 aria-hidden="true" size={17} /><span className="sr-only" lang="ru">{status.word.text}</span></button>
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
            <GameOverlay title={shelf.runnerTitle} icon={<Bird className="size-10 text-cyan-300" strokeWidth={1.6} />}>
              <div className="runner-rules"><h2>{t.rulesTitle}</h2><p>{t.introBody}</p></div>
              <DifficultyPicker value={difficulty} onChange={chooseDifficulty} />
              <button className="runner-replay" onClick={start}><Play size={20} fill="currentColor" />{t.start}</button>
            </GameOverlay>
          )}

          {phase === 'paused' && (
            <GameOverlay title={t.paused} icon={<Pause className="size-10 fill-white/80 text-white/80" strokeWidth={0} />}>
              <DifficultyPicker value={difficulty} onChange={chooseDifficulty} />
              <Button block onClick={() => changePhase('playing')}>{t.resume}</Button>
              <button type="button" onClick={start} className="text-sm font-black text-white/70 hover:text-white">{t.restart}</button>
            </GameOverlay>
          )}

          {phase === 'falling' && (
            <div className="pointer-events-none absolute inset-x-4 bottom-7 z-10 rounded-2xl border border-cyan-200/30 bg-slate-950/75 px-4 py-3 text-center text-sm font-black text-cyan-100 shadow-2xl backdrop-blur-sm sm:inset-x-auto sm:left-1/2 sm:w-96 sm:-translate-x-1/2">
              {t.falling}
            </div>
          )}

          {phase === 'gameover' && (
            <div className="runner-reward" data-record={newRecord}>
              {newRecord && <div className="runner-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ '--i': i, left: `${i * 37 % 100}%` } as CSSProperties} />)}</div>}
              <div className="runner-reward-panel">
                <h1>{newRecord ? t.newRecord : t.over}</h1>
                <div className="runner-reward-body">
                  <img className="runner-reward-penguin" src={newRecord ? '/games/characters/penguin.webp' : '/games/rod-runner/penguin-result-sad.webp'} alt="" />
                  <div className="runner-reward-stats">
                    <Result label={t.score} value={status.score} icon={<Star />} />
                    <Result label={t.coins} value={status.coins} icon={<Coins />} />
                    <Result label={shelf.record} value={highScore} icon={<Trophy />} />
                  </div>
                </div>
                <button className="runner-replay" onClick={start}><RotateCcw size={22} />{t.again}</button>
                <button type="button" onClick={() => navigate('/games')} className="runner-reward-back">{t.backToGames}</button>
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <button
              type="button"
              onClick={() => changePhase('paused')}
              className="runner-pause"
              aria-label={t.paused}
            >
              <Pause aria-hidden="true" className="size-5 fill-current" strokeWidth={0} />
            </button>
          )}
        </section>

        <p className="runner-controls-hint hidden px-4 py-3 text-center text-xs font-bold [@media(pointer:coarse)]:block">
          {t.controlsHint}
        </p>
        <div className="runner-controls grid grid-cols-3 gap-2 p-3 sm:mx-auto sm:w-full sm:max-w-xl sm:rounded-t-2xl [@media(pointer:coarse)]:hidden">
          <ControlButton onClick={() => move(-1)} disabled={phase !== 'playing'} label={t.left} icon={<ArrowLeft aria-hidden="true" className="size-5" strokeWidth={2.4} />} />
          <ControlButton onClick={jump} disabled={phase !== 'playing'} label={t.jump} icon={<ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.4} />} accent />
          <ControlButton onClick={() => move(1)} disabled={phase !== 'playing'} label={t.right} icon={<ArrowRight aria-hidden="true" className="size-5" strokeWidth={2.4} />} />
        </div>
      </div>
    </main>
  )
}

/**
 * Three hearts, filled while they are still yours.
 *
 * Two different icons rather than one at two opacities: a dimmed heart and a lit heart at
 * 14px over a moving scene are the same shape, and the count has to survive a glance. The
 * row carries one `aria-label` on its parent, so these are decoration.
 */
function Lives({ lives }: { lives: boolean[] }) {
  return (
    <>
      {lives.map((alive, index) =>
        alive ? (
          <Heart key={index} aria-hidden="true" className="size-3.5 fill-rose-500 text-rose-500" strokeWidth={0} />
        ) : (
          <HeartCrack key={index} aria-hidden="true" className="size-3.5 text-slate-400" strokeWidth={2} />
        ),
      )}
    </>
  )
}

function GameOverlay({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="runner-overlay">
      <div className="runner-overlay-panel">
        <span aria-hidden className="text-signal-ink">{icon}</span>
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (difficulty: Difficulty) => void }) {
  const t = useT().arcade.runner

  return (
    <div className="w-full max-w-md">
      <span className="mb-2 block text-left text-[10px] font-black tracking-[0.14em] text-white/60 uppercase">{t.speed}</span>
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
            <strong className="block text-xs font-black sm:text-sm">{t.difficulty[key].label}</strong>
            <span className="mt-0.5 block text-[9px] font-bold sm:text-[10px]">{t.difficulty[key].caption}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Result({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="runner-stat">
      <div>{icon}<strong>{value}</strong></div>
      <span>{label}</span>
    </div>
  )
}

function ControlButton({ onClick, disabled, label, icon, accent = false }: {
  onClick: () => void
  disabled: boolean
  label: string
  /** A drawn arrow now: the bare arrow characters varied wildly by platform font. */
  icon: ReactNode
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
  for (let index = 0; index < 16; index++) {
    const z = 1 - ((index / 16 + world.distance * .14) % 1)
    const point = project(index % 2 ? -2.15 : 2.15, z, width, height)
    drawIceberg(context, point.x, point.y, point.scale * 1.7, index)
  }
  for (let index = 0; index < 10; index++) {
    const z = 1 - ((index / 10 + world.distance * .48) % 1)
    const point = project(index % 2 ? -1.82 : 1.82, z, width, height)
    drawIceberg(context, point.x, point.y, point.scale * 1.3, index + 7)
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

  drawApproachingWord(context, width, height, world)

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
  context.ellipse(player.x + 15, player.y + 7, 42 * shadowScale, 10 * shadowScale, -.12, 0, Math.PI * 2)
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
    Math.max(0.8, Math.min(1.45, width / 390)) * (1 - fallProgress * 0.35),
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

function drawApproachingWord(context: CanvasRenderingContext2D, width: number, height: number, world: World) {
  const depth = Math.max(0, Math.min(1, 1 - world.gateZ))
  const scale = .64 + depth * .58
  const y = height * (.22 + depth ** 1.8 * .7)
  context.save()
  context.translate(width / 2, y)
  context.scale(scale, scale)
  context.font = `950 ${Math.min(34, width * .074)}px Nunito, sans-serif`
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
  context.fillStyle = '#ffffffaa'
  context.beginPath()
  context.moveTo(x + size * .28, y - size)
  context.lineTo(x + size * .1, y)
  context.lineTo(x + size * .7, y - size * .34)
  context.closePath()
  context.fill()
  context.fillStyle = '#299dc944'
  context.beginPath()
  context.moveTo(x - size * .55, y - size * .75)
  context.lineTo(x - size * .25, y)
  context.lineTo(x - size, y)
  context.fill()
  const snow = context.createRadialGradient(x, y, 1, x, y, size)
  snow.addColorStop(0, '#ffffff')
  snow.addColorStop(1, '#c7e8f8')
  context.fillStyle = snow
  context.beginPath()
  context.ellipse(x, y + size * .02, size * 1.1, size * .2, -.08, 0, Math.PI * 2)
  context.fill()
  for (let i = 0; i < 8; i++) {
    context.fillStyle = i % 2 ? '#fff' : '#97cce266'
    context.fillRect(x - size * .8 + ((i * 17 + variant * 3) % 27) / 27 * size * 1.6, y - size * .06 + (i % 3) * size * .03, Math.max(1, scale), Math.max(1, scale))
  }
  context.strokeStyle = '#fff'
  context.lineWidth = Math.max(1, scale)
  context.beginPath()
  context.moveTo(x + size * .28 - 4 * scale, y - size * .7)
  context.lineTo(x + size * .28 + 4 * scale, y - size * .7)
  context.moveTo(x + size * .28, y - size * .7 - 4 * scale)
  context.lineTo(x + size * .28, y - size * .7 + 4 * scale)
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

let runnerPenguins: { forward: HTMLImageElement; turning: HTMLImageElement } | null = null

function getRunnerPenguins() {
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
