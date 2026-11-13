import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import {
  AudioLines,
  BarChart3,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Crown,
  Flag,
  Gamepad2,
  Layers,
  Lightbulb,
  MessagesSquare,
  Mic,
  PenLine,
  Play,
  Repeat2,
  SkipForward,
  SpellCheck,
  Square,
  Sunrise,
  Target,
  Timer,
  Trophy,
  X,
} from 'lucide-react'
import aIslands from '../../../assets/images/sky/a-islands.webp'
import aSky from '../../../assets/images/sky/a-sky.webp'
import cIslands from '../../../assets/images/sky/c-islands.webp'
import cSky from '../../../assets/images/sky/c-sky.webp'
import { cx } from '../../../lib/cx'
import { fill, useLocale, useT, type Locale } from '../../../lib/i18n'
import { mascotImage } from '../../../lib/mascot-images'
import { duration, ease, springSoft } from '../../../lib/motion'
import { CoinFace } from '../../map/Coin'
import { coinHeight, type CoinBadge, type CoinTone } from '../../map/coin-geometry'
import { SKY_ISLANDS } from '../../path/sky-islands'
import { SkyClouds, SkyWeather } from '../../path/sky-life'
import '../../path/sky.css'
import { ColorScopeProvider, RussianText } from '../../RussianText'
import { Badge, Card, PauseGlyph, PlayGlyph, ProgressBar } from '../../ui'
import type { MockProps } from './DemoStage'
import type { LessonsState } from './scenes'

/*
 * The 90-day path and one of its lessons, as the signed-in app draws them:
 *
 *   map       `routes/CoursePath.tsx` + `components/path/DaySkyMap.tsx` inside `AppShell`
 *   details   `components/LessonDetailsSheet.tsx`, risen over the bottom of the map
 *   lesson    `routes/FoundationLesson.tsx` on its «Практикуй!» step (`MissionModes`, AI mode),
 *             at the last of day 4's six AI questions
 *   complete  the same lesson's closing card (`CompleteSection`)
 *
 * The coins, the islands, the clouds and gulls are the real components and data; everything
 * tied to the router, queries or audio is copied markup with the same classes. Responsive
 * `sm:`/`md:` variants are resolved by hand from `compact`, because the mock is drawn at a fixed
 * size whatever the visitor's viewport is.
 *
 * The wide mock is the desktop layout of a ~1036px window drawn at 0.85, so the map is wide
 * enough to be the "roomy" one the desktop shows (every day titled, larger coins).
 */

const WIDE = { width: 1036, height: 636 }
const WIDE_SCALE = 880 / WIDE.width

/* ------------------------------------------------------------------------- the lesson */

/** Day 4 of `lib/foundation-lessons.ts`, the parts the screens below show. */
const LESSON = {
  day: 4,
  titleRu: 'Я и мой друг',
  titleUz: 'Men va do‘stim',
  outcomes: [
    { title: 'Это мой друг', translation: 'do‘stni tanishtirish', tone: 'bg-[#0000ff]' },
    { title: 'Мой, моя, моё, мои', translation: 'shaxs va egalik olmoshlari', tone: 'bg-[#ff2400]' },
    { title: 'Двусложные слова', translation: 'ikki bo‘g‘inli so‘zlar', tone: 'bg-[#e5b600]' },
  ],
  /** Six AI questions; the demo answers the last one. */
  questions: 6,
  question: 'Когда Пингвин ждёт Панду?',
  completionMessage:
    'Ajoyib! To‘rtinchi dars ham tugadi. Endi siz do‘stingizni tanishtira olasiz va kim nimaniki ekanini rus tilida ayta olasiz. «Мой друг», «моя подруга», «наше окно» — bularni eslab qoling. Ertaga biz «Что у меня есть» mavzusida nimangiz borligi haqida gaplashamiz. Ko‘rishguncha, azizim!',
}

/** The nine steps of a lesson, with their marks and tones (`sections` in FoundationLesson). */
const SECTIONS = [
  { id: 'tests', icon: Sunrise, tone: '#5b6b7f' },
  { id: 'phonetics', icon: AudioLines, tone: '#0f8a7e' },
  { id: 'grammar', icon: SpellCheck, tone: '#5b4fd6' },
  { id: 'phrases', icon: Repeat2, tone: '#be185d' },
  { id: 'game', icon: Gamepad2, tone: '#7e3fc9' },
  { id: 'missions', icon: MessagesSquare, tone: '#c9580a' },
  { id: 'vocabulary', icon: Layers, tone: '#1f6fe0' },
  { id: 'picture', icon: PenLine, tone: '#9a5b00' },
  { id: 'complete', icon: Trophy, tone: '#15803d' },
] as const

/** Days 1–12 as the server names them (`OptimizedFoundationSeed.cs`, the map's `focus*`). */
const DAY_TITLES: Record<Locale, string[]> = {
  uz: [
    "Qo'shni bilan tanishuv", 'Bu kim?', 'Mening xonam', "Men va do'stim", 'Menda nima bor', 'Mening kasbim',
    "O'zim haqimda", 'Nima qilyapman?', 'Mening ish kunim', 'Telefonda suhbat', 'Gapirgim kelyapti!', 'Mening xobbim',
  ],
  ru: [
    'Знакомство с соседом', 'Кто это?', 'Моя комната', 'Я и мой друг', 'Что у меня есть', 'Кто я по профессии',
    'Рассказ о себе', 'Что я делаю?', 'Мой рабочий день', 'Разговор по телефону', 'Хочется говорить!', 'Моё хобби',
  ],
  en: [
    'Meeting a neighbour', 'Who is this?', 'My room', 'Me and my friend', 'What I have', 'What do I do for a living',
    'Telling about myself', 'What am I doing?', 'My working day', 'A phone conversation', 'I want to talk!', 'My hobby',
  ],
}

/* ------------------------------------------------------------------------ button faces */

/* `components/ui.tsx` Button, as spans: the mock is decoration and holds no real controls. */
const BUTTON =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-control)] font-extrabold tracking-[0.01em] whitespace-nowrap ' +
  'transition-[background-color,border-color,box-shadow,transform,opacity] duration-150'
const PRIMARY = 'border border-transparent bg-signal text-on-signal raised-signal raised'
const GHOST = 'border border-transparent text-ink-muted'
const SIZE = { md: 'h-11 px-5 text-sm', lg: 'h-14 px-7 text-base' }

/* ------------------------------------------------------------------------------- mock */

export function LessonsMock({ state, compact }: MockProps<LessonsState>) {
  const onMap = state.view === 'map' || state.view === 'details'
  const screen = onMap ? <PathScreen state={state} compact={compact} /> : <LessonScreen state={state} compact={compact} />

  if (compact) {
    return (
      <div className="flex size-full flex-col bg-ground-sunken">
        <header className="z-20 shrink-0 border-b border-hairline bg-ground/95">
          <div className="flex items-center justify-between gap-2 px-4 py-2">
            <Wordmark />
            <ProfileButton compact />
          </div>
        </header>
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-4 pb-3">{screen}</main>
        <TabBar active={onMap} />
      </div>
    )
  }

  return (
    <div className="size-full overflow-hidden bg-ground-sunken">
      <div
        className="flex origin-top-left"
        style={{ width: WIDE.width, height: WIDE.height, transform: `scale(${WIDE_SCALE})` }}
      >
        <Rail active={onMap} done={state.done} />
        <main className={cx('relative flex min-w-0 flex-1 flex-col overflow-hidden px-8', onMap ? 'pt-6 pb-6' : 'pt-10')}>
          {screen}
        </main>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------ shell */

function Wordmark() {
  return (
    <span className="min-w-0 truncate text-xl font-semibold tracking-tight text-ink">
      russian<span className="text-signal">.gg</span>
    </span>
  )
}

/** `ProfileMenu`'s trigger, for a learner on Pro. */
function ProfileButton({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const name = t.account.learner
  return (
    <span
      className={cx(
        'raised flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised text-left',
        compact ? 'max-w-[10.5rem] px-2.5 py-2' : 'w-full px-3 py-2',
      )}
    >
      <span
        className={cx(
          'flex shrink-0 items-center justify-center rounded-full bg-signal text-sm font-semibold text-on-signal',
          compact ? 'size-8' : 'size-9',
        )}
      >
        {name.slice(0, 2).toUpperCase()}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-bold text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-muted">{t.account.plan.pro}</span>
        </span>
      )}
      <ChevronDown aria-hidden="true" strokeWidth={1.8} className="size-4 shrink-0 text-ink-faint" />
    </span>
  )
}

const NAV = [
  { key: 'today', icon: CalendarDays },
  { key: 'path', icon: Compass },
  { key: 'practice', icon: Target },
  { key: 'tests', icon: ClipboardCheck },
  { key: 'progress', icon: BarChart3 },
  { key: 'games', icon: Gamepad2 },
] as const

/** `AppShell`'s desktop rail. The path is the current page while the map is on screen. */
function Rail({ active, done }: { active: boolean; done: number }) {
  const t = useT()
  return (
    <aside className="flex h-full w-[15.5rem] shrink-0 flex-col border-r border-hairline bg-ground-raised px-5 py-6">
      <Wordmark />
      <nav className="mt-10 flex flex-col gap-1">
        {NAV.map(({ key, icon: Icon }) => {
          const current = active && key === 'path'
          return (
            <span
              key={key}
              className={cx(
                '-mx-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-base',
                current ? 'bg-signal-soft font-extrabold text-signal-ink' : 'font-bold text-ink-muted',
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
                  {done}/90
                </Badge>
              )}
            </span>
          )
        })}
      </nav>
      <div className="mt-auto pt-8">
        <div className="mb-3">
          {/* `RailProCard` for a learner on Pro. */}
          <span className="flex items-center gap-3 rounded-2xl border border-hairline bg-ground-raised px-3 py-2.5 text-sm font-extrabold text-ink">
            <CrownMark className="size-8 rounded-xl" />
            <span className="min-w-0 truncate">{t.account.plan.pro}</span>
          </span>
        </div>
        <ProfileButton />
      </div>
    </aside>
  )
}

function CrownMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('flex shrink-0 items-center justify-center bg-coin text-coin-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]', className)}
    >
      <Crown strokeWidth={2.2} className="size-4" />
    </span>
  )
}

/** `AppShell`'s phone tab bar (the tests tab is left out there, as in the app). */
function TabBar({ active }: { active: boolean }) {
  const t = useT()
  return (
    <nav className="z-30 shrink-0 border-t border-hairline bg-ground/95">
      <div className="flex items-stretch">
        {NAV.filter((item) => item.key !== 'tests').map(({ key, icon: Icon }) => (
          <span
            key={key}
            className={cx(
              'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 py-2.5',
              active && key === 'path' ? 'font-extrabold text-signal-ink' : 'font-bold text-ink-faint',
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
  )
}

/* ------------------------------------------------------------------------- path page */

function PathScreen({ state, compact }: { state: LessonsState; compact: boolean }) {
  const t = useT()
  const today = state.done + 1
  const percent = Math.round((state.done / 90) * 100)
  const [sheet, setSheet] = useState(0)

  return (
    <div className={cx('flex min-h-0 flex-1 flex-col', compact ? 'gap-4' : 'gap-5')}>
      {/* The heading of `CoursePath`, for a learner on Pro (no free-days or Pro chips). */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          {!compact && (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-signal/30 bg-signal-soft text-signal-ink shadow-[0_8px_24px_rgb(31_111_224/0.12)]">
              <Compass aria-hidden="true" strokeWidth={2} className="size-7" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.12em] text-signal-ink uppercase">{t.path.title}</p>
            <h1 className={cx('mt-0.5 font-black tracking-tight text-ink', compact ? 'text-2xl' : 'text-3xl')}>
              {fill(t.path.hero.subtitle, { day: today })}
            </h1>
          </div>
        </div>
        <div
          className={cx(
            'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-hairline bg-ground-raised px-4 py-3 shadow-[0_4px_16px_rgb(22_24_29/0.05)]',
            compact ? 'w-full' : 'w-auto',
          )}
        >
          <div className={cx('flex min-w-0 items-center gap-3', compact ? 'flex-1' : 'flex-none')}>
            <m.span
              key={state.done}
              initial={{ scale: 1.35, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.45 }}
              className="shrink-0 text-sm font-extrabold text-ink tabular-nums"
            >
              {fill(t.path.sky.progress, { done: state.done, total: 90 })}
            </m.span>
            <span className={cx('h-2.5 min-w-24 overflow-hidden rounded-full bg-hairline', compact ? 'w-full' : 'w-44')}>
              <span
                className="block h-full rounded-full bg-milestone transition-[width] duration-700"
                style={{ width: `${(state.done / 90) * 100}%` }}
              />
            </span>
            <span className="shrink-0 text-xs font-extrabold text-milestone tabular-nums">{percent}%</span>
          </div>
        </div>
      </div>

      {/* The lesson card floats over the bottom of the map box, inside the same frame. */}
      <div className="relative min-h-0 flex-1">
        <SkyMap state={state} sheet={state.view === 'details' ? sheet : 0} />
        <AnimatePresence>
          {state.view === 'details' && <DetailsSheet key="details" compact={compact} onHeight={setSheet} />}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------- sky map */

type Picture = 'a' | 'c'
const ART: Record<Picture, { sky: string; islands: string }> = {
  a: { sky: aSky, islands: aIslands },
  c: { sky: cSky, islands: cIslands },
}

/* `DaySkyMap`'s layout, for the first two pictures (days 1–12) and the one below day 1. */
const DAYS = 12
const DAYS_PER_PICTURE = 6
const SEQUENCE: ReadonlyArray<readonly [Picture, boolean]> = [['a', false], ['c', true]]
const BELOW: readonly [Picture, boolean] = ['c', false]
const BOTTOM_PAD = 48
const FLOAT_SECONDS = 7
const ALL_SLOTS = [...SKY_ISLANDS.a.slots, ...SKY_ISLANDS.c.slots]
const LEFT = Math.min(...ALL_SLOTS.map(([x]) => Math.min(x, 1 - x)))
const RIGHT = Math.max(...ALL_SLOTS.map(([x]) => Math.max(x, 1 - x)))

type Tile = { picture: Picture; mirrored: boolean; top: number; height: number }
type Layout = ReturnType<typeof layoutFor>

function layoutFor(width: number) {
  const roomy = width >= 640
  const tileWidth = roomy ? width : (width - 40) / (RIGHT - LEFT)
  const offset = roomy ? 0 : width / 2 - (tileWidth * (LEFT + RIGHT)) / 2
  const heightOf = (p: Picture) => (tileWidth * SKY_ISLANDS[p].height) / SKY_ISLANDS[p].width
  const trail = SEQUENCE.reduce((sum, [p]) => sum + heightOf(p), 0)
  const height = Math.round(trail + BOTTOM_PAD)
  const base = height - BOTTOM_PAD
  const tiles: Tile[] = [{ picture: BELOW[0], mirrored: BELOW[1], top: base, height: heightOf(BELOW[0]) }]
  let top = base
  for (const [picture, mirrored] of SEQUENCE) {
    top -= heightOf(picture)
    tiles.push({ picture, mirrored, top, height: heightOf(picture) })
  }
  const [lo, hi] = roomy ? [50, 58] : [30, 34]
  const points = Array.from({ length: DAYS }, (_, i) => {
    const tile = Math.floor(i / DAYS_PER_PICTURE) + 1
    const { picture, mirrored, top: tileTop, height: h } = tiles[tile]
    const [sx, sy, cw, island] = SKY_ISLANDS[picture].slots[i % DAYS_PER_PICTURE]
    const fx = mirrored ? 1 - sx : sx
    return {
      x: offset + fx * tileWidth,
      y: tileTop + sy * h,
      coin: Math.round(Math.min(hi, Math.max(lo, 0.5 * cw * tileWidth))),
      ground: cw * tileWidth,
      tile,
      island,
    }
  })
  return { width, height, roomy, tileWidth, offset, tiles, points }
}

function islandMotion(layout: Layout, tile: Tile, index: number) {
  const art = SKY_ISLANDS[tile.picture]
  const island = art.islands[index - 1]
  const scale = layout.tileWidth / art.width
  const [cx0, cy] = island.centre
  const mx = layout.offset + (tile.mirrored ? art.width - cx0 : cx0) * scale
  const my = tile.top + cy * scale
  const phase = (my / layout.tileWidth / 6 + mx / layout.tileWidth / 5) % 1
  const taper = Math.sin(Math.PI * Math.min(1, Math.max(0, cy / art.height))) ** 0.7
  return {
    animationDelay: `-${(phase * FLOAT_SECONDS).toFixed(2)}s`,
    '--f': `-${((layout.roomy ? 7.5 : 4.5) * taper).toFixed(1)}px`,
  } as CSSProperties
}

/** The size of a box in layout pixels (unaffected by the stage's scale). */
function useBoxSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

/**
 * `DaySkyMap`, opened where the real one opens for a learner on day 4: at the bottom of the
 * trail. While the lesson card is up, the map moves just enough to keep day 4 above it.
 */
function SkyMap({ state, sheet }: { state: LessonsState; sheet: number }) {
  const t = useT()
  const { locale } = useLocale()
  const frame = useRef<HTMLDivElement>(null)
  const box = useBoxSize(frame)
  const layout = box.width > 0 ? layoutFor(box.width) : null
  const today = state.done + 1
  const openDay = state.view === 'details' ? 4 : null

  let scroll = 0
  if (layout) {
    scroll = Math.max(0, layout.height - box.height)
    if (sheet > 0) {
      const p = layout.points[3]
      const overlap = p.y - scroll + 40 + 16 - (box.height - sheet)
      if (overlap > 0) scroll += overlap
    }
  }

  return (
    <div
      ref={frame}
      className="relative isolate size-full overflow-hidden rounded-[28px] shadow-[0_18px_40px_rgb(80_60_140/0.25)]"
    >
      {/* The map's own lilac ground, turned blue with the sky picture (`.tour-sky`). */}
      <div aria-hidden="true" className="tour-sky absolute inset-0 bg-[linear-gradient(#c9c3f0,#e9c9e6)]" />
      {layout && (
        <div
          className="absolute inset-x-0 top-0 isolate overflow-hidden transition-transform duration-300 ease-out"
          style={{ height: layout.height, transform: `translateY(${-scroll}px)` }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {layout.tiles.map((tile, n) => {
              const art = SKY_ISLANDS[tile.picture]
              const scale = layout.tileWidth / art.width
              const [aw, ah] = art.atlas
              return (
                <div
                  key={n}
                  className="sky-tile absolute"
                  style={{
                    left: layout.offset,
                    top: tile.top,
                    width: layout.tileWidth,
                    height: tile.height + 1,
                    transform: tile.mirrored ? 'scaleX(-1)' : undefined,
                  }}
                >
                  <img
                    src={ART[tile.picture].sky}
                    alt=""
                    width={art.width}
                    height={art.height}
                    loading="lazy"
                    decoding="async"
                    className="tour-sky absolute inset-0 size-full"
                  />
                  {art.islands.map((island, k) => {
                    const [x0, y0, x1, y1] = island.box
                    return (
                      <div
                        key={k}
                        className={cx('island', !island.floats && 'island-still')}
                        style={{
                          left: x0 * scale,
                          top: y0 * scale,
                          width: (x1 - x0) * scale,
                          height: (y1 - y0) * scale,
                          backgroundImage: `url(${ART[tile.picture].islands})`,
                          backgroundSize: `${aw * scale}px ${ah * scale}px`,
                          backgroundPosition: `-${island.at[0] * scale}px -${island.at[1] * scale}px`,
                          ...(island.floats ? islandMotion(layout, tile, k + 1) : {}),
                        }}
                      />
                    )
                  })}
                </div>
              )
            })}
          </div>
          <SkyClouds width={layout.width} mapHeight={layout.height} roomy={layout.roomy} />

          <ol className="contents">
            {layout.points.map((point, index) => {
              const day = index + 1
              const tile = layout.tiles[point.tile]
              const island = point.island ? SKY_ISLANDS[tile.picture].islands[point.island - 1] : null
              const done = day <= state.done
              const tone: CoinTone = done ? 'done' : day === today ? 'current' : 'locked'
              // Day 4 was started before the demo opens it: the "tried" mark until it is done.
              const badge: CoinBadge = done ? 'done' : tone === 'locked' ? 'locked' : day === 4 ? 'tried' : null
              const title = DAY_TITLES[locale][index]
              const labelWidth = layout.roomy ? 168 : 112
              const shift = Math.min(layout.width - 4 - labelWidth / 2, Math.max(4 + labelWidth / 2, point.x)) - point.x
              const open = day === openDay
              const current = tone === 'current'
              return (
                <li
                  key={day}
                  data-tour={`day-${day}`}
                  data-tour-y="0.3"
                  className={cx('tour-day absolute -translate-x-1/2', tone === 'locked' && 'opacity-80')}
                  style={{
                    left: point.x,
                    top: point.y - coinHeight(point.coin, tone),
                    width: labelWidth,
                    zIndex: current || open ? 100000 : Math.round(point.y),
                  }}
                >
                  <span className="group relative block w-full">
                    <span
                      className={cx('relative flex w-full flex-col items-center', island?.floats && 'island-sync')}
                      style={island?.floats ? islandMotion(layout, tile, point.island) : undefined}
                    >
                      <CoinFace
                        number={day}
                        tone={tone}
                        badge={badge}
                        palette="days"
                        size={point.coin}
                        ground={point.ground}
                        roomy={layout.roomy}
                        title={title}
                        showTitle={layout.roomy || current || open}
                        titleShift={shift}
                        active={open}
                        startLabel={t.path.sky.start}
                        groundShadow="rgb(60 40 90 / 0.32)"
                        titleShadow="0 3px 0 rgb(70 60 120 / 0.22), 0 6px 12px rgb(60 50 110 / 0.18)"
                      />
                    </span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}
      <div
        aria-hidden="true"
        className="tour-sky pointer-events-none absolute inset-x-0 top-0 z-[4000] h-14 bg-gradient-to-b from-[rgb(70_50_130/0.22)] to-transparent"
      />
      {layout && <SkyWeather width={layout.width} height={box.height} roomy={layout.roomy} />}
    </div>
  )
}

/* ------------------------------------------------------------------ lesson details sheet */

/** `LessonDetailsSheet` for day 4, five of its nine sections done. */
function DetailsSheet({ compact, onHeight }: { compact: boolean; onHeight: (height: number) => void }) {
  const t = useT()
  const { locale } = useLocale()
  const copy = t.dayPreview
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    onHeight(ref.current?.offsetHeight ?? 0)
    return () => onHeight(0)
  }, [onHeight, compact])

  return (
    <m.section
      ref={ref}
      initial={{ opacity: 0, y: 56 }}
      animate={{ opacity: 1, y: 0, transition: springSoft }}
      exit={{ opacity: 0, y: 40, transition: { duration: duration.quick, ease: ease.exit } }}
      className={cx(
        // Above the map box, and so above every coin on it (the coins count up to z 100000
        // inside the map's own stacking context).
        'absolute inset-x-0 bottom-0 z-[4600]',
        'max-h-[min(66%,34rem)] overflow-hidden rounded-t-[var(--radius-card)] rounded-b-[28px] border-t border-hairline bg-ground-raised',
        'shadow-[0_-8px_40px_rgb(22_24_29/0.14)]',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <span className="absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-ground-raised/90 text-ink-muted">
        <X aria-hidden="true" strokeWidth={1.9} className="size-5" />
      </span>
      <div className="flex w-full min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pr-10">
          <Badge tone="signal">{fill(copy.lessonDay, { day: LESSON.day })}</Badge>
          <Badge tone="caution">
            <Timer aria-hidden="true" strokeWidth={2.2} className="mr-1 size-3.5" />
            {fill(copy.progressOf, { done: 5, total: SECTIONS.length })}
          </Badge>
        </div>
        <h2 className="mt-2.5 text-2xl leading-tight font-extrabold tracking-tight wrap-break-word text-ink">
          {LESSON.titleRu}
          {locale === 'uz' && <span className="ml-2 text-base font-bold text-ink-muted">{LESSON.titleUz}</span>}
        </h2>
        <ul className={cx('mt-4 grid gap-2 border-t border-hairline pt-4', !compact && 'grid-cols-3')}>
          {LESSON.outcomes.map((outcome) => (
            <li key={outcome.title} className={cx('rounded-2xl bg-ground-sunken px-3 text-center', compact ? 'py-2' : 'py-2.5')}>
              <span aria-hidden="true" className={cx('mx-auto mb-1.5 block h-1.5 w-8 rounded-full', outcome.tone)} />
              <span className="block leading-snug font-black wrap-break-word text-ink">{outcome.title}</span>
              <span className="block text-sm text-ink-muted">{outcome.translation}</span>
            </li>
          ))}
        </ul>
        <div className={compact ? 'sticky -bottom-4 -mx-4 mt-auto bg-ground-raised px-4 pt-4 pb-4' : 'flex justify-end pt-4'}>
          <span data-tour="start" className={cx('tour-press', BUTTON, PRIMARY, SIZE.lg, compact ? 'w-full' : 'w-auto')}>
            <Play aria-hidden="true" strokeWidth={2.2} className="size-5 fill-current" />
            {copy.resume}
          </span>
        </div>
      </div>
    </m.section>
  )
}

/* ---------------------------------------------------------------------------- lesson */

/**
 * `FoundationLesson`, past its first step: the shrunk hero, the step's heading, the step, and
 * the Back / Next row. On the «Практикуй!» step the first five steps are done; on the closing
 * card all nine are.
 *
 * The page scrolls the way the learner would scroll it: down to the microphone once the
 * question has been read, down to the Next button once the answer is checked.
 */
function LessonScreen({ state, compact }: { state: LessonsState; compact: boolean }) {
  const t = useT().lesson
  const complete = state.view === 'complete'
  const sectionIndex = complete ? 8 : 5
  const active = SECTIONS[sectionIndex]
  const checked = state.mic === 'checked'

  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const micRow = useRef<HTMLDivElement>(null)
  const navRow = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)

  useLayoutEffect(() => {
    const anchor = complete || checked ? navRow.current : state.audio ? null : micRow.current
    const root = content.current
    const height = viewport.current?.clientHeight ?? 0
    if (!anchor || !root) {
      setScroll(0)
      return
    }
    let bottom = anchor.offsetHeight
    let el: HTMLElement | null = anchor
    while (el && el !== root) {
      bottom += el.offsetTop
      el = el.offsetParent as HTMLElement | null
    }
    setScroll(Math.max(0, bottom + 16 - height))
  }, [complete, checked, state.audio, state.mic, compact])

  const ToneIcon = active.icon
  return (
    <div ref={viewport} className="relative min-h-0 flex-1 overflow-hidden">
      <ColorScopeProvider day={LESSON.day}>
        <div
          ref={content}
          className={cx(
            'foundation-lesson relative mx-auto max-w-4xl pb-5 transition-transform duration-500 ease-out',
            compact ? 'space-y-4' : 'space-y-6',
          )}
          style={{ transform: `translateY(${-scroll}px)` }}
        >
          <LessonHero compact={compact} sectionIndex={sectionIndex} />

          <section>
            <div className={cx('flex items-center gap-3', compact ? 'mb-3' : 'mb-4')}>
              <span
                style={{ backgroundColor: active.tone, boxShadow: `0 6px 16px color-mix(in srgb, ${active.tone} 28%, transparent)` }}
                className={cx('flex shrink-0 items-center justify-center rounded-2xl text-white', compact ? 'size-12' : 'size-14')}
              >
                <ToneIcon aria-hidden="true" strokeWidth={1.9} className={compact ? 'size-6' : 'size-7'} />
              </span>
              <h2 className={cx('min-w-0 font-black tracking-tight text-ink', compact ? 'text-xl' : 'text-2xl')}>
                {t.sections[active.id]}
              </h2>
            </div>
            {complete ? <CompleteCard compact={compact} /> : <AiQuestions state={state} compact={compact} micRow={micRow} />}
          </section>

          <div ref={navRow} className="space-y-3 border-t border-hairline pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx(BUTTON, GHOST, SIZE.md)}>{t.back}</span>
              {complete ? (
                <span data-tour="finish" className={cx('tour-press ml-auto', BUTTON, PRIMARY, SIZE.md)}>
                  {t.finishLesson}
                </span>
              ) : (
                <span
                  data-tour="next"
                  className={cx('tour-press ml-auto', BUTTON, PRIMARY, SIZE.md, !checked && 'opacity-40 shadow-none')}
                >
                  {t.next}
                  {!checked && (
                    <span className="ml-1.5 rounded-full bg-on-signal/20 px-2 text-xs tabular-nums">
                      {LESSON.questions - 1}/{LESSON.questions}
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </ColorScopeProvider>
    </div>
  )
}

function LessonHero({ compact, sectionIndex }: { compact: boolean; sectionIndex: number }) {
  const t = useT()
  const done = sectionIndex === 8 ? SECTIONS.length : sectionIndex
  return (
    <Card className={cx('lesson-hero', compact ? 'p-4 py-3' : 'p-6 py-4')}>
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 text-xs font-black tracking-[.12em] text-signal-ink uppercase">
            {fill(t.lesson.eyebrow, { day: LESSON.day })}
          </span>
          <span className="truncate font-black text-ink">{LESSON.titleRu}</span>
        </p>
        <span className="-my-1.5 -mr-1.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-ink-muted">
          <Flag aria-hidden="true" className="size-4" strokeWidth={2} />
          {!compact && <span>{t.help.report}</span>}
        </span>
      </div>
      <div className="mt-2">
        <ProgressBar value={done} max={SECTIONS.length} label={t.lesson.progress} />
      </div>
      <ol className={cx('mt-3 grid grid-cols-9', compact ? 'gap-1' : 'gap-2')}>
        {SECTIONS.map((section, index) => {
          const current = index === sectionIndex
          const isDone = index < done
          const Icon = section.icon
          return (
            <li key={section.id} className="flex justify-center">
              <span
                style={current ? { backgroundColor: section.tone } : undefined}
                className={cx(
                  'flex items-center justify-center',
                  compact ? 'size-7 rounded-lg' : 'size-9 rounded-xl',
                  current
                    ? 'text-white ring-3 ring-signal-soft'
                    : isDone
                      ? 'bg-milestone-soft text-milestone'
                      : 'bg-ground-sunken text-ink-faint opacity-50',
                )}
              >
                {isDone && !current ? (
                  <Check aria-hidden="true" strokeWidth={3} className={compact ? 'size-3.5' : 'size-4'} />
                ) : (
                  <Icon aria-hidden="true" strokeWidth={2} className={compact ? 'size-3.5' : 'size-4'} />
                )}
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/** `MissionModes` in its AI mode: the dialogue read, five of the six questions answered. */
function AiQuestions({ state, compact, micRow }: { state: LessonsState; compact: boolean; micRow: RefObject<HTMLDivElement | null> }) {
  const dictionary = useT()
  const t = dictionary.lesson.missions
  const listening = state.mic === 'listening'
  const processing = state.mic === 'processing'
  const checked = state.mic === 'checked'
  const current = LESSON.questions - 1

  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <StepBadge index={1} title={t.practiseDialogue} active={false} done />
        <StepBadge index={2} title={t.aiChat} active done />
      </div>
      <div className="text-center">
        <ol className="flex flex-wrap justify-center gap-1.5">
          {Array.from({ length: LESSON.questions }, (_, index) => (
            <li key={index}>
              <span
                className={cx(
                  'flex size-8 items-center justify-center rounded-lg text-xs font-black tabular-nums',
                  index === current ? 'bg-signal text-on-signal ring-3 ring-signal-soft' : 'bg-milestone-soft text-milestone',
                )}
              >
                {index === current ? index + 1 : <Check aria-hidden="true" strokeWidth={3} className="size-3.5" />}
              </span>
            </li>
          ))}
        </ol>
        {/* The question, read aloud when it comes up (`SpeechButton` with its auto-play). */}
        <span className="raised raised-signal-soft mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-signal-soft p-5 text-xl font-black text-ink">
          {state.audio ? <PauseGlyph /> : <PlayGlyph />}
          <span lang="ru">
            <RussianText text={LESSON.question} />
          </span>
        </span>
        <div ref={micRow} className="mt-4 flex items-center justify-center gap-5">
          <span className="raised raised-sm flex size-11 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted">
            <Lightbulb aria-hidden="true" strokeWidth={2.2} className="size-5" />
          </span>
          {/* `MicRoundButton`. */}
          <span
            data-tour="mic"
            className={cx(
              'tour-press raised flex size-16 shrink-0 items-center justify-center rounded-full text-2xl',
              listening ? 'animate-pulse bg-danger text-on-danger raised-danger' : 'bg-signal text-on-signal raised-signal',
              processing && 'opacity-60',
            )}
          >
            {processing ? (
              <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : listening ? (
              <Square aria-hidden="true" strokeWidth={0} className="size-5 fill-current" />
            ) : (
              <Mic aria-hidden="true" strokeWidth={1.9} className="size-6" />
            )}
          </span>
          <span className="raised raised-sm flex size-11 items-center justify-center rounded-full border border-hairline bg-ground-raised text-ink-muted">
            <SkipForward aria-hidden="true" strokeWidth={2.2} className="size-5" />
          </span>
        </div>
        {listening && <p className="mt-2 text-center text-sm font-bold text-ink-muted">{t.micStopAnswer}</p>}
        {checked && (
          <m.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-2xl bg-milestone-soft p-4 text-sm font-black text-milestone"
          >
            {t.allAnswered}
          </m.p>
        )}
      </div>
      {checked && (
        <m.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-xl bg-milestone-soft p-3 text-sm text-milestone"
        >
          <RussianText text={dictionary.landing.tour.lessons.feedback} />
        </m.p>
      )}
    </Card>
  )
}

function StepBadge({ index, title, active, done }: { index: number; title: string; active: boolean; done: boolean }) {
  const t = useT().lesson.missions
  return (
    <div
      className={cx(
        'rounded-xl border-2 px-3 py-2 text-left',
        active ? 'border-signal bg-signal-soft' : done ? 'border-milestone bg-milestone-soft/40' : 'border-hairline bg-ground-sunken',
      )}
    >
      <p className="text-[10px] font-black tracking-[.12em] text-ink-faint uppercase">
        {fill(t.step, { n: index })} {done && !active ? '✓' : ''}
      </p>
      <p className={cx('text-xs font-black', active ? 'text-signal-ink' : 'text-ink-muted')}>{title}</p>
    </div>
  )
}

/** `CompleteSection` for day 4 (its closing character is the penguin), the result saved. */
function CompleteCard({ compact }: { compact: boolean }) {
  const t = useT().lesson.complete
  return (
    <Card className={cx('relative overflow-hidden border-milestone bg-milestone-soft/35 text-center', compact ? 'p-5' : 'p-8')}>
      <div className="flex items-center justify-center gap-3">
        <m.img
          src={mascotImage('penguin')}
          alt=""
          initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', duration: 0.6, bounce: 0.45 }}
          className={cx('shrink-0 object-contain', compact ? 'h-24 w-24' : 'h-28 w-28')}
        />
        <h3 className={cx('font-black text-ink', compact ? 'text-3xl' : 'text-4xl')}>{t.title}</h3>
      </div>
      <span className="mt-3 inline-flex rounded-full bg-milestone-soft px-3 py-1.5 text-sm font-black text-milestone">
        {fill(t.badge, { day: LESSON.day })}
      </span>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{LESSON.completionMessage}</p>
    </Card>
  )
}
