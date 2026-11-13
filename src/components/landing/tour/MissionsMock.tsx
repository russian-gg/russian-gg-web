import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, useReducedMotion, type Variants } from 'motion/react'
import * as m from 'motion/react-m'
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  Clock,
  Compass,
  FileText,
  Flag,
  Gamepad2,
  Play,
  Target,
  X,
} from 'lucide-react'
import roadArt from '../../../assets/images/mission-road.webp'
import { characterPalette } from '../../../lib/character'
import { pickContent } from '../../../lib/content'
import { cx } from '../../../lib/cx'
import { fill, useLocale, useT } from '../../../lib/i18n'
import { mascotImage } from '../../../lib/mascot-images'
import { MISSION_IMAGE_SIZE, missionImage } from '../../../lib/mission-images'
import { duration, ease, springSoft, useCountUp } from '../../../lib/motion'
import { discFace, discThickness, type DiscTone } from '../../missions/disc-geometry'
import { MissionDisc, type DiscBadge } from '../../missions/MissionDisc'
import { CloudShadows, RoadLife } from '../../missions/road-life'
import { ZoneScene } from '../../missions/ZoneScene'
import { missionIcon, zoneOf } from '../../missions/zones'
import { Badge, ButtonFace, Card, SectionHeading } from '../../ui'
import type { MockProps } from './DemoStage'
import { LIBRARY_SIZE, NEIGHBOUR, ROAD } from './missions-demo'
import type { MissionsState } from './scenes'

/**
 * Missions, as the signed-in app draws them: the road of numbered discs in `/practice`
 * (`Practice` → `MissionMap` + `MissionDisc`, with the real road picture and its traffic), the
 * details panel that rises over it (`MissionDetailsSheet`), the brief (`MissionBrief`), the
 * full-screen call with the penguin's sphere (`MissionLive` + `CharacterOrb`) and the result
 * (`MissionResult`) — inside the app's own rail and tab bar (`AppShell`).
 *
 * The real screens are tied to the router, queries and audio, so their markup and classes are
 * copied here; the pure pieces (the disc, the road's life, the zone scene, badges, button faces)
 * are the real components. The content is the server's seed (`missions-demo.ts`).
 *
 * The page is laid out at a real window size — a 1100 × 675 desktop, a 460 × 598 phone — and
 * scaled to the mock's design size, so every class is the one the app uses at that width.
 * Tailwind's breakpoints follow the visitor's window, not this one, so the variant each screen
 * would pick at that width is chosen here by `compact` instead.
 */

const CANVAS = {
  wide: { width: 1100, height: 675, scale: 880 / 1100 },
  compact: { width: 460, height: 598, scale: 400 / 460 },
} as const

const PALETTE = characterPalette(NEIGHBOUR.character)

export function MissionsMock({ state, compact }: MockProps<MissionsState>) {
  const canvas = compact ? CANVAS.compact : CANVAS.wide
  const live = state.view === 'live'
  return (
    <div className="relative size-full overflow-hidden bg-ground-sunken">
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: canvas.width, height: canvas.height, transform: `scale(${canvas.scale})` }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={live ? 'live' : 'shell'}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: duration.base, ease: ease.enter } }}
            exit={{ opacity: 0, transition: { duration: 0.16 } }}
          >
            {live ? (
              <Live compact={compact} turn={state.turn} line={state.line} />
            ) : (
              <Shell compact={compact}>
                {/* `AppShell`'s `PageTransition`: the screen rises in, with no exit. */}
                <m.div
                  key={state.view}
                  className="h-full"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.enter } }}
                >
                  {state.view === 'road' && <RoadScreen compact={compact} sheet={state.sheet} done={state.done} />}
                  {state.view === 'brief' && <Brief compact={compact} />}
                  {state.view === 'result' && <Result compact={compact} />}
                </m.div>
              </Shell>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------ shell */

const NAV = [
  { key: 'today', icon: CalendarDays },
  { key: 'path', icon: Compass },
  { key: 'practice', icon: Target },
  { key: 'tests', icon: ClipboardCheck },
  { key: 'progress', icon: BarChart3 },
  { key: 'games', icon: Gamepad2 },
] as const

/** The days the lessons tour starts from, so the rail's counter agrees with it. */
const DAYS_DONE = 3

/** `AppShell`: the rail on a desktop; the header and the tab bar on a phone. Missions is the open tab. */
function Shell({ compact, children }: { compact: boolean; children: ReactNode }) {
  const t = useT()
  const initials = t.account.learner.trim().slice(0, 2).toUpperCase()

  if (compact) {
    return (
      <div className="flex size-full flex-col bg-ground-sunken">
        <header className="shrink-0 border-b border-hairline bg-ground/95">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <Wordmark />
            <span className="raised flex max-w-[10.5rem] items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-2.5 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
                {initials}
              </span>
              <ChevronDown aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0 text-ink-faint" />
            </span>
          </div>
        </header>
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
        <nav className="shrink-0 border-t border-hairline bg-ground/95">
          <div className="flex items-stretch">
            {NAV.filter((item) => item.key !== 'tests').map(({ key, icon: Icon }) => (
              <span
                key={key}
                data-tour={key === 'practice' ? 'nav-practice' : undefined}
                className={cx(
                  'tour-press flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2.5',
                  key === 'practice' ? 'font-extrabold text-signal-ink' : 'font-bold text-ink-faint',
                )}
              >
                <span className="flex h-6 items-center">
                  <Icon aria-hidden="true" strokeWidth={1.7} className="size-6 shrink-0" />
                </span>
                <span className="w-full truncate px-0.5 text-center text-[11px] leading-none">{t.nav[`${key}Short`]}</span>
              </span>
            ))}
          </div>
        </nav>
      </div>
    )
  }

  return (
    <div className="flex size-full bg-ground-sunken">
      <aside className="flex w-[15.5rem] shrink-0 flex-col border-r border-hairline bg-ground-raised px-5 py-6">
        <Wordmark />
        <nav className="mt-10 flex flex-col gap-1">
          {NAV.map(({ key, icon: Icon }) => (
            <span
              key={key}
              data-tour={key === 'practice' ? 'nav-practice' : undefined}
              className={cx(
                'tour-press -mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base',
                key === 'practice' ? 'bg-signal-soft font-extrabold text-signal-ink' : 'font-bold text-ink-muted',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center">
                  <Icon aria-hidden="true" strokeWidth={1.7} className="size-6 shrink-0" />
                </span>
                <span>{t.nav[key]}</span>
              </span>
              {key === 'path' && (
                <Badge tone="neutral" size="sm">
                  {DAYS_DONE}/90
                </Badge>
              )}
            </span>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <span className="raised flex w-full items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm leading-5 font-bold text-ink">{t.account.learner}</span>
              <span className="block truncate text-xs text-ink-muted">{t.account.plan.pro}</span>
            </span>
            <ChevronDown aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0 text-ink-faint" />
          </span>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
    </div>
  )
}

function Wordmark() {
  return (
    <span className="min-w-0 truncate text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </span>
  )
}

/* ------------------------------------------------------------------------------- road */

/*
 * `MissionMap`'s geometry, copied: the clearings of `mission-road.webp` as fractions of the
 * tile, in road order from the bottom up, and how the tile is fitted to the box.
 */
const SLOTS: ReadonlyArray<readonly [x: number, y: number]> = [
  [0.684, 0.915],
  [0.379, 0.92],
  [0.226, 0.62],
  [0.716, 0.668],
  [0.829, 0.308],
  [0.317, 0.257],
  [0.571, 0.136],
]
const TILE = { width: 1672, height: 851 } as const
const CLEARINGS = { left: Math.min(...SLOTS.map(([x]) => x)), right: Math.max(...SLOTS.map(([x]) => x)) }
const PHONE_MARGIN = 32
const BOTTOM_PAD = 48

function layoutFor(width: number, count: number) {
  const roomy = width >= 640
  const span = CLEARINGS.right - CLEARINGS.left
  const tileWidth = roomy ? width : Math.max(width, (width - PHONE_MARGIN * 2) / span)
  const tileHeight = (tileWidth * TILE.height) / TILE.width
  const offset = roomy ? 0 : width / 2 - tileWidth * ((CLEARINGS.left + CLEARINGS.right) / 2)
  const tiles = Math.max(1, Math.ceil(count / SLOTS.length))
  const height = tiles * tileHeight + BOTTOM_PAD
  const disc = roomy ? Math.round(Math.min(96, tileWidth * 0.07)) : 54
  const tileOf = (index: number) => Math.floor(index / SLOTS.length)
  const slotTop = (index: number) => height - BOTTOM_PAD - (tileOf(index) + 1) * tileHeight
  return {
    width,
    height,
    tileWidth,
    tileHeight,
    tileTop: height - BOTTOM_PAD - tiles * tileHeight,
    firstTileTop: height - BOTTOM_PAD - tileHeight,
    offset,
    disc,
    roomy,
    x: (index: number) => offset + SLOTS[index % SLOTS.length][0] * tileWidth,
    y: (index: number) => slotTop(index) + SLOTS[index % SLOTS.length][1] * tileHeight,
  }
}
type Layout = ReturnType<typeof layoutFor>

/** `MissionMap.hiddenTitles`: on a phone, a title that would cover another disc is left off. */
function hiddenTitles(layout: Layout, titles: string[], keep: number) {
  const hidden = new Set<number>()
  if (layout.roomy) return hidden
  const labelWidth = 112
  const face = discFace(layout.disc)
  const depth = discThickness(layout.disc)
  const boxes = titles.map((title, index) => {
    const x = layout.x(index)
    const top = layout.y(index) - face / 2
    const bottom = top + face + depth
    const textWidth = Math.min(labelWidth, title.length * 11 * 0.56 + 16)
    const shift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, x)) - x
    const labelTop = bottom + 6
    return {
      disc: [x - layout.disc / 2, top - (index === keep ? 22 : 0), x + layout.disc / 2, bottom] as const,
      label: [x + shift - textWidth / 2, labelTop, x + shift + textWidth / 2, labelTop + 18] as const,
      keep: index === keep,
    }
  })
  const hits = (a: readonly number[], b: readonly number[]) =>
    a[0] < b[2] + 2 && b[0] < a[2] + 2 && a[1] < b[3] + 2 && b[1] < a[3] + 2
  const order = boxes.map((_, i) => i).sort((a, b) => Number(boxes[b].keep) - Number(boxes[a].keep) || a - b)
  const kept: Array<readonly number[]> = []
  for (const i of order) {
    const box = boxes[i]
    const blocked = boxes.some((other, j) => j !== i && hits(box.label, other.disc)) || kept.some((k) => hits(box.label, k))
    if (blocked && !box.keep) hidden.add(i)
    else kept.push(box.label)
  }
  return hidden
}

/** The box's own size, which the road is fitted to (it fills what the heading leaves). */
function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/** `Practice`: the heading with the progress card, then the road with the details panel over it. */
function RoadScreen({ compact, sheet, done }: { compact: boolean; sheet: MissionsState['sheet']; done: boolean }) {
  const copy = useT().practice
  const doneCount = done ? 1 : 0
  return (
    <div className={cx('flex h-full flex-col', compact ? 'gap-4 px-4 pt-4 pb-7' : 'gap-5 px-8 pt-6 pb-6')}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {!compact && (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-signal/30 bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)]">
              <FileText aria-hidden="true" strokeWidth={2} className="size-7" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className={cx('font-black tracking-tight text-ink', compact ? 'text-2xl' : 'text-3xl')}>{copy.title}</h1>
            <p className={cx('mt-0.5 max-w-3xl text-ink-muted', compact ? 'text-sm' : 'text-base')}>{copy.subtitle}</p>
          </div>
        </div>
        <div
          className={cx(
            'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 shadow-[0_4px_16px_rgb(22_24_29/0.05)]',
            compact ? 'w-full' : 'w-auto',
          )}
        >
          <div className={cx('flex min-w-0 items-center gap-3', compact ? 'flex-1' : 'flex-none')}>
            <span className="shrink-0 text-sm font-extrabold text-ink tabular-nums">
              {fill(copy.progress, { done: doneCount, total: LIBRARY_SIZE })}
            </span>
            <span className={cx('block h-2.5 min-w-24 overflow-hidden rounded-full bg-hairline', compact ? 'w-full' : 'w-44')}>
              <span
                className="block h-full rounded-full bg-milestone transition-[width] duration-700"
                style={{ width: `${(doneCount / LIBRARY_SIZE) * 100}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-extrabold text-milestone tabular-nums">
              {Math.round((doneCount / LIBRARY_SIZE) * 100)}%
            </span>
          </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <Road sheet={sheet} done={done} />
      </div>
    </div>
  )
}

function Road({ sheet, done }: { sheet: MissionsState['sheet']; done: boolean }) {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  const [frame, box] = useBoxSize()
  const layout = box.width > 0 ? layoutFor(box.width, ROAD.length) : null
  const titles = ROAD.map((mission) => pickContent(locale, mission.title))
  const current = done ? 1 : 0
  const open = sheet !== 'closed'
  const hidden = layout ? hiddenTitles(layout, titles, current) : new Set<number>()

  // `MissionDetailsSheet`: `max-h-[min(62%,30rem)]` of the box it floats over.
  const panel = Math.round(Math.min(box.height * 0.62, 480))
  /*
   * With the panel up the road makes room at its foot and the chosen disc moves up just enough
   * to stay in view over it, as `MissionMap` scrolls it there.
   */
  let lift = 0
  if (layout && open) {
    const face = discFace(layout.disc)
    const nodeBottom = layout.y(0) - face / 2 + face + discThickness(layout.disc) + 30
    const fromBottom = layout.height - nodeBottom
    lift = Math.max(0, Math.min(layout.height - box.height, panel + 16 - fromBottom))
  }

  return (
    <div
      ref={frame}
      className="relative isolate h-full overflow-hidden rounded-[28px] bg-[#9fcf6a] shadow-[0_18px_40px_rgb(40_80_30/0.25)]"
    >
      {layout && (
        <div
          className="absolute inset-x-0 bottom-0 isolate overflow-hidden transition-transform duration-300 ease-out"
          style={{ height: layout.height, transform: `translateY(${-lift}px)` }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-repeat-y select-none"
            style={{
              backgroundImage: `url(${roadArt})`,
              backgroundSize: `${layout.tileWidth}px ${layout.tileHeight}px`,
              backgroundPosition: `${layout.offset}px ${layout.tileTop}px`,
            }}
          />
          <RoadLife
            tileWidth={layout.tileWidth}
            tileHeight={layout.tileHeight}
            offset={layout.offset}
            tileTop={layout.firstTileTop}
            roomy={layout.roomy}
            clearings={SLOTS}
          />
          {ROAD.map((mission, index) => {
            const x = layout.x(index)
            const labelWidth = layout.roomy ? 172 : 112
            const labelShift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, x)) - x
            const isCurrent = index === current
            const isOpen = open && index === 0
            const finished = done && index === 0
            const tone: DiscTone = finished ? 'done' : isCurrent ? 'current' : 'open'
            const badge: DiscBadge = finished ? 'done' : null
            return (
              <div
                key={mission.slug}
                className="absolute -translate-x-1/2"
                style={{
                  left: x,
                  top: layout.y(index) - discFace(layout.disc) / 2,
                  width: labelWidth,
                  zIndex: isCurrent || isOpen ? 100000 : Math.round(layout.y(index)),
                }}
              >
                <span data-tour={`mission-${index + 1}`} className="tour-disc group relative flex w-full flex-col items-center">
                  <MissionDisc
                    number={index + 1}
                    tone={tone}
                    badge={badge}
                    size={layout.disc}
                    roomy={layout.roomy}
                    title={titles[index]}
                    showTitle={!hidden.has(index)}
                    titleShift={labelShift}
                    active={isOpen}
                    startLabel={copy.coinStart}
                    afterIntro={0}
                  />
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[4000] h-14 bg-gradient-to-b from-[rgb(20_40_10/0.28)] to-transparent" />
      <CloudShadows />
      <DetailsSheet state={sheet} height={panel} roomy={layout?.roomy ?? true} />
    </div>
  )
}

/* ------------------------------------------------------------------- details sheet */

const rising: Variants = {
  hidden: { opacity: 0, y: 56 },
  shown: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: 40, transition: { duration: duration.quick, ease: ease.exit } },
}

/** `MissionDetailsSheet` for mission 1, which the learner has not tried yet. */
function DetailsSheet({ state, height, roomy }: { state: MissionsState['sheet']; height: number; roomy: boolean }) {
  const t = useT()
  const copy = t.practice
  const { locale } = useLocale()
  const reduced = useReducedMotion()
  const scroller = useRef<HTMLElement>(null)
  const open = state !== 'closed'

  // The learner scrolls the panel down to its button, as on a short window.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    if (state === 'scrolled') el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
    else el.scrollTop = 0
  }, [state, reduced])

  const title = pickContent(locale, NEIGHBOUR.title)
  const learning = NEIGHBOUR.phrases.slice(0, 6).map(([ru, uz]) => (locale === 'uz' ? uz : ru))
  const Icon = missionIcon(NEIGHBOUR)
  const src = missionImage(NEIGHBOUR.slug)

  return (
    <AnimatePresence initial={false}>
      {open && (
        <m.section
          key="details"
          ref={scroller}
          variants={rising}
          initial="hidden"
          animate="shown"
          exit="exit"
          className={cx(
            'tour-noscroll absolute inset-x-0 bottom-0 z-[4600] overflow-y-auto rounded-t-[var(--radius-card)] rounded-b-[28px] border-t border-hairline bg-ground-raised',
            'shadow-[0_-8px_40px_rgb(22_24_29/0.14)]',
            roomy ? 'p-5' : 'p-4',
          )}
          style={{ height }}
        >
          <span className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-ground-raised/90 text-ink-muted">
            <X aria-hidden="true" strokeWidth={1.9} className="size-5" />
          </span>
          <div className={cx('grid', roomy ? 'grid-cols-[minmax(0,20rem)_minmax(0,1fr)] gap-6' : 'gap-5')}>
            <div className={cx('relative w-full overflow-hidden rounded-2xl bg-signal-soft', roomy ? 'aspect-[4/3]' : 'aspect-[2/1]')}>
              <div aria-hidden="true">
                <ZoneScene zone={zoneOf(NEIGHBOUR)} className="absolute inset-0 size-full" />
                <span
                  className={cx(
                    'absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-4 border-ground-raised bg-signal text-on-signal shadow-[0_8px_24px_rgb(52_122_223/0.35)]',
                    roomy ? 'top-[14%] size-20' : 'top-[16%] size-16',
                  )}
                >
                  <Icon strokeWidth={1.9} className={roomy ? 'size-10' : 'size-8'} />
                </span>
              </div>
              {src && (
                <div className="absolute inset-0 flex items-end justify-center bg-[radial-gradient(120%_100%_at_50%_100%,#d6f0c4_0,#eaf6df_45%,#eef3ff_100%)]">
                  <img
                    src={src}
                    alt=""
                    width={MISSION_IMAGE_SIZE.width}
                    height={MISSION_IMAGE_SIZE.height}
                    loading="lazy"
                    decoding="async"
                    className="-mb-[6%] h-[106%] w-auto max-w-none object-contain drop-shadow-[0_10px_12px_rgb(40_60_20/0.35)] select-none"
                  />
                </div>
              )}
            </div>

            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-10">
                <Badge tone="signal">{fill(copy.missionNumber, { number: 1 })}</Badge>
                <span className="text-xs font-bold text-ink-muted">{t.labels.topic[NEIGHBOUR.topic]}</span>
                <Badge>{copy.statNotStarted}</Badge>
              </div>
              <h2 className="mt-2.5 text-2xl leading-tight font-extrabold tracking-tight wrap-break-word text-ink">{title}</h2>
              <div className="mt-3">
                <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{copy.scenarioLabel}</p>
                <p className="mt-1 text-[15px] leading-6 text-ink-muted">{pickContent(locale, NEIGHBOUR.objective)}</p>
              </div>
              <div className="mt-4 border-t border-hairline pt-4">
                <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{copy.learnHeading}</p>
                <ul lang={locale === 'uz' ? 'uz' : 'ru'} className={cx('mt-2 grid gap-x-4 gap-y-1.5', roomy && 'grid-cols-2')}>
                  {learning.map((point) => (
                    <li key={point} className="flex min-w-0 items-start gap-2 text-sm leading-5 text-ink">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-milestone-soft text-milestone">
                        <Check aria-hidden="true" strokeWidth={3} className="size-2.5" />
                      </span>
                      <span className="min-w-0 wrap-break-word">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={cx('mt-4 grid gap-2 border-t border-hairline pt-4', roomy ? 'grid-cols-4' : 'grid-cols-2')}>
                <Fact label={t.preview.time} value={fill(t.common.minutes, { count: NEIGHBOUR.minutes })} />
                <Fact label={t.preview.passMark} value={fill(t.preview.passValue, { score: NEIGHBOUR.passScore })} />
                <Fact label={copy.levelLabel} value={NEIGHBOUR.level} />
                <Fact label={copy.bestLabel} value={copy.notTried} />
              </div>
              <div
                className={cx(
                  'mt-auto flex bg-ground-raised',
                  roomy ? 'flex-row items-center justify-end pt-4' : 'sticky -bottom-4 -mx-4 flex-col gap-3 px-4 pt-4 pb-4',
                )}
              >
                <span data-tour="sheet-start" className={cx('tour-press block', !roomy && 'w-full')}>
                  <ButtonFace size="lg" className={cx(!roomy && 'w-full')}>
                    <Play aria-hidden="true" strokeWidth={2.2} className="size-5 fill-current" />
                    {copy.start}
                  </ButtonFace>
                </span>
              </div>
            </div>
          </div>
        </m.section>
      )}
    </AnimatePresence>
  )
}

/** `PreviewFact`. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-ground-sunken px-4 py-3">
      <p className="text-[11px] font-black tracking-[.1em] text-ink-faint uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------------------ brief */

/** `MissionBrief`: who you are about to talk to, the goal, the rules, the phrases, and start. */
function Brief({ compact }: { compact: boolean }) {
  const t = useT()
  const copy = t.missionBrief
  const { locale } = useLocale()
  const name = t.missionLive.characters[NEIGHBOUR.character]
  const objective = pickContent(locale, NEIGHBOUR.objective)

  return (
    <div className={cx('tour-noscroll h-full overflow-y-auto', compact ? 'px-4 pt-4' : 'px-10 pt-10')}>
      <div className="mx-auto max-w-2xl space-y-6 pb-12">
        <header
          className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-hairline py-7', compact ? 'px-6' : 'px-8')}
          style={{ background: `linear-gradient(140% 120% at 82% 0%, ${PALETTE.light}2e 0%, var(--color-ground-raised) 62%)` }}
        >
          <div className={cx('flex items-center', compact ? 'gap-4' : 'gap-5')}>
            <span
              className={cx('grid shrink-0 place-items-center rounded-full', compact ? 'size-24' : 'size-28')}
              style={{ background: `${PALETTE.light}26`, boxShadow: `inset 0 0 0 1px ${PALETTE.light}40` }}
            >
              <img
                src={mascotImage('penguin')}
                alt=""
                width={453}
                height={480}
                loading="lazy"
                decoding="async"
                className={cx('object-contain', compact ? 'size-20' : 'size-24')}
              />
            </span>
            <div className="min-w-0">
              <span
                className="inline-flex items-center rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-extrabold tracking-[0.12em] uppercase"
                style={{ background: `${PALETTE.light}2b`, color: PALETTE.deep }}
              >
                {fill(copy.eyebrow, { character: name })}
              </span>
              <h1
                className={cx(
                  'mt-3 leading-tight font-extrabold tracking-tight wrap-break-word text-ink',
                  compact ? 'text-2xl' : 'text-3xl',
                )}
              >
                {pickContent(locale, NEIGHBOUR.title)}
              </h1>
            </div>
          </div>
          <p className={cx('mt-5 leading-relaxed text-ink-muted', compact ? 'text-sm' : 'text-base')}>{objective}</p>
        </header>

        <Card className="border-l-4" style={{ borderLeftColor: PALETTE.light }}>
          <span className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">{copy.goalTitle}</span>
          <p className="mt-2 text-base leading-relaxed font-bold text-ink">{objective}</p>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Stat label={copy.timeTitle} value={fill(copy.timeValue, { count: NEIGHBOUR.minutes })} />
          <Stat label={copy.passTitle} value={fill(copy.passValue, { score: NEIGHBOUR.passScore })} />
          <div className="col-span-2">
            <Stat label={copy.attemptsTitle} value={fill(copy.attemptsValue, { count: 2, hours: 3 })} />
          </div>
        </div>

        <Card>
          <h2 className="text-xs font-extrabold tracking-[0.14em] text-ink-faint uppercase">{copy.phrasesTitle}</h2>
          <ul className="mt-4 divide-y divide-hairline">
            {NEIGHBOUR.phrases.map(([ru, uz]) => (
              <li key={ru} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span lang="ru" className="font-bold text-ink">
                  {ru}
                </span>
                <span lang="uz" className="text-sm text-ink-muted">
                  {uz}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {/* The start strip stays pinned at the bottom of the screen while the brief scrolls. */}
        <div
          className={cx(
            'sticky z-10 space-y-2 rounded-[var(--radius-card)] border border-hairline bg-ground-raised/95 p-3 shadow-[0_10px_30px_rgb(22_24_29/0.10)] backdrop-blur-sm',
            compact ? 'bottom-5' : 'bottom-3',
          )}
        >
          <span data-tour="brief-start" className="tour-press block">
            <ButtonFace size="lg" className="w-full">
              {copy.start}
            </ButtonFace>
          </span>
          <p className="text-center text-xs leading-relaxed text-ink-muted">{fill(copy.micPrimer, { character: name })}</p>
          <p className="text-center text-xs font-semibold text-ink-faint">{fill(copy.attemptsAhead, { count: 2, hours: 3 })}</p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-ground-raised px-4 py-3.5">
      <span className="text-xs font-extrabold tracking-[0.12em] text-ink-faint uppercase">{label}</span>
      <p className="mt-1.5 text-base font-extrabold text-ink">{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------------------- live */

/** `ui.tsx`'s button geometry, for the faces `ButtonFace` does not offer (ghost, disabled). */
const BUTTON =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-extrabold tracking-[0.01em] whitespace-nowrap'

/** The clock on the call, a little further down at each beat (it starts at 3:00). */
const CLOCK = ['2:56', '2:41', '2:27', '2:12']

/** `MissionLive`: full screen, the character's sphere, what to do now, and the call's controls. */
function Live({ compact, turn, line }: { compact: boolean; turn: number; line: boolean }) {
  const t = useT()
  const copy = t.missionLive
  const { locale } = useLocale()
  const name = t.missionLive.characters[NEIGHBOUR.character]
  const talking = turn % 2 === 0
  const beat = turn < 2 ? 0 : 1
  const lastLine = NEIGHBOUR.lines[beat]

  return (
    <div
      className="relative flex size-full flex-col px-4 pt-4 pb-5"
      style={{ background: `radial-gradient(115% 70% at 50% 18%, ${PALETTE.light}24 0%, var(--color-ground-sunken) 58%)` }}
    >
      <header className="flex items-center justify-between gap-3">
        <span className="-ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-sm font-semibold text-ink-muted">
          <ChevronLeft aria-hidden="true" strokeWidth={2} className="size-4" />
          {copy.leave}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-ground-raised/80 px-3 py-1.5 text-sm font-extrabold text-ink tabular-nums">
          <Clock aria-hidden="true" strokeWidth={2} className="size-3.5" />
          {CLOCK[turn] ?? CLOCK[0]}
        </span>
        <span className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-ink-muted">
          <Flag aria-hidden="true" className="size-4" strokeWidth={2} />
          {!compact && <span>{t.help.report}</span>}
        </span>
      </header>

      {/* The phrases drawer, shut against the right edge. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center">
        <span className="flex items-center gap-1.5 rounded-l-2xl border border-r-0 border-hairline bg-ground-raised/95 py-4 pr-1.5 pl-2 shadow-[0_10px_30px_-18px_rgb(17_24_39/0.6)]">
          <ChevronLeft aria-hidden="true" strokeWidth={2.5} className="size-4 text-ink-muted" />
          <span className="text-[11px] font-extrabold text-ink-muted [writing-mode:vertical-rl]">
            {fill(copy.phrasesTab, { count: NEIGHBOUR.phrases.length })}
          </span>
        </span>
      </div>

      <div className={cx('flex min-h-0 flex-1 flex-col items-center justify-center', compact ? 'gap-4 py-2' : 'gap-5 py-2')}>
        <div className="relative grid place-items-center">
          <Orb state={talking ? 'talking' : 'listening'} size={compact ? 168 : 210} />
        </div>

        <div className="flex min-h-16 flex-col items-center gap-2 text-center">
          <p className="text-xl font-extrabold tracking-tight text-ink">{talking ? copy.talking : copy.listening}</p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-muted">{pickContent(locale, NEIGHBOUR.objective)}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: NEIGHBOUR.beats }, (_, index) => (
            <span
              key={index}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: index === beat ? '1.75rem' : '0.5rem',
                background: index <= beat ? PALETTE.light : 'var(--color-hairline)',
              }}
            />
          ))}
        </div>

        <AnimatePresence initial={false}>
          {line && (
            <m.div
              key="line"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: springSoft }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border border-hairline bg-ground-raised/90 px-4 py-3 text-left"
            >
              <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-faint uppercase">{name}</p>
              <p lang="ru" className="mt-1 text-base leading-snug text-ink">
                {lastLine}
              </p>
            </m.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* Help is for a call waiting on the learner, not one mid-sentence. */}
          <span className={cx(talking && 'opacity-40')}>
            <ButtonFace variant="secondary" size="sm">
              {copy.repeat}
            </ButtonFace>
          </span>
          <span className={cx(talking && 'opacity-40')}>
            <ButtonFace variant="secondary" size="sm">
              {copy.help}
            </ButtonFace>
          </span>
          <span
            data-tour="show-line"
            className={cx(
              BUTTON,
              'tour-press h-9 border border-transparent px-4 text-sm',
              line ? 'bg-ground-sunken text-ink' : 'text-ink-muted',
            )}
          >
            {line ? copy.hideLine : copy.showLine}
          </span>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-3">
        <ButtonFace variant="secondary">{copy.mute}</ButtonFace>
        <ButtonFace>{copy.finish}</ButtonFace>
      </footer>
    </div>
  )
}

/**
 * `CharacterOrb`, drawn with the same layers and styles (in `tour.css`, as `.tm-orb`). The real
 * one follows the microphone's level frame by frame; here the level is fixed per state and the
 * voice is a CSS rhythm, so it stops with the demo.
 */
function Orb({ state, size }: { state: 'talking' | 'listening'; size: number }) {
  const style = {
    '--orb-light': PALETTE.light,
    '--orb-deep': PALETTE.deep,
    '--orb-level': state === 'talking' ? 0.65 : 0.3,
    width: size,
  } as CSSProperties
  return (
    <div className={`tm-orb tm-orb-${state}`} style={style} aria-hidden="true">
      <span className="tm-orb-halo" />
      <span className="tm-orb-ring" />
      <span className="tm-orb-ring tm-orb-ring-late" />
      <span className="tm-orb-body">
        <span className="tm-orb-sheen" />
        <span className="tm-orb-core" />
      </span>
    </div>
  )
}

/* ----------------------------------------------------------------------------- result */

const SCORE = 86
const SKILLS = [
  ['Listening', 92],
  ['Speaking', 85],
  ['Pronunciation', 80],
  ['Vocabulary', 88],
  ['Grammar', 85],
] as const
/** The Russian line the correction is written in too (`headlineFeedbackRu`). */
const HEADLINE_RU = 'Называйте имя полным предложением: не просто «Али», а «Меня зовут Али».'
const TURNS = 4

/** `MissionResult` for a passed run: the verdict, the score, the main correction, the skills. */
function Result({ compact }: { compact: boolean }) {
  const t = useT()
  const copy = t.result
  const demo = t.landing.tour.missions
  const { locale } = useLocale()
  const [target, setTarget] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setTarget(SCORE))
    return () => cancelAnimationFrame(frame)
  }, [])
  const shown = useCountUp(target, 1100)

  const blocks: ReactNode[] = [
    <div key="verdict">
      <Badge tone="milestone">{copy.completed}</Badge>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">
        <span className="tabular-nums">{shown}</span> <span className="text-lg font-medium text-ink-faint">/ 100</span>
      </h1>
      <p className="text-support mt-1.5">{demo.strength}</p>
    </div>,
    <section key="correction">
      <SectionHeading>{copy.mainCorrection}</SectionHeading>
      <Card>
        <p className="text-base text-ink">{demo.headline}</p>
        {locale !== 'ru' && (
          <p lang="ru" className="text-support mt-2">
            {HEADLINE_RU}
          </p>
        )}
      </Card>
      <p className="text-support mt-2">{copy.aiDisclaimer}</p>
    </section>,
    <section key="skills">
      <SectionHeading>{copy.skills}</SectionHeading>
      <Card>
        {SKILLS.map(([skill, score]) => (
          <div key={skill} className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0">
            <span className="text-sm font-medium text-ink">{t.labels.skill[skill]}</span>
            <span className="text-sm text-ink-muted tabular-nums">
              {score}
              <span className="text-ink-faint"> / 100</span>
            </span>
          </div>
        ))}
      </Card>
    </section>,
    <section key="answers">
      <SectionHeading action={<span className="text-sm font-semibold text-signal-ink">{copy.details}</span>}>
        {copy.yourAnswers}
      </SectionHeading>
      <p className="text-support">{fill(copy.turnsRecorded, { count: TURNS })}</p>
    </section>,
  ]

  return (
    <div className={cx('tour-noscroll h-full overflow-y-auto', compact ? 'px-4 pt-4' : 'px-10 pt-10')}>
      <div className="grid items-start gap-6 pb-10">
        {blocks.map((block, index) => (
          <m.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { ...springSoft, delay: 0.12 + index * 0.12 } }}
          >
            {block}
          </m.div>
        ))}
      </div>
    </div>
  )
}

