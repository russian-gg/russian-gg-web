import type { ReactNode } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { fill, useLocale, useT } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { MissionSummary } from '../lib/types'
import { missionCardClass } from './mission-card-style'
import { Badge } from './ui'
import * as m from 'motion/react-m'
import { duration, ease, rise } from '../lib/motion'

/**
 * The card is a link, and the link is the motion element.
 *
 * Not a `<m.div>` wrapped around it: this card is a grid item everywhere it appears, and a
 * wrapper takes the grid-item role for itself — the link inside then sizes to its own content
 * instead of stretching to the row, so a shelf of cards stops lining up.
 *
 * Carrying `variants` and no `animate` of its own is deliberate. Dropped into a `Sequence` it
 * joins the beat; standing on its own it simply renders, with no entrance and nothing hidden.
 */
const MotionLink = m.create(Link)

export function MissionCard({
  mission,
  showFreeLabel = false,
  featured = false,
}: {
  mission: MissionSummary
  showFreeLabel?: boolean
  featured?: boolean
}) {
  const t = useT()
  const { locale } = useLocale()
  const isProLock =
    mission.isLocked && (mission.lockReason?.toLowerCase().includes('pro') ?? false)

  const needsRegisterLabel =
    mission.category === 'StreetRussian' ||
    mission.formality === 'Informal' ||
    mission.formality === 'Slang' ||
    mission.workplaceUse !== 'Safe'

  const title = pickContent(locale, {
    uz: mission.titleUz,
    ru: mission.titleRu,
    en: mission.titleEn,
  })
  const destination = mission.isLocked
    ? isProLock
      ? '/paywall'
      : '/home'
    : missionPath(mission)

  return (
    /*
      Hover stays in CSS (`missionCardClass` lifts the card with Tailwind's `translate`
      property); the press is Motion's, on `transform`. The two are separate CSS properties, so
      they compose rather than overwrite each other.

      The press is the half that was missing: hover does not exist on a phone, and this is the
      main thing a learner taps in the product. A locked card does not sink — it is not going
      to open, and a control that answers a press it cannot honour is a small lie.
    */
    <MotionLink
      variants={rise}
      whileTap={mission.isLocked ? undefined : { scale: 0.985, y: 1 }}
      transition={{ duration: 0.09, ease: ease.move }}
      to={destination}
      aria-label={title}
      className={cx(
        missionCardClass(mission.isCompleted, mission.isLocked),
        featured && !mission.isLocked && 'border-milestone/20 shadow-[0_8px_24px_rgb(15_115_85/0.06)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="text-lg font-extrabold leading-snug text-ink">{title}</h3>
            {mission.isCompleted && <CompletedGlyph label={t.path.done} />}
          </div>

          <p className="mt-1 text-xs font-semibold text-ink-faint">
            {t.labels.category[mission.category]}
            {mission.courseDay ? ` · ${fill(t.common.day, { day: mission.courseDay })}` : ''}
            {` · ${fill(t.common.minutes, { count: mission.estimatedMinutes })}`}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {showFreeLabel && !mission.isLocked && <Badge>{t.account.plan.free}</Badge>}
          {mission.isLocked && (
            <Badge tone="caution">{isProLock ? t.path.needsPro : t.common.later}</Badge>
          )}
        </div>
      </div>

      <MissionScore mission={mission} label={title} />

      {needsRegisterLabel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="caution">{t.labels.formality[mission.formality]}</Badge>
          <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
            {t.labels.workplace[mission.workplaceUse]}
          </Badge>
        </div>
      )}

      {/* No separate "details" link: the start button opens the brief, which holds the instructions. */}
      <div className="mt-auto flex items-center justify-end gap-3 pt-5">
        {mission.isCompleted ? (
          <span className="rounded-[var(--radius-control)] border border-milestone/15 bg-ground-raised px-4 py-1.5 text-sm font-extrabold text-milestone">
            {t.path.done}
          </span>
        ) : mission.isLocked ? (
          <span className="text-sm font-extrabold text-caution">
            {isProLock ? t.path.needsPro : t.path.locked}
          </span>
        ) : (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-4 py-2 text-sm font-extrabold text-on-signal',
              featured ? 'bg-milestone' : 'bg-signal',
            )}
          >
            {featured ? t.home.start : t.practice.start}
            <ArrowGlyph />
          </span>
        )}
      </div>
    </MotionLink>
  )
}

/**
 * The mission's best AI-evaluated score, with a tick at the pass mark when the mission has one
 * (dialogue missions). A mission finished before scores were kept still reads as full.
 */
function MissionScore({ mission, label }: { mission: MissionSummary; label: string }) {
  const t = useT()
  const best = mission.bestScore ?? null
  const pass = mission.passScore ?? null
  const percent = Math.min(100, Math.max(0, best ?? (mission.isCompleted ? 100 : 0)))
  const status =
    best !== null
      ? fill(t.practice.bestScore, { score: best })
      : mission.isCompleted
        ? t.path.done
        : t.practice.notTried

  return (
    <div className="mt-5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={pass !== null ? `${status}, ${fill(t.practice.passMark, { score: pass })}` : status}
        className="relative h-2 rounded-full bg-ground-sunken ring-1 ring-black/[0.03]"
      >
        {/*
          The score fills rather than appearing full.

          It carried `transition-[width]` before, which never ran: a CSS transition has no
          previous value to move from on the element's first render, so a card scrolled into
          view has always simply shown its bar already at its final length. Growing it is the
          difference between a number that is reported and a result that is *shown* — and it
          is the one measurement on this card the learner earned.

          `whileInView` because a shelf of these is mostly below the fold. `once` so scrolling
          back up the practice list does not re-run twenty bars.
        */}
        <m.span
          className={`block h-full rounded-full ${mission.isCompleted ? 'bg-milestone' : 'bg-signal'}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${percent}%` }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: duration.deliberate, ease: ease.enter }}
        />
        {pass !== null && (
          <span
            aria-hidden="true"
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-ink/35"
            style={{ left: `${pass}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold text-ink-muted">
        <span className={mission.isCompleted ? 'text-milestone' : undefined}>{status}</span>
        {pass !== null && <span>{fill(t.practice.passMark, { score: pass })}</span>}
      </div>
    </div>
  )
}

export function MissionProgress({
  value,
  max,
  completed,
  label,
  compact = false,
}: {
  value: number
  max: number
  completed: boolean
  label: string
  compact?: boolean
}) {
  const t = useT()
  const safeMax = Math.max(1, max)
  const safeValue = Math.min(safeMax, Math.max(0, value))
  const percent = Math.round((safeValue / safeMax) * 100)

  return (
    <div className={compact ? 'mt-2.5' : 'mt-5'}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        className="h-2 overflow-hidden rounded-full bg-ground-sunken ring-1 ring-black/[0.03]"
      >
        <span
          className={`block h-full rounded-full transition-[width] duration-300 ${
            completed ? 'bg-milestone' : 'bg-signal'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!(compact && completed) && (
        <p className={`${compact ? 'mt-1' : 'mt-1.5'} text-right text-[11px] font-semibold text-ink-muted`}>
          {completed ? t.path.done : `${safeValue}/${safeMax}`}
        </p>
      )}
    </div>
  )
}

export function CompletedGlyph({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-milestone text-milestone"
    >
      <Check aria-hidden="true" strokeWidth={2.4} className="size-3" />
    </span>
  )
}

export function ArrowGlyph() {
  return (
    <ArrowRight aria-hidden="true" strokeWidth={2} className="size-4" />
  )
}

export function MissionCardAction({
  children,
  compact = false,
}: {
  children: ReactNode
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-signal px-4 text-sm font-extrabold text-on-signal ${
        compact ? 'py-1.5' : 'py-2'
      }`}
    >
      {children}
      <ArrowGlyph />
    </span>
  )
}
