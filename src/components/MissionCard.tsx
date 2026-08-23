import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { pickContent } from '../lib/content'
import { cx } from '../lib/cx'
import { fill, useLocale, useT } from '../lib/i18n'
import { missionPath } from '../lib/mission-path'
import type { MissionSummary } from '../lib/types'
import { missionCardClass } from './mission-card-style'
import { Badge } from './ui'

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
    <Link
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

      <MissionProgress
        value={mission.isCompleted ? 1 : 0}
        max={1}
        completed={mission.isCompleted}
        label={title}
      />

      {needsRegisterLabel && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone="caution">{t.labels.formality[mission.formality]}</Badge>
          <Badge tone={mission.workplaceUse === 'Safe' ? 'neutral' : 'caution'}>
            {t.labels.workplace[mission.workplaceUse]}
          </Badge>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className="text-sm font-extrabold text-signal-ink">{t.practice.details}</span>

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
    </Link>
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
      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3 fill-none stroke-current stroke-[2.4]">
        <path d="m4.5 10.25 3.25 3.25 7.75-7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function ArrowGlyph() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-none stroke-current stroke-2">
      <path d="M4 10h11M11 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
