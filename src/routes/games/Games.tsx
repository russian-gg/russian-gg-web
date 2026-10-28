import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Dices,
  Footprints,
  Gamepad2,
  Headphones,
  MessageSquare,
  Play,
  Swords,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useOpenGames } from '../../lib/games'
import { EmptyState, Spinner } from '../../components/ui'
import { cx } from '../../lib/cx'
import { useLocale, useT } from '../../lib/i18n'
import { copies, gameLabels, isSpeakingGame } from './speaking/copy'
import { GameMark } from './speaking/visuals'
import { TezGapirCard } from './TezGapirCard'
import { ErrorHuntCard } from './ErrorHuntCard'
import { LifeCard } from './fight-for-life/LifeCard'
import { FirstReactionCard } from './FirstReactionCard'
import * as m from 'motion/react-m'
import { Reveal, Sequence } from '../../components/motion'
import { rise, stagger, tactile } from '../../lib/motion'

/**
 * The card links, animated in place.
 *
 * `m.create` rather than a `<m.div>` wrapped around each `<Link>`, and the distinction is not
 * cosmetic: these links are grid items. The runner card carries `sm:col-span-2` and the others
 * rely on the grid stretching them, so putting a div between the grid and the link hands the
 * grid-item role to the div — the span stops applying, the runner card collapses to a single
 * column, and its fixed-height artwork spills out of a box half its width.
 *
 * Making the link itself the motion element keeps the DOM exactly as it was.
 */
const MotionLink = m.create(Link)

/**
 * The shelf. Built like a store rather than a menu: a grid of tiles, each with its own mark,
 * because what makes somebody try a game is recognising it at a glance and wanting that one.
 *
 * What is on it is the panel's decision, not this file's. Only the artwork lives here — a game
 * the server has not opened is not drawn at all, so nobody is shown a door that does not open.
 */
/**
 * Everything the app can draw, keyed by the slug the server switches on.
 *
 * Drawn marks rather than emoji: this shelf is the first thing a learner sees of a game, and
 * an emoji here rendered at whatever size and colour the platform font felt like — the saw
 * (🪚) in particular is a recent addition that simply does not exist on older Android, so the
 * tile for it was an empty box.
 */
const ART: Record<string, { icon: LucideIcon; tint: string; to?: string }> = {
  arra: { icon: Swords, tint: 'from-signal/25 to-signal/5', to: '/games/arra' },
  'rod-runner': { icon: Footprints, tint: 'from-caution/30 to-signal/10', to: '/games/rod-runner' },
  'soz-ovi': { icon: Target, tint: 'from-milestone/25 to-milestone/5' },
  'tez-javob': { icon: Zap, tint: 'from-caution/25 to-caution/5' },
  dialog: { icon: MessageSquare, tint: 'from-signal/25 to-signal/5' },
  'eshitib-top': { icon: Headphones, tint: 'from-milestone/25 to-milestone/5' },
  xotira: { icon: Dices, tint: 'from-caution/25 to-caution/5' },
}

export function Games() {
  const open = useOpenGames()
  const { locale } = useLocale()
  const t = useT().arcade

  if (!open) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <Sequence className="space-y-5" gap={stagger.base}>
      <Reveal>
        <header>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{t.title}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">{t.subtitle}</p>
        </header>
      </Reveal>

      {/*
        A shelf of games, dealt out. These are the most toy-like surfaces in the product, so
        they get the spring entrance and a press that answers a thumb - the arcade is the one
        place where a card behaving like an object is the entire point.
      */}
      {/* An empty or failed list used to leave the heading over nothing. */}
      {open.length === 0 && (
        <Reveal>
          <EmptyState title={t.emptyTitle} body={t.emptyBody} />
        </Reveal>
      )}

      <Sequence className="grid gap-4 lg:grid-cols-2" gap={stagger.base}>
        {[...open].sort((left, right) => Number(right.slug === 'rod-runner') - Number(left.slug === 'rod-runner')).map((game) => {
          const art = ART[game.slug]
          // The catalogue comes from the server in Uzbek; the names are the client's to translate.
          const label = (t.games as Record<string, { title: string; body: string } | undefined>)[game.slug]
          // Locked for this learner, not merely a Pro game: a Pro learner used to see "Pro kerak".
          const locked = !game.isAccessible
          const destination = locked ? '/paywall' : art?.to ?? `/games/${game.slug}`

          if (game.slug === 'rod-runner') return <RunnerCard key={game.slug} />
          if (game.slug === 'tez-gapir') return <TezGapirCard key={game.slug} to={destination} requiresPro={locked} />
          if (game.slug === 'error-hunt') return <ErrorHuntCard key={game.slug} to={destination} requiresPro={locked} />
          if (game.slug === 'fight-for-life') return <LifeCard key={game.slug} to={destination} requiresPro={locked} />
          if (game.slug === 'first-reaction') return <FirstReactionCard key={game.slug} to={destination} requiresPro={locked} />

          if (isSpeakingGame(game.slug)) {
            const label = gameLabels[game.slug][locale]
            return <MotionLink key={game.slug} variants={rise} {...tactile} to={destination} className="group relative flex min-h-44 items-center gap-4 rounded-3xl border-2 border-hairline bg-ground-raised p-4 sm:gap-5 sm:p-6 transition-colors hover:border-signal">
              {locked && <span className="absolute right-4 top-4 rounded-full bg-caution-soft px-2.5 py-1 text-[11px] font-black text-caution">{t.proRequired}</span>}
              <GameMark game={game.slug} className="size-12 shrink-0 text-signal-ink sm:size-16" />
              <span className="min-w-0"><span className="block text-lg font-black text-ink">{label.title}</span><span className="mt-2 block text-sm leading-relaxed text-ink-muted">{label.description}</span><span className="mt-4 flex items-center gap-1.5 text-sm font-extrabold text-signal-ink">{locked ? t.unlockWithPro : copies[locale].start} <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2.4} /></span></span>
            </MotionLink>
          }

          return (
            <MotionLink
              key={game.slug}
              variants={rise}
              {...tactile}
              to={destination}
              className="relative flex items-center gap-3.5 rounded-[var(--radius-card)] border-2 border-hairline bg-ground-raised p-3.5 text-left transition-colors hover:border-signal"
            >
              {locked && <span className="absolute right-3 top-3 rounded-full bg-caution-soft px-2.5 py-1 text-[11px] font-black text-caution">{t.proRequired}</span>}
              <span
                className={cx(
                  'grid size-14 shrink-0 place-items-center rounded-[var(--radius-card)] bg-gradient-to-br',
                  art?.tint ?? 'from-signal/25 to-signal/5',
                )}
                aria-hidden
              >
                {(() => {
                  const Icon = art?.icon ?? Gamepad2
                  return <Icon aria-hidden="true" strokeWidth={1.7} className="size-7 text-signal-ink" />
                })()}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-base font-black text-ink">{label?.title ?? game.titleUz}</span>
                <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{label?.body ?? game.bodyUz}</span>
              </span>
            </MotionLink>
          )
        })}
      </Sequence>
    </Sequence>
  )
}

function RunnerCard() {
  const t = useT().arcade

  return (
    /*
      The card is the grid item, so `sm:col-span-2` stays on it and the entrance rides on the
      same element. No `tactile` here: this one already lifts on hover in CSS, and a second
      hover transform would just be two rules arguing about the same pixels.
    */
    <MotionLink
      variants={rise}
      to="/games/rod-runner"
      className="group relative overflow-hidden rounded-[32px] border border-cyan-100/80 bg-gradient-to-br from-[#007eac] via-[#209fc0] to-[#49bdbf] p-5 text-white shadow-2xl transition duration-300 hover:-translate-y-1 sm:p-7 lg:col-span-2"
    >
      <span className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-amber-500/10 blur-3xl transition group-hover:bg-amber-500/20" />
      <span className="pointer-events-none absolute -bottom-20 -left-20 size-64 rounded-full bg-blue-500/10 blur-3xl" />

      <span className="relative grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <span className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-cyan-100/70 bg-[url('/games/rod-runner/sunny-canyon.webp')] bg-cover bg-center">
          <span className="absolute inset-x-[18%] bottom-0 h-32 origin-bottom bg-gradient-to-t from-cyan-100 to-sky-300/60 [clip-path:polygon(43%_0,57%_0,100%_100%,0_100%)]" />
          <span className="relative z-10 flex flex-col items-center gap-3 transition duration-300 group-hover:scale-105">
            <span className="rounded-xl border-2 border-amber-600 bg-amber-100 px-4 py-1.5 text-sm font-black text-amber-950 shadow-xl">«ПЕРСИК»</span>
            <span className="flex gap-1.5 text-[9px] font-black uppercase min-[370px]:text-[10px]">
              <span className="rounded border border-rose-400 bg-rose-600/90 px-2 py-1">ЖЕНСКИЙ</span>
              <span className="rounded border border-blue-400 bg-blue-600/90 px-2 py-1">МУЖСКОЙ</span>
              <span className="rounded border border-amber-300 bg-amber-500/90 px-2 py-1 text-amber-950">СРЕДНИЙ</span>
            </span>
            <span aria-hidden="true" className="block size-20 bg-[url('/games/rod-runner/runner-penguin-sprites.png')] bg-[length:400%_200%] bg-left-top bg-no-repeat drop-shadow-xl" />
          </span>
        </span>

        <span>
          <strong className="block text-2xl font-black sm:text-3xl">{t.runnerTitle}</strong>
          <span className="mt-2 block text-xs leading-relaxed text-cyan-100/70">{t.runnerBlurb}</span>
          <span className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 px-6 py-3 text-sm font-black shadow-lg shadow-rose-500/20 transition group-hover:scale-105">
            <Play aria-hidden="true" className="size-4 fill-current" strokeWidth={0} />
            {t.play}
          </span>
        </span>
      </span>
    </MotionLink>
  )
}
