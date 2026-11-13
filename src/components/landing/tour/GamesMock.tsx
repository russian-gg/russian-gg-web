import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import {
  ArrowLeft,
  AudioLines,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Compass,
  Crown,
  Gamepad2,
  MessageCircle,
  Mic,
  Play,
  RotateCcw,
  Share2,
  ShieldCheck,
  Target,
  Trophy,
  UserRound,
  Volume2,
  X,
} from 'lucide-react'
import { cx } from '../../../lib/cx'
import { fill, useT } from '../../../lib/i18n'
import { SawScene } from '../../../routes/games/saw/SawScene'
import { sawCopy as c } from '../../../routes/games/saw/copy'
import {
  SAW_CHARACTERS,
  SAW_CHARACTER_INFO,
  SAW_TOPICS,
  sawCharacterImage,
  type SawEmotion,
  type SawPhase,
} from '../../../routes/games/saw/model'
import '../../../routes/games/saw/saw.css'
import type { MockProps } from './DemoStage'
import type { GamesState } from './scenes'

/**
 * Games: the real games shelf (`routes/games/Games.tsx`) inside the app shell, then «Пила»
 * (`routes/games/saw/SawGameView.tsx`) — its setup screen, a voice round against the steel
 * workshop penguin, and its results.
 *
 * The game is drawn with its own stylesheet and its own `SawScene` (blade, room, penguin), at
 * the width of a real screen and scaled down whole, the way the shelf's own previews do it. The
 * game's copy is Russian in every interface language, as it is in the product.
 */

/* ------------------------------------------------------------------------------ data */

/** The questions and answers are `SawPreview`'s own demo material. */
const ROUNDS = [
  {
    question: 'Что ты делаешь каждый день?',
    answer: 'Каждый день я работаю и учу русский язык. Вечером я читаю и гуляю с друзьями.',
  },
  {
    question: 'Ты выбираешь чай или кофе? Почему?',
    answer: 'Я выбираю чай, потому что он помогает мне отдыхать. Люблю пить его вечером и читать книгу.',
  },
] as const

/** What `resultFor` makes of a minute of those answers. */
const RESULT = { confidence: 77, words: 38, spokenSeconds: 46, favouriteWord: 'я' }

const CHARACTER = 'penguin'
const INFO = SAW_CHARACTER_INFO[CHARACTER]

/** The shelf: the runner leads, as it does on the real page. */
const SHELF = ['rod-runner', 'arra', 'tez-gapir', 'first-reaction'] as const
type Slug = (typeof SHELF)[number]

/* ------------------------------------------------------------------------------ mock */

export function GamesMock({ state, compact }: MockProps<GamesState>) {
  return (
    <div className="relative size-full overflow-hidden bg-ground-sunken">
      <AnimatePresence initial={false}>
        <m.div
          key={state.view}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.28 } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
        >
          {state.view === 'shelf' ? <Shelf state={state} compact={compact} /> : <Arra state={state} compact={compact} />}
        </m.div>
      </AnimatePresence>
    </div>
  )
}

/* ---------------------------------------------------------------------------- shell */

const NAV = [
  { key: 'today', icon: CalendarDays },
  { key: 'path', icon: Compass },
  { key: 'practice', icon: Target },
  { key: 'tests', icon: ClipboardCheck },
  { key: 'progress', icon: BarChart3 },
  { key: 'games', icon: Gamepad2 },
] as const

function Wordmark() {
  return (
    <span className="min-w-0 truncate text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </span>
  )
}

/** `AppShell`'s rail, at the mock's width. */
function Rail() {
  const t = useT()
  return (
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-hairline bg-ground-raised px-4 py-5">
      <Wordmark />
      <nav className="mt-7 flex flex-col gap-0.5">
        {NAV.map(({ key, icon: Icon }) => (
          <span
            key={key}
            className={cx(
              '-mx-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[14px]',
              key === 'games' ? 'bg-signal-soft font-extrabold text-signal-ink' : 'font-bold text-ink-muted',
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon aria-hidden="true" strokeWidth={1.7} className="size-5 shrink-0" />
              <span className="truncate">{t.nav[key]}</span>
            </span>
            {key === 'path' && (
              <span className="inline-flex items-center rounded-[var(--radius-control)] bg-ground-sunken px-2 py-0.5 text-[11px] font-extrabold text-ink-muted tabular-nums">
                4/90
              </span>
            )}
          </span>
        ))}
      </nav>
      <span className="raised mt-auto flex w-full items-center gap-2.5 rounded-2xl border border-hairline bg-ground-raised px-2.5 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal text-[13px] font-semibold text-on-signal">
          {t.account.learner.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-bold text-ink">{t.account.learner}</span>
      </span>
    </aside>
  )
}

/** `AppShell`'s phone header. */
function PhoneHeader() {
  const t = useT()
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline bg-ground/95 px-4 py-2">
      <Wordmark />
      <span className="raised flex items-center rounded-2xl border border-hairline bg-ground-raised px-2.5 py-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
          {t.account.learner.slice(0, 2).toUpperCase()}
        </span>
      </span>
    </header>
  )
}

/** `AppShell`'s phone tab bar: the rail without Tests. */
function TabBar() {
  const t = useT()
  return (
    <nav className="flex shrink-0 items-stretch border-t border-hairline bg-ground/95">
      {NAV.filter((item) => item.key !== 'tests').map(({ key, icon: Icon }) => (
        <span
          key={key}
          className={cx(
            'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2.5',
            key === 'games' ? 'font-extrabold text-signal-ink' : 'font-bold text-ink-faint',
          )}
        >
          <Icon aria-hidden="true" strokeWidth={1.7} className="size-6 shrink-0" />
          <span className="w-full truncate px-0.5 text-center text-[11px] leading-none">{t.nav[`${key}Short`]}</span>
        </span>
      ))}
    </nav>
  )
}

/* ---------------------------------------------------------------------------- shelf */

/** `Games.tsx`'s icon tiles. */
const ICONS: Record<Slug, { background: string; image?: string }> = {
  arra: { background: 'linear-gradient(145deg,#20384b,#13131f)', image: '/games/arra/v3/penguin-idle.webp' },
  'rod-runner': { background: 'linear-gradient(160deg,#00b4d8,#90e0ef 60%,#e4faff)' },
  'tez-gapir': { background: 'linear-gradient(160deg,#141b40,#34386a)', image: '/games/characters/penguin.webp' },
  'first-reaction': { background: 'linear-gradient(135deg,#ffd3a5,#f9a3bd)', image: '/games/first-reaction/characters/penguin.webp' },
}

/** `GamePreview`'s backdrop colours. */
const BACKDROPS: Record<Slug, string> = {
  arra: '#10191b',
  'rod-runner': '#90e0ef',
  'tez-gapir': '#0c122e',
  'first-reaction': '#ffc1ad',
}

function GameIcon({ slug }: { slug: Slug }) {
  const icon = ICONS[slug]
  return (
    <span
      aria-hidden="true"
      className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
      style={{ background: icon.background }}
    >
      {slug === 'rod-runner' ? (
        <span className="block size-[90%] bg-[url('/games/rod-runner/runner-penguin-sprites.png')] bg-[length:400%_200%] bg-left-top bg-no-repeat" />
      ) : (
        <img src={icon.image} alt="" width="512" height="512" loading="lazy" decoding="async" className="mt-[14%] size-[82%] object-contain" />
      )}
    </span>
  )
}

function useGameCopy(slug: Slug) {
  const t = useT().arcade
  if (slug === 'arra') return { title: 'Пила: Детектор лжи', body: 'Три характера. Три мира. Говори по-русски, чтобы отвести пилу.', meta: 'Голосовое испытание · 60 секунд' }
  const label = (t.games as Record<string, { title: string; body: string } | undefined>)[slug]
  const meta = (t.meta as Record<string, string | undefined>)[slug]
  return { title: label?.title ?? '', body: label?.body ?? '', meta: meta ?? '' }
}

function Shelf({ state, compact }: { state: GamesState; compact: boolean }) {
  const t = useT().arcade
  const page = (
    <div
      className={cx(
        'flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
        compact ? 'gap-8 px-4 pt-4 pb-10' : 'gap-8 px-7 pt-6 pb-10',
      )}
      style={{ transform: compact && state.scrolled ? 'translateY(-292px)' : undefined }}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          {!compact && (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-signal/30 bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)]">
              <Gamepad2 aria-hidden="true" strokeWidth={2} className="size-7" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className={cx('font-black tracking-tight text-ink', compact ? 'text-2xl' : 'text-3xl')}>{t.title}</h1>
            <p className={cx('mt-0.5 text-ink-muted', compact ? 'text-sm' : 'text-base')}>{t.subtitle}</p>
          </div>
        </div>
        <span className="rounded-full border border-hairline bg-ground-raised px-3.5 py-1.5 text-sm font-extrabold text-ink-muted shadow-[0_4px_16px_rgb(22_24_29/0.05)]">
          {fill(t.gameCount, { count: SHELF.length })}
        </span>
      </header>
      <div className={cx('grid gap-x-6 gap-y-8', !compact && 'grid-cols-2')}>
        {SHELF.map((slug) => (
          <GameCard key={slug} slug={slug} />
        ))}
      </div>
    </div>
  )

  if (compact) {
    return (
      <div className="flex size-full flex-col bg-ground-sunken">
        <PhoneHeader />
        <div className="relative min-h-0 flex-1 overflow-hidden">{page}</div>
        <TabBar />
      </div>
    )
  }
  return (
    <div className="flex size-full bg-ground-sunken">
      <Rail />
      <div className="relative min-w-0 flex-1 overflow-hidden">{page}</div>
    </div>
  )
}

function GameCard({ slug }: { slug: Slug }) {
  const copy = useGameCopy(slug)
  const play = useT().arcade.play
  return (
    <span data-tour={`game-${slug}`} data-tour-y="0.12" className="tour-game-card flex flex-col text-ink">
      <span className="flex items-center gap-3 px-0.5">
        <GameIcon slug={slug} />
        <span className="min-w-0 flex-1">
          <strong lang={slug === 'tez-gapir' || slug === 'first-reaction' ? undefined : 'ru'} className="block truncate text-[17px] leading-[22px] font-black">
            {copy.title}
          </strong>
          <span className="block truncate text-[13px] leading-[18px] font-bold text-ink-faint">{copy.meta}</span>
        </span>
        <span className="tour-game-play raised raised-signal inline-flex min-h-10 min-w-[104px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-signal px-4 text-sm font-black whitespace-nowrap text-on-signal">
          <Play aria-hidden="true" className="size-3.5 fill-current" strokeWidth={0} />
          {slug === 'arra' ? 'Играть' : play}
        </span>
      </span>
      <span className="mx-0.5 mt-2 mb-3.5 line-clamp-2 min-h-[2.9em] text-sm leading-[1.45] text-ink-muted">{copy.body}</span>
      <span className="tour-game-shot block overflow-hidden rounded-[22px] shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_18px_32px_-22px_rgb(15_23_42/0.5)]">
        <span className="relative block aspect-video overflow-hidden" style={{ background: BACKDROPS[slug] }}>
          <CardPreview slug={slug} />
        </span>
      </span>
    </span>
  )
}

/** A still of what each card's live preview plays. */
function CardPreview({ slug }: { slug: Slug }) {
  if (slug === 'arra') {
    return (
      <Fit width={900}>
        {(style, ref) => (
          <div ref={ref} style={style} className="arra-page" data-preview="true" data-phase="playing" data-character={CHARACTER}>
            <div className="arra-wrap">
              <div className="arra-preview-caption">
                <strong>{INFO.name}</strong>
                <span>
                  {INFO.trait} · {INFO.location}
                </span>
                <i>
                  {SAW_CHARACTERS.map((hero) => (
                    <b key={hero} data-current={hero === CHARACTER} />
                  ))}
                </i>
              </div>
              <Arena threat={34} seconds={49} round={0} words={6} speaking emotion="speaking" phase="playing" />
            </div>
          </div>
        )}
      </Fit>
    )
  }
  if (slug === 'rod-runner') {
    return <img src="/games/rod-runner-play.webp" alt="" width={848} height={472} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
  }
  if (slug === 'tez-gapir') {
    return (
      <span className="absolute inset-0 flex items-center justify-center gap-6 bg-[linear-gradient(155deg,#0a0e27,#1a1f4e)]">
        <img src="/games/characters/penguin.webp" alt="" width={512} height={512} loading="lazy" decoding="async" className="h-[70%] w-auto" />
        <span lang="ru" className="text-[34px] font-black text-white">
          Семья
        </span>
      </span>
    )
  }
  return (
    <span className="absolute inset-0 flex items-center gap-3 bg-[linear-gradient(135deg,#ffd3a5,#f9a3bd)] p-4">
      <img src="/games/first-reaction/media-v2/job_interview.webp" alt="" width={640} height={360} loading="lazy" decoding="async" className="h-full w-[62%] rounded-xl object-cover" />
      <img src="/games/first-reaction/characters/penguin.webp" alt="" width={512} height={512} loading="lazy" decoding="async" className="h-[80%] w-auto flex-1 object-contain" />
    </span>
  )
}

/* ----------------------------------------------------------------------- the game */

/**
 * A screen laid out at `width` and scaled into its box, as `GamePreview`'s `ScaledStage`
 * does: the whole screen fits, and its background stretches to every edge of the box.
 */
function Fit({
  width,
  children,
}: {
  width: number
  children: (style: CSSProperties, ref: (node: HTMLDivElement | null) => void) => ReactNode
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [fit, setFit] = useState<{ scale: number; width: number; minHeight?: number } | null>(null)
  const last = useRef('')

  useLayoutEffect(() => {
    const outer = node?.parentElement
    if (!node || !outer) return
    const measure = () => {
      node.style.minHeight = ''
      const height = node.offsetHeight || 1
      const scale = Math.min(outer.clientWidth / width, outer.clientHeight / height)
      const next = { scale, width: outer.clientWidth / scale, minHeight: outer.clientHeight / scale }
      node.style.minHeight = `${next.minHeight}px`
      const key = `${next.scale.toFixed(4)}:${next.width.toFixed(1)}`
      if (key !== last.current) {
        last.current = key
        setFit(next)
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    observer.observe(node)
    return () => observer.disconnect()
  }, [node, width])

  return children(
    {
      position: 'absolute',
      left: 0,
      top: 0,
      width: fit?.width ?? width,
      minHeight: fit?.minHeight,
      transform: `scale(${fit?.scale ?? 0.5})`,
      transformOrigin: '0 0',
      visibility: fit ? undefined : 'hidden',
    },
    setNode,
  )
}

function emotionOf(state: GamesState): SawEmotion {
  if (state.speaking) return 'speaking'
  return state.threat >= 80 ? 'panic' : state.threat >= 40 ? 'silence' : 'idle'
}

function Arra({ state, compact }: { state: GamesState; compact: boolean }) {
  const phase: SawPhase = state.view === 'setup' ? 'ready' : state.view === 'result' ? 'won' : 'playing'
  const danger = phase === 'playing' && state.threat >= 80
  return (
    <Fit width={compact ? 420 : 1320}>
      {(style, ref) => (
        <main
          ref={ref}
          style={style}
          className="arra-page tour-arra"
          data-phase={phase}
          data-danger={danger}
          data-character={CHARACTER}
          data-phone={compact || undefined}
        >
          <div className="arra-wrap">
            <header className="arra-nav">
              <span data-tour="arra-back" className="tour-arra-back">
                <ArrowLeft size={18} />
                {c.back}
              </span>
              <span className="arra-brand">
                {c.title}
                <i />
                {c.subtitle}
              </span>
              <div className="arra-nav-actions">
                <span className="arra-score">
                  <Trophy size={15} />
                  <span>{c.score}</span>
                  {phase === 'won' ? 1 : 0}
                </span>
                <span className="arra-sound">
                  <Volume2 size={17} />
                </span>
              </div>
            </header>

            {phase === 'ready' && <Setup />}
            {phase === 'playing' && (
              <>
                <Arena
                  threat={state.threat}
                  seconds={state.seconds}
                  round={state.round}
                  words={state.words}
                  speaking={state.speaking}
                  emotion={emotionOf(state)}
                  phase={phase}
                />
                <div className="arra-live-controls">
                  <div className="arra-recording" data-speaking={state.speaking} style={{ '--voice-size': state.speaking ? 0.7 : 0 } as CSSProperties}>
                    <span className="arra-mic-disc">
                      <AudioLines size={30} />
                    </span>
                    <span>{state.speaking ? c.speaking : c.recording}</span>
                  </div>
                  <span className="arra-surrender">
                    <X size={14} />
                    {c.surrender}
                  </span>
                </div>
              </>
            )}
            {phase === 'won' && <Results />}
          </div>
        </main>
      )}
    </Fit>
  )
}

/** `SawGameView`'s setup: the three characters, the topic, the rules and the start disc. */
function Setup() {
  return (
    <section className="arra-setup">
      <div className="arra-intro">
        <span className="arra-eyebrow">
          <AudioLines size={14} />
          {c.eyebrow}
        </span>
        <h1>{c.headline}</h1>
        <p>{c.intro}</p>
      </div>
      <h2 className="arra-section-label">{c.choose}</h2>
      <div className="arra-character-grid">
        {SAW_CHARACTERS.map((hero) => {
          const info = SAW_CHARACTER_INFO[hero]
          return (
            <span
              key={hero}
              className="arra-character-card"
              data-character={hero}
              data-selected={hero === CHARACTER}
              style={{ '--card-accent': info.accent } as CSSProperties}
            >
              <span className="arra-character-check">{hero === CHARACTER ? <Check size={15} /> : <span />}</span>
              <span
                className="arra-character-art"
                style={{ backgroundImage: `linear-gradient(180deg,transparent,#101516 100%),url('/games/arra/v3/${hero}-room.webp')` }}
              >
                <img src={sawCharacterImage(hero)} alt="" width="512" height="768" draggable={false} />
              </span>
              <span className="arra-character-copy">
                <strong>{info.name}</strong>
                <span className="arra-character-trait">{info.trait}</span>
                <small>{info.location}</small>
              </span>
              <span className="arra-character-quote">«{info.quote}»</span>
            </span>
          )
        })}
      </div>
      <div className="arra-setup-bottom">
        <span className="arra-topic">
          <span>{c.topic}</span>
          <span className="arra-select-wrap">
            <span className="tour-arra-select">{SAW_TOPICS[0].label}</span>
            <ChevronDown size={17} />
          </span>
        </span>
        <div className="arra-rules">
          <span>
            <Mic size={15} />
            {c.speak}
          </span>
          <span>
            <ShieldCheck size={15} />
            {c.retreat}
          </span>
          <span>
            <Clock3 size={15} />
            {c.survive}
          </span>
        </div>
        <span data-tour="arra-start" className="arra-start tour-arra-start">
          <span className="arra-mic-disc">
            <Mic size={29} />
          </span>
          <strong>{c.start}</strong>
        </span>
      </div>
    </section>
  )
}

/** `SawGameView`'s arena: threat meter and clock, the workshop, the question, the transcript. */
function Arena({
  threat,
  seconds,
  round,
  words,
  speaking,
  emotion,
  phase,
}: {
  threat: number
  seconds: number
  round: number
  words: number
  speaking: boolean
  emotion: SawEmotion
  phase: SawPhase
}) {
  const danger = phase === 'playing' && threat >= 80
  const status = speaking ? c.pushing : danger ? c.danger : c.waiting
  const current = ROUNDS[round] ?? ROUNDS[0]
  const transcript = current.answer.split(' ').slice(0, words).join(' ')
  return (
    <section className="arra-arena" data-danger={danger}>
      <div className="arra-hud">
        <div className="arra-suspicion">
          <div className="arra-suspicion-heading">
            <span>{c.threat}</span>
            <strong>
              {Math.round(threat)}
              <small>%</small>
            </strong>
          </div>
          <div className="arra-suspicion-track">
            <i style={{ width: `${threat}%` }} />
          </div>
        </div>
        <div className="arra-clock">
          <Clock3 size={16} />
          <strong>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </strong>
          <span>{c.seconds}</span>
        </div>
      </div>
      <div className="arra-stage-frame">
        <SawScene blade={threat} phase={phase} speaking={speaking} character={CHARACTER} emotion={emotion} />
        <div className="arra-stage-status" data-speaking={speaking} data-danger={danger}>
          <span className="arra-status-dot" />
          {status}
        </div>
      </div>
      <div className="arra-question-row">
        <span className="arra-speaker-line" />
        <div className="arra-question">
          <span className="arra-eyebrow">
            {INFO.name} · {c.question} {round + 1}
          </span>
          <h2 key={round} className="tour-arra-question">
            {current.question}
          </h2>
        </div>
      </div>
      <div className="arra-transcript" data-speaking={speaking}>
        <Mic size={14} aria-hidden="true" />
        <p>{transcript || c.listening}</p>
        <span className="arra-wave">
          {Array.from({ length: 13 }, (_, index) => (
            <i key={index} style={{ height: `${4 + (speaking ? 0.7 : 0) * (10 + ((index * 11) % 21))}px`, animationDelay: `${(index * 83) % 460}ms` }} />
          ))}
        </span>
      </div>
    </section>
  )
}

/** `SawGameView`'s results after a won round, with `SawShareButton` beside «Ещё раз». */
function Results() {
  return (
    <section className="arra-results">
      <div className="arra-result-heading">
        <span className="arra-eyebrow">{c.result}</span>
        <h1>{c.won}</h1>
        <p>{c.wonBody}</p>
      </div>
      <div className="arra-result-scene">
        <SawScene blade={0} phase="won" speaking={false} character={CHARACTER} emotion="happy" />
        <span className="arra-point">
          <Trophy size={16} />
          {c.point}
        </span>
      </div>
      <div className="arra-result-stats">
        <div>
          <ShieldCheck size={19} />
          <span>{c.confidence}</span>
          <strong>
            {RESULT.confidence}
            <small>%</small>
          </strong>
        </div>
        <div>
          <MessageCircle size={19} />
          <span>{c.words}</span>
          <strong>{RESULT.words}</strong>
        </div>
        <div>
          <Clock3 size={19} />
          <span>{c.time}</span>
          <strong>
            {RESULT.spokenSeconds}
            <small> {c.seconds}</small>
          </strong>
        </div>
        <div className="arra-favourite">
          <span className="arra-quote-mark">“</span>
          <span>{c.favourite}</span>
          <strong>«{RESULT.favouriteWord}»</strong>
        </div>
      </div>
      <div className="arra-earned">
        <span className="arra-badge-art">
          <img src={sawCharacterImage(CHARACTER, 'happy')} alt="" width="80" height="110" />
          <Crown size={20} />
        </span>
        <span>
          <small>{c.earned}</small>
          <strong>{INFO.title}</strong>
        </span>
        <Check size={19} />
      </div>
      <div className="arra-result-actions">
        <span className="arra-result-next">
          <RotateCcw size={18} />
          {c.retry}
        </span>
        <span className="arra-share">
          <Share2 size={18} aria-hidden="true" />
          Поделиться
        </span>
      </div>
      <span className="arra-change-hero">
        <UserRound size={15} />
        {c.changeHero}
      </span>
    </section>
  )
}
