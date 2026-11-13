import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as m from 'motion/react-m'
import { AnimatePresence, useInView, useReducedMotion } from 'motion/react'
import { BookOpenCheck, CircleAlert, CircleCheck, Flame, Mic, Sparkles } from 'lucide-react'
import { cx } from '../../lib/cx'
import { fill, useT } from '../../lib/i18n'
import { ease, rise, stagger, useCountUp } from '../../lib/motion'
import { Reveal } from '../motion'
import { Stage, VIEW_MARGIN } from './effects'
import { VoiceSignal } from '../VoiceSignal'

/**
 * The sample progress report: the AI coach catching and fixing a mistake live, then the
 * numbers the learner's own progress screen shows after a few weeks — confidence, levels and
 * activity, and the 90-day curve with its forecast.
 *
 * Every metric is one the real product tracks (`progress.*`, `home.activity.*`), and every card
 * carries a "sample" badge: these are illustrative values, not anybody's results. The charts
 * are hand-drawn SVG, like `components/charts.tsx`, and draw themselves in the first time they
 * come up into the screen.
 */
export function SampleReport() {
  return (
    <Stage className="grid gap-4 lg:grid-cols-3" gap={stagger.wide}>
      <Reveal variants={rise} className="lg:col-span-2 lg:row-span-2">
        <CorrectionCard />
      </Reveal>
      <Reveal variants={rise}>
        <ConfidenceCard />
      </Reveal>
      <Reveal variants={rise}>
        <LevelsCard />
      </Reveal>
      <Reveal variants={rise} className="lg:col-span-3">
        <CurveCard />
      </Reveal>
    </Stage>
  )
}

const onView = { once: true, margin: VIEW_MARGIN } as const

function Card({
  title,
  children,
  className,
  badge,
}: {
  title: ReactNode
  children: ReactNode
  className?: string
  badge?: ReactNode
}) {
  const t = useT().landing.report
  return (
    <article className={cx('glass sheen flex h-full flex-col rounded-[1.75rem] p-5 sm:p-6', className)}>
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-ink">{title}</h3>
        {badge ?? (
          <span className="rounded-full bg-signal-soft px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] text-signal-ink uppercase">
            {t.sample}
          </span>
        )}
      </header>
      {children}
    </article>
  )
}

/* ------------------------------------------------------------------------ correction */

type RuleKey = 'ruleLocation' | 'ruleWith' | 'ruleNo'

/**
 * Three real beginner mistakes, each a case ending the course teaches. The wrong word is split
 * into the stem both forms share and the two endings, so the fix can replace exactly the
 * letters that change and nothing else — which is the point the coach is making.
 */
const EXAMPLES: Array<{ lead: string; stem: string; wrong: string; right: string; rule: RuleKey }> = [
  { lead: 'Я работаю в', stem: 'банк', wrong: '', right: 'е', rule: 'ruleLocation' },
  { lead: 'Я пью кофе с', stem: 'молок', wrong: 'о', right: 'ом', rule: 'ruleWith' },
  { lead: 'У меня нет', stem: 'брат', wrong: '', right: 'а', rule: 'ruleNo' },
]

type Beat = 'speak' | 'scan' | 'found' | 'fix' | 'rule'

/** How long each beat holds, in ms. The rule holds longest: it is the thing to read. */
const BEATS: Array<[Beat, number]> = [
  ['speak', 2000],
  ['scan', 1300],
  ['found', 1400],
  ['fix', 1300],
  ['rule', 3400],
]

const order = (beat: Beat) => BEATS.findIndex(([name]) => name === beat)

/**
 * The coach at work, one mistake at a time: the learner's sentence arrives word by word as
 * they say it, a scan passes over it, the wrong word is underlined and shakes, its ending
 * drops out and the right one springs in, and the coach's reply and the rule behind it follow.
 *
 * It only runs while it is on screen — scrolled away, it holds; scrolled back, it carries on —
 * and under reduced motion it stays on the finished first example.
 */
function CorrectionCard() {
  const t = useT().landing.report
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // Not `once`: the loop pauses whenever the card leaves the screen and resumes on return.
  const visible = useInView(ref, { margin: VIEW_MARGIN })
  const [index, setIndex] = useState(0)
  const [beat, setBeat] = useState<Beat>('speak')
  const shownBeat: Beat = reduced ? 'rule' : beat

  useEffect(() => {
    if (reduced || !visible) return
    const at = order(beat)
    const timer = window.setTimeout(() => {
      if (at === BEATS.length - 1) {
        setIndex((i) => (i + 1) % EXAMPLES.length)
        setBeat('speak')
      } else {
        setBeat(BEATS[at + 1][0])
      }
    }, BEATS[at][1])
    return () => window.clearTimeout(timer)
  }, [beat, visible, reduced])

  const example = EXAMPLES[index]
  const past = (b: Beat) => order(shownBeat) >= order(b)
  const words = example.lead.split(' ')
  // Nothing plays until the card has come up into view; the first sentence waits for it.
  const playing = visible || Boolean(reduced)

  return (
    <div ref={ref} className="h-full">
      <Card
        title={
          <>
            <span className="grid size-7 place-items-center rounded-lg bg-[image:var(--spectrum)] text-white">
              <Sparkles aria-hidden="true" strokeWidth={0} className="size-3.5 fill-current" />
            </span>
            {t.feedbackTitle}
          </>
        }
        badge={
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-extrabold tracking-[0.06em] whitespace-nowrap text-danger uppercase">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ripple rounded-full bg-danger" />
              <span className="relative size-1.5 rounded-full bg-danger" />
            </span>
            {t.live}
          </span>
        }
      >
        {/* A floor under the content: the beats swap things in place and the card must not breathe. */}
        <div aria-hidden="true" className="relative mt-5 flex min-h-[24rem] flex-1 flex-col gap-4">
          {/* The learner's turn. */}
          <div className="relative overflow-hidden rounded-2xl rounded-tr-sm border border-hairline bg-ground-raised px-5 py-6 sm:px-7">
            <div className="mb-3 flex h-6 items-center justify-between text-xs font-extrabold tracking-[0.08em] uppercase">
              <StatusLine beat={shownBeat} />
              {shownBeat === 'speak' && playing && <VoiceSignal state="listening" size="sm" labelled={false} />}
            </div>

            <p lang="ru" key={index} className="text-[1.7rem] leading-snug font-black text-ink sm:text-4xl">
              {words.map((word, i) => (
                <m.span
                  key={`${index}-${i}`}
                  className="mr-[0.28em] inline-block"
                  initial={reduced ? false : { opacity: 0, y: 8, filter: 'blur(6px)' }}
                  animate={playing ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
                  transition={{ delay: i * 0.24, duration: 0.35, ease: ease.enter }}
                >
                  {word}
                </m.span>
              ))}
              <m.span
                className="relative inline-block"
                initial={reduced ? false : { opacity: 0, y: 8, filter: 'blur(6px)' }}
                animate={
                  !playing
                    ? undefined
                    : past('found') && !past('fix')
                      ? { opacity: 1, y: 0, filter: 'blur(0px)', x: [0, -5, 5, -4, 4, 0] }
                      : { opacity: 1, y: 0, filter: 'blur(0px)', x: 0 }
                }
                transition={{ delay: past('scan') ? 0 : words.length * 0.24, duration: 0.45, ease: ease.enter }}
              >
                {example.stem}
                <AnimatePresence mode="popLayout" initial={false}>
                  {past('fix') ? (
                    <m.span
                      key="right"
                      className="inline-block rounded-md bg-milestone-soft px-0.5 text-milestone"
                      initial={reduced ? false : { opacity: 0, y: -22, scale: 0.4 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', duration: 0.6, bounce: 0.5 }}
                    >
                      {example.right}
                    </m.span>
                  ) : (
                    example.wrong && (
                      <m.span
                        key="wrong"
                        className={cx('inline-block transition-colors duration-300', past('found') && 'text-danger')}
                        exit={{ opacity: 0, y: 18, rotate: 12, filter: 'blur(4px)' }}
                        transition={{ duration: 0.35 }}
                      >
                        {example.wrong}
                      </m.span>
                    )
                  )}
                </AnimatePresence>

                {/* The underline: a red squiggle when the mistake is found, settling to a
                    straight green rule once it is fixed. */}
                {past('found') && (
                  <svg className="absolute -bottom-2.5 left-0 h-3 w-full overflow-visible" viewBox="0 0 100 12" preserveAspectRatio="none">
                    <m.path
                      key={past('fix') ? 'fixed' : 'found'}
                      d={past('fix') ? 'M2 6 L98 6' : 'M2 6 Q8 0 14 6 T26 6 T38 6 T50 6 T62 6 T74 6 T86 6 T98 6'}
                      fill="none"
                      stroke={past('fix') ? 'var(--color-milestone)' : 'var(--color-danger)'}
                      strokeWidth="3"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      initial={reduced ? false : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, ease: ease.enter }}
                    />
                  </svg>
                )}
              </m.span>
              <span>.</span>
            </p>

            {/* The scan: a band of light passing over the sentence while the coach reads it. */}
            <AnimatePresence>
              {shownBeat === 'scan' && (
                <m.span
                  className="pointer-events-none absolute inset-y-0 w-40 bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--color-signal)_30%,transparent),transparent)]"
                  initial={{ left: '-30%' }}
                  animate={{ left: '110%' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: ease.move }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* The coach's turn: the corrected line, then the rule behind it. Its room is held
              open before it arrives, so nothing below jumps when it does. */}
          <div className="min-h-[11rem]">
          <AnimatePresence mode="wait">
            {past('fix') && (
              <m.div
                key={`reply-${index}`}
                className="flex items-start gap-3"
                initial={reduced ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: ease.enter }}
              >
                <span className="mt-1 size-9 shrink-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,#cfe4ff,#5b9bf5_45%,#6d5cf2)] shadow-[0_8px_18px_-8px_rgb(91_155_245/0.9)]" />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="w-fit rounded-2xl rounded-tl-sm bg-signal px-4 py-3 text-on-signal">
                    <p className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
                      <CircleCheck strokeWidth={2.4} className="size-4 shrink-0" />
                      <span lang="ru">
                        {example.lead} {example.stem}
                        <span className="rounded bg-white/25 px-0.5">{example.right}</span>.
                      </span>
                    </p>
                  </div>

                  <AnimatePresence>
                    {past('rule') && (
                      <m.div
                        className="rounded-2xl border border-hairline bg-ground-raised px-4 py-3"
                        initial={reduced ? false : { opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                      >
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.08em] text-signal-ink uppercase">
                          <BookOpenCheck strokeWidth={1.9} className="size-3.5" />
                          {t.rule}
                        </span>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{t[example.rule]}</p>
                      </m.div>
                    )}
                  </AnimatePresence>
                </div>
              </m.div>
            )}
          </AnimatePresence>

          </div>

          {/* The session so far: each mistake ticks off as the coach fixes it, the current one
              waits on a question mark, and the ones still to come are only their opening words. */}
          <ul className="mt-auto space-y-2">
            {EXAMPLES.map((item, i) => {
              const current = i === index
              const done = i < index || (current && past('fix'))
              return (
                <li
                  key={item.lead}
                  className={cx(
                    'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-500',
                    current ? 'border-signal/35 bg-signal-soft/70' : 'border-hairline bg-ground-raised/70',
                    !done && !current && 'opacity-55',
                  )}
                >
                  <span lang="ru" className="flex min-w-0 items-center gap-2.5 text-sm font-bold text-ink">
                    {done ? (
                      <CircleCheck strokeWidth={2.4} className="size-4 shrink-0 text-milestone" />
                    ) : (
                      <span className={cx('size-4 shrink-0 rounded-full border-2', current ? 'border-signal animate-pulse' : 'border-ink-faint/50')} />
                    )}
                    {done || current ? (
                      <span className="truncate">
                        <span className="text-ink-faint line-through decoration-danger/60">{item.stem + item.wrong}</span>
                        <span className="mx-1.5 text-ink-faint">→</span>
                        {done ? (
                          <>
                            {item.stem}
                            <span className="text-milestone">{item.right}</span>
                          </>
                        ) : (
                          <span className="text-signal-ink">?</span>
                        )}
                      </span>
                    ) : (
                      <span className="truncate text-ink-muted">{item.lead} …</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-extrabold text-ink-faint tabular-nums">
                    {i + 1}/{EXAMPLES.length}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </Card>
    </div>
  )
}

/** What the coach is doing right now, in one short line. */
function StatusLine({ beat }: { beat: Beat }) {
  const t = useT().landing.report
  const line =
    beat === 'speak'
      ? { icon: <Mic strokeWidth={2} className="size-3.5" />, text: t.listening, tone: 'text-signal-ink' }
      : beat === 'scan'
        ? { icon: <Sparkles strokeWidth={0} className="size-3.5 animate-spin fill-current [animation-duration:2s]" />, text: t.analyzing, tone: 'text-signal-ink' }
        : beat === 'found'
          ? { icon: <CircleAlert strokeWidth={2.2} className="size-3.5" />, text: t.found, tone: 'text-danger' }
          : { icon: <CircleCheck strokeWidth={2.2} className="size-3.5" />, text: t.fixed, tone: 'text-milestone' }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.span
        key={line.text}
        className={cx('inline-flex items-center gap-1.5', line.tone)}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
      >
        {line.icon}
        {line.text}
      </m.span>
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------------ confidence */

function ConfidenceCard() {
  const t = useT()
  const value = 72
  const ref = useRef<HTMLDivElement>(null)
  const seen = useInView(ref, onView)
  const shown = useCountUp(seen ? value : 0, 1400)
  // A half circle, flat side down, with the figure sitting inside it.
  const arc = 'M 24 118 A 76 76 0 0 1 176 118'

  return (
    <Card title={t.progress.confidence}>
      <div ref={ref} className="relative mx-auto mt-4 w-full max-w-[15rem]">
        <svg viewBox="0 0 200 128" className="w-full" aria-hidden="true">
          <defs>
            <linearGradient id="report-gauge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5b9bf5" />
              <stop offset="0.6" stopColor="#8b7cf6" />
              <stop offset="1" stopColor="#2cc5dd" />
            </linearGradient>
          </defs>
          <path d={arc} fill="none" stroke="var(--color-ground-sunken)" strokeWidth="14" strokeLinecap="round" />
          <m.path
            d={arc}
            fill="none"
            stroke="url(#report-gauge)"
            strokeWidth="14"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: seen ? value / 100 : 0 }}
            transition={{ duration: 1.4, ease: ease.enter }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="text-5xl font-black tracking-tight text-ink tabular-nums">{shown}</span>
          <span className="text-sm font-bold text-ink-faint"> / 100</span>
        </div>
      </div>
      <p className="mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full bg-milestone-soft px-3 py-1 text-xs font-extrabold text-milestone">
        <CircleCheck aria-hidden="true" strokeWidth={2.4} className="size-3.5" />
        {fill(t.progress.days30, { delta: '+18' })}
      </p>
    </Card>
  )
}

/* ---------------------------------------------------------------------------- levels */

/** Seven weeks of practice, oldest first. The last twelve days are the current streak. */
const ACTIVITY = [
  1, 0, 2, 1, 0, 0, 1,
  2, 1, 0, 2, 1, 1, 0,
  0, 2, 3, 1, 2, 0, 1,
  2, 0, 1, 3, 2, 1, 2,
  1, 2, 0, 1, 2, 3, 2,
  0, 1, 2, 3, 2, 3, 3,
  2, 3, 2, 3, 3, 2, 3,
]

function LevelsCard() {
  const t = useT()
  const levels = [
    { label: t.progress.speaking, level: 'A2', value: 0.46 },
    { label: t.progress.comprehension, level: 'B1', value: 0.64 },
  ]

  return (
    <Card title={t.home.activity.title}>
      <div className="mt-5 space-y-4">
        {levels.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-ink-muted">{item.label}</span>
              <span className="rounded-md bg-signal-soft px-2 py-0.5 text-xs font-black text-signal-ink">{item.level}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ground-sunken">
              <m.span
                className="block h-full origin-left rounded-full bg-[image:var(--spectrum)]"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: item.value }}
                viewport={onView}
                transition={{ duration: 1, ease: ease.enter }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Weeks as columns, days as rows; the squares fill in column by column, oldest first. */}
      <m.div
        className="mt-auto grid max-w-[10rem] grid-flow-col grid-rows-7 gap-1 pt-6"
        aria-hidden="true"
        initial="hidden"
        whileInView="shown"
        viewport={onView}
        variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.012 } } }}
      >
        {ACTIVITY.map((level, i) => (
          <m.span
            key={i}
            className="aspect-square rounded-[4px]"
            variants={{ hidden: { opacity: 0, scale: 0.4 }, shown: { opacity: 1, scale: 1 } }}
            style={{
              backgroundColor:
                level === 0
                  ? 'var(--color-ground-sunken)'
                  : `color-mix(in srgb, var(--color-signal) ${25 + level * 25}%, transparent)`,
            }}
          />
        ))}
      </m.div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold text-ink-muted">
        <span className="inline-flex items-center gap-1.5 text-caution">
          <Flame aria-hidden="true" strokeWidth={2} className="size-3.5" />
          {fill(t.home.activity.streak, { count: 12 })}
        </span>
        <span>{t.home.activity.weeks}</span>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------------------------- curve */

/** Day → confidence. Measured up to today (day 30), forecast after it. */
const MEASURED: Array<[number, number]> = [[1, 22], [5, 29], [10, 37], [15, 44], [20, 51], [25, 60], [30, 72]]
const FORECAST: Array<[number, number]> = [[30, 72], [45, 80], [60, 86], [75, 91], [90, 95]]

const X0 = 44
const X1 = 1150
const Y0 = 186
const x = (day: number) => X0 + ((day - 1) / 89) * (X1 - X0)
const y = (value: number) => Y0 - value * 1.6

/** A smooth path through the points (Catmull-Rom → cubic Bézier). */
function smooth(points: Array<[number, number]>) {
  const p = points.map(([d, v]) => [x(d), y(v)] as const)
  let d = `M ${p[0][0]} ${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[i - 1] ?? p[i], p[i], p[i + 1], p[i + 2] ?? p[i + 1]]
    d += ` C ${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6}, ${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6}, ${c[0]} ${c[1]}`
  }
  return d
}

const MEASURED_PATH = smooth(MEASURED)
const FORECAST_PATH = smooth(FORECAST)
const AREA_PATH = `${MEASURED_PATH} L ${x(30)} ${Y0} L ${x(1)} ${Y0} Z`

function CurveCard() {
  const t = useT()
  const r = t.landing.report

  return (
    <Card title={t.landing.method.milestonesTitle}>
      {/* Wide on a desktop, where the card spans the whole grid. On a phone the same drawing is
          squeezed horizontally instead, so its labels are dropped — the legend carries them. */}
      <svg viewBox="0 0 1200 214" className="mt-4 hidden w-full sm:block" aria-hidden="true">
        <CurveDrawing />
      </svg>
      <svg viewBox="0 0 1200 214" preserveAspectRatio="none" className="mt-4 h-40 w-full sm:hidden" aria-hidden="true">
        <CurveDrawing compact />
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-signal" />
          {r.now}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-5 rounded-full bg-[repeating-linear-gradient(90deg,#8b7cf6_0_3px,transparent_3px_7px)]" />
          {r.forecast}
        </span>
      </div>
    </Card>
  )
}

function CurveDrawing({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const gradient = compact ? 'report-area-sm' : 'report-area'
  const today = MEASURED[MEASURED.length - 1]

  return (
    <>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-signal)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--color-signal)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={X0} x2={X1} y1={y(v)} y2={y(v)} stroke="var(--color-hairline)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
          {!compact && (
            <text x={X0 - 10} y={y(v) + 5} textAnchor="end" fontSize="14" fontWeight="700" fill="var(--color-ink-faint)">
              {v}
            </text>
          )}
        </g>
      ))}

      <m.path
        d={AREA_PATH}
        fill={`url(#${gradient})`}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={onView}
        transition={{ duration: 0.8, delay: 0.7 }}
      />
      <m.path
        d={MEASURED_PATH}
        fill="none"
        stroke="var(--color-signal)"
        strokeWidth="4"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={onView}
        transition={{ duration: 1.3, ease: ease.move }}
      />
      <m.path
        d={FORECAST_PATH}
        fill="none"
        stroke="#8b7cf6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
        vectorEffect="non-scaling-stroke"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={onView}
        transition={{ duration: 0.6, delay: 1.3 }}
      />

      <line x1={x(30)} x2={x(30)} y1={y(100) - 6} y2={Y0} stroke="var(--color-ink-faint)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      {!compact && (
        <>
          <circle cx={x(today[0])} cy={y(today[1])} r="8" fill="var(--color-ground-raised)" stroke="var(--color-signal)" strokeWidth="4" />
          <circle cx={x(90)} cy={y(95)} r="6" fill="#8b7cf6" />
          {[1, 30, 60, 90].map((day) => (
            <text
              key={day}
              x={x(day)}
              y={208}
              textAnchor={day === 1 ? 'start' : day === 90 ? 'end' : 'middle'}
              fontSize="14"
              fontWeight="700"
              fill="var(--color-ink-faint)"
            >
              {fill(t.home.recent.day, { day })}
            </text>
          ))}
        </>
      )}
    </>
  )
}
