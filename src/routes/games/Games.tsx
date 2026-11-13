import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, LockKeyhole, Play } from 'lucide-react'
import * as m from 'motion/react-m'
import { useCenterStudent } from '../../lib/center'
import { useOpenGames, type OpenGame } from '../../lib/games'
import { EmptyState, Spinner } from '../../components/ui'
import { Reveal, Sequence } from '../../components/motion'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { rise, stagger } from '../../lib/motion'
import { GamePreview } from './previews/GamePreview'
import { prefersReducedMotion } from './previews/demo'

const MotionLink = m.create(Link)

/** How long each game stays in the featured banner. */
const SLIDE_MS = 8000

/**
 * The games shelf, laid out like a store: one game featured at the top, rotating through
 * every game on a timer, then every game as a card. Both show the game itself playing — its
 * own screen, run by a bot or a scripted round — rather than a picture of it, because what
 * makes somebody try a game is seeing it move.
 *
 * What is on the shelf is the panel's decision: only the games the server says are open are
 * drawn, so nobody is shown a door that does not open.
 */
/** The banner of featured games above the list. Off for now: the list of games is enough. */
const SHOW_FEATURED = false

export function Games() {
  const open = useOpenGames()
  const t = useT().arcade

  if (!open) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  // The runner leads: it is the one game that needs no microphone.
  const games = [...open].sort((left, right) => Number(right.slug === 'rod-runner') - Number(left.slug === 'rod-runner'))

  return (
    <Sequence className="space-y-8 sm:space-y-10" gap={stagger.base}>
      {/* One heading for the page, the way the missions and the 90 days open: the list is the page. */}
      <Reveal>
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-signal/30 bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)] sm:flex">
              <Gamepad2 aria-hidden="true" strokeWidth={2} className="size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">{t.title}</h1>
              <p className="mt-0.5 text-sm text-ink-muted sm:text-base">{t.subtitle}</p>
            </div>
          </div>
          {games.length > 0 && (
            <span className="rounded-full border border-hairline bg-ground-raised px-3.5 py-1.5 text-sm font-extrabold text-ink-muted shadow-[0_4px_16px_rgb(22_24_29/0.05)]">
              {fill(t.gameCount, { count: games.length })}
            </span>
          )}
        </header>
      </Reveal>

      {games.length === 0 && (
        <Reveal>
          <EmptyState title={t.emptyTitle} body={t.emptyBody} />
        </Reveal>
      )}

      {SHOW_FEATURED && games.length > 0 && (
        <Reveal>
          <FeaturedGames games={games} />
        </Reveal>
      )}

      {games.length > 0 && (
        <section aria-label={t.allGames}>
          <Sequence className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3" gap={stagger.tight}>
            {games.map((game) => <GameCard key={game.slug} game={game} />)}
          </Sequence>
        </section>
      )}
    </Sequence>
  )
}

/* ------------------------------------------------------------------------ helpers */

/** Pages that do not live under `/games/:slug`. */
const ROUTES: Record<string, string> = {
  arra: '/games/arra',
  'rod-runner': '/games/rod-runner',
  'fight-for-life': '/games/fight-for-life',
}

/**
 * Locked for this learner, not merely a Pro game: a Pro learner sees the game. A locked one
 * leads to the plans — or, for a language center's student, who is sold nothing, to their
 * profile, where the center's state is spelled out.
 */
function destinationOf(game: OpenGame, isCenterStudent: boolean) {
  if (game.isAccessible) return ROUTES[game.slug] ?? `/games/${game.slug}`
  return isCenterStudent ? '/settings' : '/paywall'
}

function useGameCopy(game: OpenGame) {
  const t = useT().arcade
  const label = (t.games as Record<string, { title: string; body: string } | undefined>)[game.slug]
  const meta = (t.meta as Record<string, string | undefined>)[game.slug]
  return { title: label?.title ?? game.titleUz, body: label?.body ?? game.bodyUz, meta: meta ?? '' }
}

/** Titles that are Russian on purpose, and say so to a screen reader. */
const RUSSIAN_TITLES = new Set(['rod-runner', 'fight-for-life'])

const ICONS: Record<string, { background: string; image?: string }> = {
  arra: { background: 'linear-gradient(145deg,#3c3024,#111d20)', image: '/games/arra/penguin-foreman.webp' },
  'rod-runner': { background: 'linear-gradient(160deg,#00b4d8,#90e0ef 60%,#e4faff)' },
  'tez-gapir': { background: 'linear-gradient(160deg,#141b40,#34386a)', image: '/games/characters/penguin.webp' },
  'fight-for-life': { background: 'linear-gradient(145deg,#00b4d8,#00f5d4)', image: '/games/fight-for-life/characters/penguin.webp' },
  'error-hunt': { background: 'linear-gradient(155deg,#1a0b2e,#2d1b4e)', image: '/games/error-hunt/characters/penguin.webp' },
  'first-reaction': { background: 'linear-gradient(135deg,#ffd3a5,#f9a3bd)', image: '/games/first-reaction/characters/penguin.webp' },
}

function GameIcon({ slug, className }: { slug: string; className?: string }) {
  const icon = ICONS[slug]
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center overflow-hidden rounded-[14px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]', className)}
      style={{ background: icon?.background ?? 'linear-gradient(145deg,var(--color-signal-soft),var(--color-ground-sunken))' }}
    >
      {slug === 'rod-runner' ? (
        <span className="block size-[90%] bg-[url('/games/rod-runner/runner-penguin-sprites.png')] bg-[length:400%_200%] bg-left-top bg-no-repeat" />
      ) : icon?.image ? (
        <img src={icon.image} alt="" width="512" height="512" loading="lazy" decoding="async" className="mt-[14%] size-[82%] object-contain" />
      ) : (
        <Gamepad2 className="size-1/2 text-signal-ink" strokeWidth={1.8} />
      )}
    </span>
  )
}

/** The project's own buttons: primary to play, secondary with a lock where Pro is needed. */
function PlayButton({ game, onDark = false }: { game: OpenGame; onDark?: boolean }) {
  const dictionary = useT()
  const t = dictionary.arcade
  // "Pro" on the lock is an offer; a center's student reads only that it is shut.
  const { isCenterStudent } = useCenterStudent()
  if (!game.isAccessible) {
    return (
      <span className="raised inline-flex min-h-10 min-w-[116px] shrink-0 items-center justify-center gap-1.5 rounded-full border-2 border-hairline bg-ground-raised px-4 text-sm font-black whitespace-nowrap text-ink">
        <LockKeyhole aria-hidden="true" className="size-3.5 text-caution" strokeWidth={2.4} />
        {isCenterStudent ? dictionary.path.locked : t.pro}
      </span>
    )
  }
  return (
    <span className={cx('raised raised-signal inline-flex min-h-10 min-w-[116px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-signal px-4 text-sm font-black whitespace-nowrap text-on-signal', onDark && 'shadow-lg')}>
      <Play aria-hidden="true" className="size-3.5 fill-current" strokeWidth={0} />
      {t.play}
    </span>
  )
}

/* ------------------------------------------------------------------------ card */

function GameCard({ game }: { game: OpenGame }) {
  const copy = useGameCopy(game)
  const { isCenterStudent } = useCenterStudent()
  return (
    <MotionLink variants={rise} to={destinationOf(game, isCenterStudent)} className="group flex flex-col text-ink">
      <span className="flex items-center gap-3 px-0.5">
        <GameIcon slug={game.slug} className="size-14" />
        <span className="min-w-0 flex-1">
          <strong lang={RUSSIAN_TITLES.has(game.slug) ? 'ru' : undefined} className="block truncate text-[17px] leading-[22px] font-black">{copy.title}</strong>
          <span className="block truncate text-[13px] leading-[18px] font-bold text-ink-faint">{copy.meta}</span>
        </span>
        <PlayButton game={game} />
      </span>
      <span className="mx-0.5 mt-2 mb-3.5 line-clamp-2 min-h-[2.9em] text-sm leading-[1.45] text-ink-muted">{copy.body}</span>
      <span className="block overflow-hidden rounded-[22px] shadow-[0_0_0_1px_rgb(15_23_42/0.06),0_18px_32px_-22px_rgb(15_23_42/0.5)] transition-[translate,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_24px_40px_-22px_rgb(15_23_42/0.55)]">
        <GamePreview slug={game.slug} />
      </span>
    </MotionLink>
  )
}

/* ------------------------------------------------------------------------ featured */

/** The shade each game's words sit on: its own darkest colour, so the text reads on any frame. */
const SHADES: Record<string, string> = {
  arra: 'rgb(11 18 20 / .94)',
  'rod-runner': 'rgb(4 32 52 / .85)',
  'tez-gapir': 'rgb(8 12 36 / .9)',
  'fight-for-life': 'rgb(3 55 66 / .88)',
  'error-hunt': 'rgb(20 8 36 / .9)',
  'first-reaction': 'rgb(60 20 40 / .85)',
}

const SLIDE_GROUNDS: Record<string, string> = {
  arra: '#10191b',
  'rod-runner': '#90e0ef',
  'tez-gapir': '#0c122e',
  'fight-for-life': '#12b8cf',
  'error-hunt': '#1f0e35',
  'first-reaction': '#ffc1ad',
}

function FeaturedGames({ games }: { games: OpenGame[] }) {
  const [active, setActive] = useState(0)
  const [previous, setPrevious] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const count = games.length
  const current = games[active] ?? games[0]
  const copy = useGameCopy(current)
  const { isCenterStudent } = useCenterStudent()

  useEffect(() => {
    if (count < 2 || prefersReducedMotion()) return
    const timer = window.setTimeout(() => {
      setPrevious(active)
      setActive((active + 1) % count)
    }, SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [active, count])

  return (
    <MotionLink
      variants={rise}
      to={destinationOf(current, isCenterStudent)}
      aria-label={copy.title}
      className="games-hero block"
      style={{ '--hero-slide-ms': `${SLIDE_MS}ms` } as CSSProperties}
    >
      {games.map((game, index) => (
        <FeaturedSlide
          key={game.slug}
          game={game}
          index={index}
          count={count}
          active={index === active}
          // Only the slide on show and the one fading out keep a screen mounted.
          mounted={index === active || index === previous}
          score={score}
          onScore={setScore}
        />
      ))}

      <span aria-hidden="true" className="absolute bottom-[26px] left-7 z-10 flex items-center gap-1.5">
        {games.map((game, index) => (
          <span key={game.slug} className={cx('block h-1.5 rounded-full bg-white transition-[width,opacity] duration-500', index === active ? 'w-[22px] opacity-100' : 'w-1.5 opacity-50')} />
        ))}
      </span>
      {count > 1 && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 z-10 h-[5px] bg-white/30">
          <span key={active} className="games-hero__bar" />
        </span>
      )}
    </MotionLink>
  )
}

function FeaturedSlide({ game, index, count, active, mounted, score, onScore }: {
  game: OpenGame; index: number; count: number; active: boolean; mounted: boolean; score: number; onScore: (score: number) => void
}) {
  const t = useT().arcade
  const copy = useGameCopy(game)
  const lang = RUSSIAN_TITLES.has(game.slug) ? 'ru' : undefined
  const eyebrow = `${t.featured} · ${index + 1}/${count}`
  const runner = game.slug === 'rod-runner'

  const appRow = (
    <span className="flex items-center gap-3 rounded-[20px] bg-white/15 p-2.5 pr-3 backdrop-blur-md">
      <GameIcon slug={game.slug} className="size-14 rounded-2xl" />
      <span className="min-w-0 flex-1">
        <strong lang={lang} className="block truncate text-[15px] font-black">{copy.title}</strong>
        <span className="block truncate text-xs text-white/80">{copy.meta}</span>
      </span>
      <PlayButton game={game} onDark />
    </span>
  )

  return (
    <div className="games-hero__slide" data-active={active} aria-hidden={!active}>
      <span className="absolute inset-0 block max-md:relative max-md:aspect-[16/9]" style={{ background: SLIDE_GROUNDS[game.slug] ?? '#0b1220' }}>
        {mounted && <GamePreview slug={game.slug} running={active} onScore={runner ? onScore : undefined} cover />}
      </span>
      <span aria-hidden="true" className="absolute inset-0 max-md:hidden" style={{ background: `linear-gradient(to top, ${SHADES[game.slug] ?? 'rgb(4 32 52 / .85)'}, transparent 62%)` }} />
      <span className="absolute top-5 left-7 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-black">
        <span className="size-[7px] rounded-full bg-red-500" />
        {runner ? fill(t.liveScore, { score }) : t.live}
      </span>
      <span className="flex flex-col gap-5 p-5 pb-14 max-md:bg-[#0b1220] md:absolute md:inset-x-7 md:bottom-14 md:flex-row md:items-end md:justify-between md:p-0">
        <span className="min-w-0 md:max-w-[56%]">
          <span className="block text-xs font-black tracking-[0.14em] text-cyan-200 uppercase">{eyebrow}</span>
          <strong lang={lang} className="mt-1.5 block text-[34px] leading-none font-black tracking-tight md:text-[44px]">{copy.title}</strong>
          <span className="mt-2 block max-w-[520px] text-base leading-normal text-white/90">{copy.body}</span>
        </span>
        <span className="md:w-[340px]">{appRow}</span>
      </span>
    </div>
  )
}
