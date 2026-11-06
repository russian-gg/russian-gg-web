import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Coins,
  Trophy,
  RotateCcw,
  Heart,
  HeartCrack,
  Maximize,
  Pause,
  Play,
  Star,
} from 'lucide-react'
import { fill, useT } from '../../lib/i18n'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { GameShareButton } from './GameShareButton'
import { readAudioPreferences } from '../../lib/audio-preferences'
import { playUiSound } from '../../lib/ui-sounds'
import { cx } from '../../lib/cx'
import './runner.css'
import { drawWorld, GENDERS, getRunnerPenguins, makeCoinWave, makeWorld, randomWord, RUNNER_LANES, type Phase, type World } from './runner-engine'

type Difficulty = 'normal' | 'high' | 'expert'

/**
 * Speed and paint only. The label and the caption under it are copy, so they live in the
 * dictionary under the same difficulty key — `t.arcade.runner.difficulty[key]`.
 */
const DIFFICULTIES: Record<Difficulty, { speed: number; color: string }> = {
  normal: { speed: 1, color: 'border-cyan-300 bg-cyan-400/20 text-cyan-100' },
  high: { speed: 1.25, color: 'border-amber-300 bg-amber-400/20 text-amber-100' },
  expert: { speed: 1.5, color: 'border-rose-300 bg-rose-400/20 text-rose-100' },
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
      <div className="runner-frame mx-auto flex max-w-6xl flex-col">
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
            <span className="runner-score rounded-lg px-2 py-1">
              <span aria-label={t.score} className="inline-flex items-center gap-1">
                <Star aria-hidden="true" className="size-3.5 fill-amber-500 text-amber-500" strokeWidth={0} />
                <span key={status.score} className="runner-counter-value">{status.score}</span>
              </span>
              {status.message && status.messageKind === 'correct' && <span key={`point-${status.score}`} className="runner-point-flight" aria-hidden="true"><Coins size={14} />+1</span>}
            </span>
            <span aria-label={t.coins} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1">
              <Coins aria-hidden="true" className="size-3.5 text-amber-600" strokeWidth={2} />
              <span key={status.coins} className="runner-counter-value">{status.coins}</span>
            </span>
            <span className="hidden rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-2 py-1 text-cyan-100 md:inline">{t.difficulty[difficulty].label}</span>
            <button type="button" onClick={toggleFullscreen} className="hidden size-9 place-items-center rounded-xl bg-white/10 sm:grid" aria-label={t.fullscreen}>
              <Maximize aria-hidden="true" className="size-4" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="runner-hud flex items-center justify-between px-4 py-1.5 text-xs font-black sm:px-6">
          <span className="inline-flex items-center gap-0.5" aria-label={fill(t.lives, { count: status.lives })}>
            <Lives lives={lives} />
          </span>
          <span aria-label={shelf.record} className="inline-flex items-center gap-1.5"><Trophy size={14} aria-hidden="true" />{shelf.record}: {highScore}</span>
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
            <span className="sr-only" lang="ru">{status.word.text}</span>
            {status.message && status.messageKind === 'wrong' && (
              <p className="runner-error">
                {status.message}
              </p>
            )}
          </div>

          {phase === 'ready' && (
            <GameOverlay title={shelf.runnerTitle}>
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
                  <span className="runner-reward-penguin" data-pose={newRecord ? 'happy' : 'sad'} aria-hidden="true" />
                  <div className="runner-reward-stats">
                    <Result label={t.score} value={status.score} icon={<Star />} />
                    <Result label={t.coins} value={status.coins} icon={<Coins />} />
                    <Result label={shelf.record} value={highScore} icon={<Trophy />} />
                  </div>
                </div>
                <button className="runner-replay" onClick={start}><RotateCcw size={22} />{t.again}</button>
                <GameShareButton slug="rod-runner" title={shelf.runnerTitle}
                  result={[`${t.score}: ${status.score}`, `${t.coins}: ${status.coins}`, `${shelf.record}: ${highScore}`]}
                  className="mt-4 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/70 bg-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/25" />
                <button type="button" onClick={() => navigate('/games')} className="runner-reward-back">{t.backToGames}</button>
              </div>
            </div>
          )}

        </section>

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

function GameOverlay({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="runner-overlay">
      <div className="runner-overlay-panel">
        {icon && <span aria-hidden className="text-signal-ink">{icon}</span>}
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

function playGameSound(sound: Parameters<typeof playUiSound>[0], muted: boolean) {
  if (!muted) playUiSound(sound)
}

function speakRussianWord(text: string, muted: boolean) {
  if (muted || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text.toLocaleLowerCase('ru-RU'))
  utterance.lang = 'ru-RU'
  utterance.rate = 0.88
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
