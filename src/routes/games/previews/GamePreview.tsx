import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Gem, Sparkles, Square } from 'lucide-react'
import { useLocale } from '../../../lib/i18n'
import { copies } from '../speaking/copy'
import { firstReactionCopies } from '../speaking/first-reaction-copy'
import { ErrorHuntProgress, ErrorHuntScene } from '../speaking/ErrorHuntScene'
import { FirstReactionMedia } from '../speaking/FirstReactionMedia'
import { TezGapirBackdrop, TezGapirScene, TezGapirTranscript } from '../speaking/TezGapirScene'
import { GameMark, Timer } from '../speaking/visuals'
import { LifeScene } from '../fight-for-life/LifeScene'
import { lifeCopies } from '../fight-for-life/copy'
import { advanceDemo, drawWorld, makeWorld } from '../runner-engine'
import {
  demoPrompt, demoSession, demoTurn, ERROR_HUNT_ROUNDS, FIRST_REACTION_SCENES, LIFE_TOPIC,
  prefersReducedMotion, solvedFeedback, TEZ_GAPIR_WORDS, useDemoClock, useOnScreen,
} from './demo'
import { isSpeakingGame } from '../speaking/copy'
import '../speaking/speaking-games.css'
import '../fight-for-life/life.css'
import '../speaking/first-reaction.css'
import './previews.css'

/**
 * A game's own screen, playing by itself, sized to whatever box it is put in.
 *
 * Each game is drawn with its real components at the width it was built for and scaled down
 * whole — top bar to microphone — so nothing is cropped away; the box's spare room takes the
 * game's backdrop colour. The clock runs only while the preview is on screen (or, in the
 * banner, while its slide is up).
 */
export function GamePreview({ slug, running, onScore, cover = false }: {
  slug: string; running?: boolean; onScore?: (score: number) => void
  /** Fill the box and trim the edges (the banner), rather than fit the whole screen in (cards). */
  cover?: boolean
}) {
  const [ref, onScreen] = useOnScreen<HTMLDivElement>()
  const live = running ?? onScreen
  return <div ref={ref} className="game-preview" aria-hidden="true" style={{ background: BACKDROPS[slug] ?? '#0b1220' }}>
    {slug === 'rod-runner' ? <RunnerPreview running={live} onScore={onScore} />
      : slug === 'tez-gapir' ? <ScaledStage cover={cover} width={1000}><TezGapirPreview running={live} /></ScaledStage>
        : slug === 'error-hunt' ? <ScaledStage cover={cover} width={1000}><ErrorHuntPreview running={live} /></ScaledStage>
          : slug === 'first-reaction' ? <ScaledStage cover={cover} width={1100}><FirstReactionPreview running={live} /></ScaledStage>
            : slug === 'fight-for-life' ? <ScaledStage cover={cover} width={820}><LifePreview running={live} /></ScaledStage>
              : <MarkPreview slug={slug} />}
  </div>
}

/** The colour behind each scaled screen: the edge of the game's own backdrop. */
const BACKDROPS: Record<string, string> = {
  'rod-runner': '#90e0ef',
  'tez-gapir': '#0c122e',
  'error-hunt': '#1f0e35',
  'first-reaction': '#ffc1ad',
  'fight-for-life': '#12b8cf',
}

/** How far the banner zooms out: the game's page as it looks on a screen, a little smaller. */
const COVER_SCALE = 0.72

function ScaledStage({ width, cover, children }: { width: number; cover: boolean; children: ReactNode }) {
  const frame = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const [fit, setFit] = useState({ scale: 0.3, left: 0, top: 0, width })

  useLayoutEffect(() => {
    const outer = frame.current?.parentElement
    const inner = stage.current
    if (!outer || !inner) return
    const measure = () => {
      // The screen's own height, without the stretch below that makes it fill the box.
      inner.style.minHeight = ''
      const height = inner.offsetHeight || 1
      if (cover) {
        /*
          The banner: the page is laid out at the banner's own width, as the game's page
          would be on a screen that wide, and zoomed out until all of it fits the banner's
          height — top bar to microphone — while its backdrop still runs edge to edge.
        */
        const scale = Math.min(COVER_SCALE, (outer.clientHeight - 12) / height)
        setFit({ scale, left: 0, top: Math.max(0, (outer.clientHeight - height * scale) / 2), width: outer.clientWidth / scale })
        return
      }
      /*
        A card: the game fills the whole box, edge to edge, with nothing of a frame around it.
        The page is laid out at the card's own shape — as wide as the box at the scale that
        fits its full height — so its backdrop runs to every edge instead of leaving bands.
      */
      const scale = Math.min(outer.clientWidth / width, outer.clientHeight / height)
      inner.style.minHeight = `${outer.clientHeight / scale}px`
      setFit({ scale, left: 0, top: 0, width: outer.clientWidth / scale })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [width, cover])

  return <div ref={frame} className="contents">
    <div ref={stage} className="game-preview__stage" style={{ width: fit.width, transform: `translate(${fit.left}px, ${fit.top}px) scale(${fit.scale})` }}>
      {children}
    </div>
  </div>
}

/* ------------------------------------------------------------------ Лёд и род */

function RunnerPreview({ running, onScore }: { running: boolean; onScore?: (score: number) => void }) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const world = useRef(makeWorld())
  const scored = useRef(onScore)
  useEffect(() => { scored.current = onScore }, [onScore])

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    let frame = 0
    const paint = (now: number) => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = element.clientWidth
      const height = element.clientHeight
      if (!width || !height) return
      if (element.width !== Math.round(width * ratio)) {
        element.width = Math.round(width * ratio)
        element.height = Math.round(height * ratio)
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawWorld(context, width, height, world.current, 'playing', now, true)
    }
    if (!running || prefersReducedMotion()) {
      world.current.lastTime = performance.now()
      paint(performance.now())
      return
    }
    const loop = (now: number) => {
      if (advanceDemo(world.current, now)) scored.current?.(world.current.score)
      paint(now)
      frame = requestAnimationFrame(loop)
    }
    world.current.lastTime = performance.now()
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [running])

  return <canvas ref={canvas} />
}

/* ------------------------------------------------------------------ Tez gapir */

function TezGapirPreview({ running }: { running: boolean }) {
  const { locale } = useLocale()
  const copy = copies[locale]
  const t = useDemoClock(running) % 34
  const said = Math.min(TEZ_GAPIR_WORDS.length, Math.floor(t / 1.6))
  const session = demoSession('tez-gapir', {
    prompt: demoPrompt('demo-family', 'Семья', 'theme'), score: said, roundIndex: 1, totalRounds: 3, durationSeconds: 30,
  })
  return <div className="sg" data-game="tez-gapir" data-session="active">
    <TezGapirBackdrop />
    <div className="sg-content">
      <div className="sg-hud" data-round={1}><span>{copy.rounds} 2 / 3</span><span>{copy.score} <strong>{said}</strong></span></div>
      <div className="sg-progress"><span style={{ width: '33.3%' }} /></div>
      <div className="sg-board" data-listening="true">
        <TezGapirScene enabled session={session} seconds={Math.max(0, 30 - t)} listening copy={copy}>
          <h1 className="sg-prompt" lang="ru">Семья</h1>
        </TezGapirScene>
        <div className="sg-transcript"><small>{copy.answer}</small><TezGapirTranscript text={TEZ_GAPIR_WORDS.slice(0, said).join(' ') || '…'} /></div>
      </div>
    </div>
  </div>
}

/* ------------------------------------------------------------------ Xato ovchisi */

function ErrorHuntPreview({ running }: { running: boolean }) {
  const { locale } = useLocale()
  const copy = copies[locale]
  const clock = useDemoClock(running)
  const round = Math.floor(clock / 13) % ERROR_HUNT_ROUNDS.length
  const t = clock % 13
  const sentence = ERROR_HUNT_ROUNDS[round]
  const fixed = t >= 6
  const session = demoSession('error-hunt', {
    prompt: demoPrompt(`demo-hunt-${round}`, fixed ? sentence.right : sentence.wrong, 'correction'),
    roundIndex: 2, totalRounds: 5, durationSeconds: 10, score: 2 + (fixed ? 1 : 0),
    status: fixed ? 'feedback' : 'answering',
    feedback: fixed ? solvedFeedback(sentence.right) : null,
    history: [demoTurn(0, true), demoTurn(1, false), ...(fixed ? [demoTurn(2, true)] : [])],
  })
  const seconds = fixed ? 4 : Math.max(0, 10 - t)
  return <div className="sg" data-game="error-hunt">
    <div className="sg-content">
      <div className="sg-hud"><span>{copy.rounds} 3 / 5</span><span>{copy.score} <strong>{session.score}</strong></span></div>
      <div className="sg-board" data-listening={!fixed}>
        <ErrorHuntScene enabled session={session} seconds={seconds} timer={<Timer seconds={seconds} duration={10} label={copy.seconds} starred />}>
          <h1 className="sg-prompt" lang="ru">{session.prompt.textRu}</h1>
        </ErrorHuntScene>
      </div>
      <ErrorHuntProgress session={session} copy={copy} />
    </div>
  </div>
}

/* ------------------------------------------------------------------ Birinchi reaksiya */

function FirstReactionPreview({ running }: { running: boolean }) {
  const { locale } = useLocale()
  const text = firstReactionCopies[locale]
  const clock = useDemoClock(running)
  const index = Math.floor(clock / 23) % FIRST_REACTION_SCENES.length
  const t = clock % 23
  const scene = FIRST_REACTION_SCENES[index]
  const left = Math.max(0, 20 - t)
  const said = scene.answer.slice(0, Math.max(0, Math.floor((t - 1.5) * 9)))
  const ring = 2 * Math.PI * 98
  return <div className="sg" data-game="first-reaction" data-stage="answering">
    <div className="fr-backdrop"><i /><i /><i /></div>
    <div className="fr-content">
      <div className="fr-hud">
        <div><strong>2 <small>/ 5</small></strong></div>
        <div className="fr-round-dots">{Array.from({ length: 5 }, (_, dot) => <i key={dot} data-complete={dot < 1} data-current={dot === 1} />)}</div>
        <div className="fr-hud-score"><strong>7</strong></div>
      </div>
      <div className="fr-play-grid" data-active="true" data-feedback="false">
        <section className="fr-situation fr-glass">
          <div className="fr-scene-visual">
            <FirstReactionMedia prompt={demoPrompt(scene.id, scene.textRu, 'reaction', scene.scene)} />
            <span className="fr-scene-label"><Sparkles size={14} />2 / 5</span>
          </div>
          <div className="fr-situation-text"><div className="fr-situation-heading"><h1 lang="ru">{scene.textRu}</h1></div></div>
        </section>
        <section className="fr-response fr-glass" data-mood={left <= 4 ? 'urgent' : left <= 9 ? 'warning' : 'calm'} data-listening="true" data-reacting={said.length > 0}>
          <div className="fr-portrait" data-speaking={said.length > 0} data-celebrating="false">
            <div className="fr-portrait-aura" />
            <img src="/games/first-reaction/characters/penguin.webp" width="512" height="512" alt="" />
          </div>
          <div className="fr-mic-timer" data-active="true">
            <svg viewBox="0 0 220 220"><circle cx="110" cy="110" r="98" /><circle cx="110" cy="110" r="98" strokeDasharray={ring} strokeDashoffset={ring * (1 - left / 20)} /></svg>
            <span className="fr-mic-core" data-recording="true"><Square size={34} fill="currentColor" /></span>
            <strong className="fr-time-value">{Math.ceil(left)}</strong>
          </div>
          <div className="fr-equalizer" data-moving={said.length > 0} data-active="true">{[12, 22, 34, 18, 42, 28, 14, 32, 40, 20, 30, 16, 25].map((height, bar) => <i key={bar} style={{ '--fr-bar': `${height}px`, '--fr-delay': `${bar * -0.11}s` } as CSSProperties} />)}</div>
          <div className="fr-transcript"><small>{text.transcript}</small><p lang="ru">{said || '…'}</p></div>
        </section>
      </div>
    </div>
  </div>
}

/* ------------------------------------------------------------------ Помоги! */

function LifePreview({ running }: { running: boolean }) {
  const { locale } = useLocale()
  const copy = lifeCopies[locale]
  const clock = useDemoClock(running)
  const t = clock % 5.5
  const talking = t < 4
  const energy = 0.55 + 0.4 * Math.min(1, (clock % 22) / 16)
  const crystals = 12 + Math.floor(clock / 1.4) % 40
  return <div className="life-game" data-character="penguin" data-phase="playing" data-emotion={talking ? 'speaking' : 'waiting'} style={{ '--world-energy': energy } as CSSProperties}>
    <div className="life-bokeh"><i /><i /><i /></div>
    <div className="life-wrap">
      <section className="life-play">
        <div className="life-hud"><div><Gem size={21} /><strong>{crystals}</strong></div></div>
        <div className="life-topic"><h1 lang="ru">{LIFE_TOPIC.title}</h1><span>{copy.debate} · A1</span></div>
        <div className="life-stage">
          <LifeScene character="penguin" emotion={talking ? 'speaking' : 'waiting'} energy={energy} volume={talking ? 0.7 : 0} />
          <div className="life-speech" lang="ru">{LIFE_TOPIC.line}</div>
        </div>
        <span className="life-mic" data-speaking={talking}>
          <span className="life-mic-bars">{[0, 1, 2, 3, 4].map((bar) => <i key={bar} style={{ height: `${12 + (talking ? 0.7 : 0.1) * (bar % 2 ? 30 : 18)}px` }} />)}</span>
          <span>{copy.stop}</span>
        </span>
      </section>
    </div>
  </div>
}

/* ------------------------------------------------------------------ anything else */

function MarkPreview({ slug }: { slug: string }) {
  return <div className="grid h-full w-full place-items-center bg-gradient-to-br from-signal/25 to-signal/5">
    {isSpeakingGame(slug) ? <GameMark game={slug} className="size-20 text-signal-ink" /> : null}
  </div>
}
